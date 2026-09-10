/**
 * A working reconciliation row: the position_capture and time_capture at
 * the same ordinal in their (independently captured, §4.5) streams, plus
 * whatever the operator has edited in this session. `localId` is a stable
 * React key across inserts/removals — never a server id (a gap row has no
 * capture behind it at all).
 */
export interface WorkingRow {
  localId: string;
  position: PositionEntry | null;
  time: TimeEntry | null;
  athleteNo: number | null;
  athleteName: string | null;
  runTime: string | null;
  status: RunStatus;
}

export type RunStatus = "ok" | "dns" | "dnf" | "dq";

export interface PositionEntry {
  id: string;
  position: number;
  athleteNo: number | null;
}

export interface TimeEntry {
  id: string;
  seq: number;
  elapsedTime: string;
  isPlaceholder: boolean;
}

export type Mismatch =
  | "skip-at-table" // position stream has no athlete (Skip was pressed)
  | "placeholder-needs-time" // time stream flagged "missed one", needs a real time
  | "position-without-time" // a position row exists past the end of the time stream
  | "time-without-position" // a time row exists past the end of the position stream
  | "gap"; // operator-inserted gap, no capture backing this row at all

/**
 * Builds the initial working table by zipping the two capture streams by
 * ordinal (position N against the Nth time), per §4.5's worked example.
 * `athleteNo`/`athleteName` come from the position capture (the table scan
 * is what identifies the athlete); `runTime` from the time capture. Neither
 * stream is reordered — callers pass already-active (non-voided) rows,
 * sorted by position/seq.
 */
export function buildWorkingRows(
  positions: PositionEntry[],
  times: TimeEntry[],
  athleteNames: Map<number, string>,
): WorkingRow[] {
  const length = Math.max(positions.length, times.length);
  const rows: WorkingRow[] = [];

  for (let i = 0; i < length; i++) {
    const position = positions[i] ?? null;
    const time = times[i] ?? null;
    rows.push({
      localId: `capture-${i}`,
      position,
      time,
      athleteNo: position?.athleteNo ?? null,
      athleteName: position?.athleteNo
        ? (athleteNames.get(position.athleteNo) ?? null)
        : null,
      runTime: time && !time.isPlaceholder ? time.elapsedTime : null,
      status: "ok",
    });
  }

  return rows;
}

export function mismatchFor(row: WorkingRow): Mismatch | null {
  // An operator-inserted gap (or a stream-short row) resolves once they've
  // filled in both an athlete and a time by hand — the mismatch reflects
  // what's missing right now, not which capture originally backed the row.
  if (row.athleteNo === null && !row.position) {
    return row.time || row.runTime ? "time-without-position" : "gap";
  }
  if (row.runTime === null && !row.time) {
    return row.position || row.athleteNo !== null
      ? "position-without-time"
      : "gap";
  }
  if (row.athleteNo === null) return "skip-at-table";
  if (row.time?.isPlaceholder && row.runTime === null) {
    return "placeholder-needs-time";
  }
  return null;
}

export interface AutomaticCheck {
  kind: "count-mismatch" | "not-on-roster" | "duplicate-heat";
  message: string;
}

/**
 * §4.5's automatic checks: captured count vs roster count, an athlete
 * captured here who isn't on this heat's roster, and an athlete who already
 * has a run_result in a different heat (double-run). Flags only — never
 * blocks saving.
 */
export function computeAutomaticChecks({
  rosterCount,
  rows,
  rosterAthleteNos,
  duplicateAthletes,
}: {
  rosterCount: number;
  rows: WorkingRow[];
  rosterAthleteNos: Set<number>;
  duplicateAthletes: { athleteNo: number; otherHeat: number }[];
}): AutomaticCheck[] {
  const checks: AutomaticCheck[] = [];
  const captured = rows.filter((r) => r.athleteNo !== null);

  if (captured.length !== rosterCount) {
    checks.push({
      kind: "count-mismatch",
      message: `${captured.length} captured vs ${rosterCount} on the heat roster.`,
    });
  }

  for (const row of captured) {
    if (row.athleteNo !== null && !rosterAthleteNos.has(row.athleteNo)) {
      checks.push({
        kind: "not-on-roster",
        message: `Athlete ${row.athleteNo} is not on this heat's roster.`,
      });
    }
  }

  for (const dup of duplicateAthletes) {
    checks.push({
      kind: "duplicate-heat",
      message: `Athlete ${dup.athleteNo} already has a time in heat ${dup.otherHeat}.`,
    });
  }

  return checks;
}
