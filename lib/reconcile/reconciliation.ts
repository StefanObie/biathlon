import {
  buildWorkingRows,
  type PositionEntry,
  type RunStatus,
  type TimeEntry,
  type WorkingRow,
} from "@/lib/reconcile/join";
import { FILLED } from "@/lib/scan/position";

/**
 * A heat's saved Reconciliation (ADR 0006) is its record: once a heat has
 * been saved, Reconcile opens from it, and the Captures are the evidence
 * shown beside it.
 */

/** One row of a heat's saved Reconciliation. */
export interface SavedRow {
  athleteNo: number | null;
  runTime: string | null;
  status: RunStatus;
  positionCaptureId: string | null;
  timeCaptureId: string | null;
}

/** A position capture of the heat, voided or not. */
export interface PositionCaptureFacts {
  id: string;
  position: number;
  athleteNo: number | null;
  voided: boolean;
  voidReason: string | null;
}

/** A time capture of the heat, voided or not. */
export interface TimeCaptureFacts {
  id: string;
  seq: number;
  elapsedTime: string;
  isPlaceholder: boolean;
  voided: boolean;
}

/** A saved Run result of the heat. */
export interface SavedRunResult {
  athleteNo: number;
  runTime: string | null;
  status: RunStatus;
}

function positionEntry(c: PositionCaptureFacts): PositionEntry {
  return { id: c.id, position: c.position, athleteNo: c.athleteNo };
}

function timeEntry(c: TimeCaptureFacts): TimeEntry {
  return {
    id: c.id,
    seq: c.seq,
    elapsedTime: c.elapsedTime,
    isPlaceholder: c.isPlaceholder,
  };
}

/** The heat's active position captures, in finishing order. */
function activePositions(positions: PositionCaptureFacts[]): PositionEntry[] {
  return positions
    .filter((c) => !c.voided)
    .sort((a, b) => a.position - b.position)
    .map(positionEntry);
}

/** The heat's active time captures, in the order they were pressed. */
function activeTimes(times: TimeCaptureFacts[]): TimeEntry[] {
  return times
    .filter((c) => !c.voided)
    .sort((a, b) => a.seq - b.seq)
    .map(timeEntry);
}

/**
 * The rows Reconcile opens a heat with. A saved heat opens from its saved
 * Reconciliation, each row linked to the Captures it came from, voided or
 * not. A heat with no saved Reconciliation (never saved, or saved before
 * they were stored) opens from its active Captures, paired by order, with
 * any saved Run results laid over the athlete they belong to; a Run result
 * whose athlete isn't on any row gets a row of its own, so nothing saved is
 * dropped.
 */
export function openReconciliation({
  saved,
  positions,
  times,
  runResults,
  names,
}: {
  saved: SavedRow[];
  positions: PositionCaptureFacts[];
  times: TimeCaptureFacts[];
  runResults: SavedRunResult[];
  names: Map<number, string>;
}): WorkingRow[] {
  if (saved.length === 0) {
    return fromCaptures({ positions, times, runResults, names });
  }

  const positionById = new Map(positions.map((c) => [c.id, c]));
  const timeById = new Map(times.map((c) => [c.id, c]));
  return saved.map((row, i) => {
    const position =
      row.positionCaptureId === null
        ? undefined
        : positionById.get(row.positionCaptureId);
    const time =
      row.timeCaptureId === null ? undefined : timeById.get(row.timeCaptureId);
    return {
      localId: `saved-${i}`,
      position: position ? positionEntry(position) : null,
      time: time ? timeEntry(time) : null,
      athleteNo: row.athleteNo,
      athleteName:
        row.athleteNo === null ? null : (names.get(row.athleteNo) ?? null),
      runTime: row.runTime,
      status: row.status,
    };
  });
}

function fromCaptures({
  positions,
  times,
  runResults,
  names,
}: {
  positions: PositionCaptureFacts[];
  times: TimeCaptureFacts[];
  runResults: SavedRunResult[];
  names: Map<number, string>;
}): WorkingRow[] {
  const rows = buildWorkingRows(
    activePositions(positions),
    activeTimes(times),
    names,
  );

  const resultByAthlete = new Map(runResults.map((r) => [r.athleteNo, r]));
  const overlaid = rows.map((row) => {
    if (row.athleteNo === null) return row;
    const result = resultByAthlete.get(row.athleteNo);
    if (!result) return row;
    return {
      ...row,
      runTime: result.runTime ?? row.runTime,
      status: result.status,
    };
  });

  const onRows = new Set(overlaid.map((r) => r.athleteNo));
  const leftOver = runResults
    .filter((r) => !onRows.has(r.athleteNo))
    .map((r): WorkingRow => ({
      localId: `saved-result-${r.athleteNo}`,
      position: null,
      time: null,
      athleteNo: r.athleteNo,
      athleteName: names.get(r.athleteNo) ?? null,
      runTime: r.runTime,
      status: r.status,
      savedWithoutCapture: true,
    }));
  return [...overlaid, ...leftOver];
}

