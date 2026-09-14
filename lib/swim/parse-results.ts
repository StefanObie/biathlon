/**
 * Time Drops console export parser (§4.6).
 *
 * The file interleaves two things: console noise (false starts, heat
 * navigation, program updates) and fixed-width result blocks. Only the
 * blocks matter; everything else is ignored rather than errored on, since
 * the console writes whatever the operator did on the night.
 *
 * Fixed-width geometry, verified against the real session file across all
 * 102 result rows (§2 Finding 1):
 *
 *   cols 0-4   LANE
 *   cols 6-11  PLACE
 *   cols 13-43 NAME   (exactly 30 chars — this is what truncates the
 *                      athlete number, e.g. "... Nel (AFL) (81")
 *   cols 43+   TIME then backup columns A / B / C
 *
 * Parsing the name by column rather than by token is what makes truncation
 * detectable: a number cut off mid-digit is indistinguishable from a real
 * one if you split on whitespace.
 */

/** Name column boundaries — see geometry note above. */
const NAME_START = 13;
const NAME_END = 43;

const EVENT_HEADER =
  /^Event #(\d+)\s+Heat (\d+)\s+Race (\d+)\s+(.*?)\s*\(Start:\s*([\d:]+)\)/;
const RESULT_ROW = /^\s*(\d+)\s+(\d+)\s/;
const REVISED_MARKER = /\(REVISED FROM EARLIER/i;
const DISTANCE = /(\d+)\s*SC\s*Meter/i;
const TIME_TOKEN = /\d+:\d{2}\.\d{2}|\d+\.\d{2}/g;
/** Trailing "(1234)" — may be truncated, so digits are not anchored to ")". */
const TRAILING_NUMBER = /\((\d+)\)?\s*$/;
/** Affiliation marker, stripped before any name comparison (§4.6). */
const AFL_MARKER = /\s*\(AFL\)\s*/g;

export interface RawSwimRow {
  eventNo: number;
  heat: number;
  race: number;
  distanceM: number | null;
  lane: number;
  /** File's PLACE column; 0 means no result and is normalised to null. */
  place: number | null;
  /** Name with (AFL) and any trailing number stripped. Empty for NS lanes. */
  name: string;
  /** Athlete number from the trailing parens, null if absent. */
  athleteNo: number | null;
  /**
   * True when the name column filled all 30 chars, so the trailing number
   * may have been cut off. A parsed athleteNo from such a row is not
   * trustworthy on its own (§2 Finding 1).
   */
  truncated: boolean;
  /** Official TIME column, normalised to mm:SS.ss. Null for 0.00 / NS. */
  time: string | null;
  /** Backup columns A/B/C, normalised. Empty when the row had only a time. */
  backupTimes: string[];
  /** Backups present and disagreeing with the official time (§4.6). */
  backupsDisagree: boolean;
  /** Row sat under a (REVISED FROM EARLIER) marker. */
  revised: boolean;
  /** Empty lane — "NS" with no name. Not a person, never saved. */
  noShow: boolean;
  /** Verbatim source line, kept for the review table (§4.6). */
  sourceLine: string;
  /** 1-based line number in the source file. */
  lineNo: number;
}

/**
 * Normalises any Time Drops time to mm:SS.ss (§2 Finding 4).
 * "59.27" -> "00:59.27", "1:13.22" -> "01:13.22". Zero-padded minutes mean
 * lexicographic sort equals chronological sort.
 *
 * Returns null for 0.00, which the file uses for "no result" and which must
 * never be imported as a time (§4.6).
 */
export function normaliseTime(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withMinutes = trimmed.includes(":") ? trimmed : `0:${trimmed}`;
  const match = /^(\d+):(\d{1,2})\.(\d{1,2})$/.exec(withMinutes);
  if (!match) return null;

  const [, mm, ss, cs] = match;
  const minutes = Number(mm);
  const seconds = Number(ss);
  const centis = Number(cs);
  if (minutes === 0 && seconds === 0 && centis === 0) return null;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centis).padEnd(2, "0")}`;
}

/**
 * Splits the parenthesised athlete number off a name column.
 *
 * The number is confirmation only, never the lookup key (§4.6) — which is
 * why a truncated one is reported alongside `truncated` rather than being
 * silently trusted or silently dropped.
 */
function splitName(nameField: string): {
  name: string;
  athleteNo: number | null;
} {
  const trimmed = nameField.trim();
  const match = TRAILING_NUMBER.exec(trimmed);
  if (!match) {
    return { name: trimmed.replace(AFL_MARKER, " ").trim(), athleteNo: null };
  }
  const name = trimmed.slice(0, match.index).replace(AFL_MARKER, " ").trim();
  return { name, athleteNo: Number(match[1]) };
}

/**
 * Parses a Time Drops export into raw rows, in file order.
 *
 * Later blocks for a heat supersede earlier ones (§4.6). Because a revised
 * block can appear with no earlier copy to supersede — as it does in the
 * real session file, where the (REVISED) marker sits above the only copy of
 * Heat 17 — every row of a marked block carries `revised` either way.
 * Nothing under that marker is silently trusted.
 */
export function parseSwimResults(text: string): RawSwimRow[] {
  const lines = text.split(/\r?\n/);

  /** Blocks keyed by heat, so a later block replaces an earlier one. */
  const byHeat = new Map<number, RawSwimRow[]>();
  const heatOrder: number[] = [];

  let current: {
    eventNo: number;
    heat: number;
    race: number;
    distanceM: number | null;
    revised: boolean;
    rows: RawSwimRow[];
  } | null = null;
  let revisedPending = false;

  const flush = () => {
    if (!current) return;
    if (!byHeat.has(current.heat)) heatOrder.push(current.heat);
    byHeat.set(current.heat, current.rows);
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (REVISED_MARKER.test(line)) {
      revisedPending = true;
      continue;
    }

    const header = EVENT_HEADER.exec(line);
    if (header) {
      flush();
      const distanceMatch = DISTANCE.exec(header[4]);
      current = {
        eventNo: Number(header[1]),
        heat: Number(header[2]),
        race: Number(header[3]),
        distanceM: distanceMatch ? Number(distanceMatch[1]) : null,
        revised: revisedPending,
        rows: [],
      };
      revisedPending = false;
      continue;
    }

    if (!current) continue;

    const rowMatch = RESULT_ROW.exec(line);
    if (!rowMatch) {
      // A non-row line after a block's rows ends the block; blank lines
      // inside the header area (the LANE/PLACE/NAME line) do not.
      if (line.trim() !== "" && !line.includes("LANE")) flush();
      continue;
    }

    const lane = Number(rowMatch[1]);
    const placeRaw = Number(rowMatch[2]);
    const nameField = line.slice(NAME_START, NAME_END);
    const truncated =
      nameField.length === NAME_END - NAME_START &&
      nameField.trim().length === NAME_END - NAME_START;
    const { name, athleteNo } = splitName(nameField);

    const timeTokens = line.slice(NAME_END).match(TIME_TOKEN) ?? [];
    const normalised = timeTokens
      .map(normaliseTime)
      .filter((t): t is string => t !== null);

    const time = normalised.length > 0 ? normalised[0] : null;
    const backupTimes = normalised.slice(1);
    // The official TIME column wins; backups only ever flag the row (§4.6).
    const backupsDisagree =
      backupTimes.length > 0 && backupTimes.some((t) => t !== time);

    const noShow = name === "NS" || (name === "" && time === null);

    current.rows.push({
      eventNo: current.eventNo,
      heat: current.heat,
      race: current.race,
      distanceM: current.distanceM,
      lane,
      place: placeRaw === 0 ? null : placeRaw,
      name: noShow ? "" : name,
      athleteNo,
      truncated,
      time,
      backupTimes,
      backupsDisagree,
      revised: current.revised,
      noShow,
      sourceLine: line.replace(/\s+$/, ""),
      lineNo: i + 1,
    });
  }

  flush();

  return heatOrder.flatMap((heat) => byHeat.get(heat) ?? []);
}
