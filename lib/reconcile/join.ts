import { ageGroupLabel, type Gender } from "@/lib/import/age-group";
import type { OrganizationAthlete } from "@/lib/leagues/late-entry";

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
  kind:
    | "count-mismatch"
    | "not-on-roster"
    | "not-on-start-list"
    | "duplicate-heat"
    | "captured-after-close"
    | "author-off-team";
  message: string;
}

/**
 * §4.5's automatic checks: captured count vs roster count, an athlete
 * captured here who isn't on the League's Start list (a Late entry to
 * confirm on save) or isn't on this heat's roster, and an athlete who
 * already has a run_result in a different heat (double-run). Flags only —
 * never blocks saving.
 */
export function computeAutomaticChecks({
  rosterCount,
  rows,
  rosterAthleteNos,
  startListAthleteNos,
  duplicateAthletes,
}: {
  rosterCount: number;
  rows: WorkingRow[];
  rosterAthleteNos: Set<number>;
  startListAthleteNos: Set<number>;
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
    if (row.athleteNo === null) continue;
    if (!startListAthleteNos.has(row.athleteNo)) {
      checks.push({
        kind: "not-on-start-list",
        message: `#${row.athleteNo} is not on the Start list.`,
      });
    } else if (!rosterAthleteNos.has(row.athleteNo)) {
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

/** A Late entry a heat's save creates, once the Official confirms it. */
export interface LateEntryToConfirm {
  athleteNo: number;
  fullName: string;
  gender: Gender;
  runHeat: number;
  /** A label from AGE_GROUP_LABELS, or null when there is none to suggest. */
  suggestedAgeGroupLabel: string | null;
}

/**
 * The Late entries saving this heat would create: each athlete of the
 * Organization on a row who isn't on the League's Start list, once, entered
 * in this heat with the age group of their latest entry suggested. Every
 * result has a Start list entry, so these are confirmed before the save. A
 * number that is no athlete of the Organization can't be entered, and isn't
 * listed.
 */
export function lateEntriesToConfirm({
  rows,
  runHeat,
  startListAthleteNos,
  athletes,
}: {
  rows: WorkingRow[];
  runHeat: number;
  startListAthleteNos: Set<number>;
  athletes: OrganizationAthlete[];
}): LateEntryToConfirm[] {
  const listed = new Set<number>();
  const lateEntries: LateEntryToConfirm[] = [];
  for (const { athleteNo } of rows) {
    if (athleteNo === null || listed.has(athleteNo)) continue;
    if (startListAthleteNos.has(athleteNo)) continue;
    listed.add(athleteNo);
    const athlete = athletes.find((a) => a.athleteNo === athleteNo);
    if (!athlete) continue;
    lateEntries.push({
      athleteNo,
      fullName: athlete.fullName,
      gender: athlete.gender,
      runHeat,
      suggestedAgeGroupLabel:
        athlete.latestAgeGroupCode === null
          ? null
          : ageGroupLabel(athlete.latestAgeGroupCode, athlete.gender),
    });
  }
  return lateEntries;
}

/**
 * Flags every active capture made after the heat closed — typically from a
 * phone that was offline when the close reached the others (ADR 0001). The
 * capture is kept, never rejected; the official decides what it means.
 *
 * "Made after" is the capture's own timestamp, not when it synced: a
 * capture made before the close that arrives late is an ordinary capture.
 * Timestamps are compared as instants because the server and the phones
 * write them with different offsets. An open heat (never closed, or
 * reopened) flags nothing.
 */
export function capturedAfterCloseChecks({
  closedAt,
  positions,
  times,
}: {
  closedAt: string | null;
  positions: {
    position: number;
    athleteNo: number | null;
    capturedAt: string;
    voided: boolean;
  }[];
  times: { seq: number; capturedAt: string; voided: boolean }[];
}): AutomaticCheck[] {
  if (closedAt === null) return [];
  const closedMs = new Date(closedAt).getTime();
  const isLate = (c: { capturedAt: string; voided: boolean }) =>
    !c.voided && new Date(c.capturedAt).getTime() > closedMs;

  return [
    ...positions.filter(isLate).map((p): AutomaticCheck => ({
      kind: "captured-after-close",
      message: `Position #${p.position} (${p.athleteNo === null ? "skip" : `athlete ${p.athleteNo}`}) was captured after heat closed.`,
    })),
    ...times.filter(isLate).map((t): AutomaticCheck => ({
      kind: "captured-after-close",
      message: `Time #${t.seq} was captured after heat closed.`,
    })),
  ];
}

/**
 * Flags every active capture whose author is no longer on the League team
 * (#36). A phone that was offline syncs late, and the database accepts a
 * capture its author made while they held the Role, even after they've
 * been removed; the official decides what it means. `onTeam` is everyone
 * who can still capture on the League: its current team and its
 * Organization's Admins. A capture with no author was made before authors
 * were recorded, and isn't flagged.
 */
export function authorOffTeamChecks({
  onTeam,
  positions,
  times,
}: {
  onTeam: Set<string>;
  positions: {
    position: number;
    athleteNo: number | null;
    authorId: string | null;
    voided: boolean;
  }[];
  times: { seq: number; authorId: string | null; voided: boolean }[];
}): AutomaticCheck[] {
  const isOffTeam = (c: { authorId: string | null; voided: boolean }) =>
    !c.voided && c.authorId !== null && !onTeam.has(c.authorId);

  return [
    ...positions.filter(isOffTeam).map((p): AutomaticCheck => ({
      kind: "author-off-team",
      message: `Position #${p.position} (${p.athleteNo === null ? "skip" : `athlete ${p.athleteNo}`}) was captured by someone no longer on the League team.`,
    })),
    ...times.filter(isOffTeam).map((t): AutomaticCheck => ({
      kind: "author-off-team",
      message: `Time #${t.seq} was captured by someone no longer on the League team.`,
    })),
  ];
}