/**
 * The active Captures no row of the Reconciliation came from: a late sync,
 * a capture made after the heat was reopened, or one the official removed.
 * They're listed beside the table for the official to place or leave out;
 * the table never changes by itself.
 */
export function unplacedCaptures(
  rows: WorkingRow[],
  positions: PositionCaptureFacts[],
  times: TimeCaptureFacts[],
): { positions: PositionEntry[]; times: TimeEntry[] } {
  const placed = new Set(
    rows.flatMap((r) => [
      r.position?.id,
      r.time?.id,
      // A Fill offered on its row isn't listed again beside the table.
      fillOf(r, positions)?.id,
    ]),
  );
  return {
    positions: activePositions(positions).filter((c) => !placed.has(c.id)),
    times: activeTimes(times).filter((c) => !placed.has(c.id)),
  };
}

/** The Fill that replaced the row's position capture, if it was a filled Skip. */
function fillOf(
  row: WorkingRow,
  positions: PositionCaptureFacts[],
): PositionEntry | null {
  if (!row.position) return null;
  const capture = positions.find((c) => c.id === row.position?.id);
  if (!capture?.voided || capture.voidReason !== FILLED) return null;
  const fill = positions.find(
    (c) => !c.voided && c.position === capture.position && c.id !== capture.id,
  );
  return fill ? positionEntry(fill) : null;
}

/**
 * A row whose Capture was voided after it was saved keeps its saved values
 * and is flagged. When a Fill replaced its Skip, the Fill is offered.
 */
export function voidedCapture(
  row: WorkingRow,
  positions: PositionCaptureFacts[],
  times: TimeCaptureFacts[],
): { message: string; replacement: PositionEntry | null } | null {
  const positionVoided =
    row.position !== null &&
    positions.some((c) => c.id === row.position?.id && c.voided);
  if (positionVoided) {
    const fill = fillOf(row, positions);
    return fill
      ? {
          message: `Its position capture was voided: the Skip was filled with #${fill.athleteNo}.`,
          replacement: fill,
        }
      : { message: "Its position capture was voided.", replacement: null };
  }
  const timeVoided =
    row.time !== null && times.some((c) => c.id === row.time?.id && c.voided);
  if (timeVoided) {
    return { message: "Its time capture was voided.", replacement: null };
  }
  return null;
}

/**
 * What a row changed from its Captures, so the official can see what was
 * captured and what they made of it ("Scanned #12 → #34"). A row with no
 * Captures is labelled as one the official added, or as a Run result saved
 * before Reconciliations were stored that no Capture accounts for.
 */
export function rowChanges(row: WorkingRow): string[] {
  if (!row.position && !row.time) {
    return [
      row.savedWithoutCapture ? "Saved, no capture" : "Added by official",
    ];
  }
  const changes: string[] = [];
  if (row.position && row.position.athleteNo !== row.athleteNo) {
    const scanned =
      row.position.athleteNo === null ? "a Skip" : `#${row.position.athleteNo}`;
    const assigned =
      row.athleteNo === null ? "no athlete" : `#${row.athleteNo}`;
    changes.push(`Scanned ${scanned} → ${assigned}`);
  }
  if (row.time) {
    if (row.time.isPlaceholder) {
      if (row.runTime !== null) changes.push(`Missed finish → ${row.runTime}`);
    } else if (row.status !== "ok") {
      changes.push(
        `Captured ${row.time.elapsedTime} → ${row.status.toUpperCase()}`,
      );
    } else if (row.runTime !== row.time.elapsedTime) {
      changes.push(
        `Captured ${row.time.elapsedTime} → ${row.runTime ?? "no time"}`,
      );
    }
  }
  return changes;
}

/** A row's time field as typed: a cleared field is no time, not "". */
export function runTimeInput(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** One row as save_reconciliation takes it. */
export interface ReconciliationPayloadRow {
  athlete_no: number | null;
  run_time: string | null;
  status: RunStatus;
  position_capture_id: string | null;
  time_capture_id: string | null;
}

/**
 * The Reconciliation to save: every row in order, rows with no athlete
 * included, each with the Captures it came from. Only an ok row keeps a time.
 */
export function reconciliationPayload(
  rows: WorkingRow[],
): ReconciliationPayloadRow[] {
  return rows.map((r) => ({
    athlete_no: r.athleteNo,
    run_time: r.status === "ok" ? r.runTime : null,
    status: r.status,
    position_capture_id: r.position?.id ?? null,
    time_capture_id: r.time?.id ?? null,
  }));
}
