/**
 * Call room hints on the reconciliation screen (#44): advice drawn from who
 * was Checked in, shown to the Official. They never set a status.
 */
import type { CheckInFacts } from "@/lib/call-room/call-room";
import type { RunStatus } from "./join";

export interface HintAthlete {
  athleteNo: number;
  /** The heat they're rostered in. */
  runHeat: number;
}

export interface HintRow {
  athleteNo: number | null;
  status: RunStatus;
}

export type CallRoomHintKind =
  "suggest-dns" | "checked-in-no-finish" | "heat-mismatch";

export interface CallRoomHint {
  athleteNo: number;
  kind: CallRoomHintKind;
  message: string;
}

/**
 * The hints for `runHeat`. A Finisher is an athlete with a row in the
 * working table whose status isn't DNS or DNF. A heat with no check-ins at
 * all has no Call room, so it gets no hints.
 */
export function callRoomHints(
  runHeat: number,
  athletes: readonly HintAthlete[],
  checkIns: readonly CheckInFacts[],
  rows: readonly HintRow[],
): CallRoomHint[] {
  if (!checkIns.some((c) => c.runHeat === runHeat)) return [];

  const checkedInAt = new Map(checkIns.map((c) => [c.athleteNo, c.runHeat]));
  const rowStatus = new Map<number, RunStatus[]>();
  for (const r of rows) {
    if (r.athleteNo === null) continue;
    rowStatus.set(r.athleteNo, [
      ...(rowStatus.get(r.athleteNo) ?? []),
      r.status,
    ]);
  }
  const isFinisher = (no: number) =>
    (rowStatus.get(no) ?? []).some((s) => s !== "dns" && s !== "dnf");
  const markedDns = (no: number) => (rowStatus.get(no) ?? []).includes("dns");

  const hints: CallRoomHint[] = [];
  for (const a of [...athletes].sort((x, y) => x.athleteNo - y.athleteNo)) {
    const checkedHeat = checkedInAt.get(a.athleteNo);
    const rosteredHere = a.runHeat === runHeat;
    if (!rosteredHere && checkedHeat !== runHeat) continue;

    if (rosteredHere && checkedHeat === undefined) {
      if (!isFinisher(a.athleteNo) && !markedDns(a.athleteNo)) {
        hints.push({
          athleteNo: a.athleteNo,
          kind: "suggest-dns",
          message: "Not checked in — suggest DNS",
        });
      }
      continue;
    }
    if (checkedHeat === undefined) continue;

    if (checkedHeat !== a.runHeat) {
      hints.push({
        athleteNo: a.athleteNo,
        kind: "heat-mismatch",
        message: `Checked in at heat ${checkedHeat}, rostered in heat ${a.runHeat}`,
      });
    }
    if (checkedHeat === runHeat && !isFinisher(a.athleteNo)) {
      hints.push({
        athleteNo: a.athleteNo,
        kind: "checked-in-no-finish",
        message: "Checked in but no finish",
      });
    }
  }
  return hints;
}
