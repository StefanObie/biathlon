/**
 * The Call room screen's decisions (#41): what happens when an athlete
 * number is scanned or typed, and the headline count. Pure, so the screen
 * stays thin.
 */

/** An athlete entered in the League, and the heat they're rostered in. */
export interface CallRoomEntry {
  athleteNo: number;
  fullName: string;
  runHeat: number;
}

/** A Checked in athlete and the heat they were checked in at. */
export interface CheckInFacts {
  athleteNo: number;
  runHeat: number;
}

export type CheckInOutcome =
  /** Record the check-in. */
  | { kind: "checked-in"; athlete: CallRoomEntry }
  /** Already Checked in at this heat; change nothing. */
  | { kind: "already-here"; athlete: CallRoomEntry }
  /** Not entered in the League. */
  | { kind: "unknown"; athleteNo: number }
  /** Rostered in another heat. Rejected until the warn-and-confirm flow. */
  | { kind: "other-heat"; athlete: CallRoomEntry }
  /** Checked in at another heat. Rejected until the warn-and-confirm flow. */
  | { kind: "checked-in-elsewhere"; athlete: CallRoomEntry; runHeat: number };

/** What checking in `athleteNo` at `runHeat` should do. */
export function checkIn(
  athleteNo: number,
  runHeat: number,
  entries: readonly CallRoomEntry[],
  checkIns: readonly CheckInFacts[],
): CheckInOutcome {
  const athlete = entries.find((e) => e.athleteNo === athleteNo);
  if (!athlete) return { kind: "unknown", athleteNo };
  if (athlete.runHeat !== runHeat) return { kind: "other-heat", athlete };
  const existing = checkIns.find((c) => c.athleteNo === athleteNo);
  if (!existing) return { kind: "checked-in", athlete };
  if (existing.runHeat === runHeat) return { kind: "already-here", athlete };
  return {
    kind: "checked-in-elsewhere",
    athlete,
    runHeat: existing.runHeat,
  };
}

/** The message the Caller sees for an outcome. */
export function checkInMessage(outcome: CheckInOutcome, runHeat: number) {
  switch (outcome.kind) {
    case "checked-in":
      return `Checked in: #${outcome.athlete.athleteNo} ${outcome.athlete.fullName}`;
    case "already-here":
      return `#${outcome.athlete.athleteNo} ${outcome.athlete.fullName} is already checked in.`;
    case "unknown":
      return `Athlete ${outcome.athleteNo} is not entered in this league.`;
    case "other-heat":
      return `#${outcome.athlete.athleteNo} ${outcome.athlete.fullName} belongs to heat ${outcome.athlete.runHeat}, not heat ${runHeat}.`;
    case "checked-in-elsewhere":
      return `#${outcome.athlete.athleteNo} ${outcome.athlete.fullName} was checked in at heat ${outcome.runHeat}.`;
  }
}

export interface HeatRosterRow extends CallRoomEntry {
  checkedIn: boolean;
}

export interface CallRoomState {
  /** This heat's roster, by athlete number. */
  roster: HeatRosterRow[];
  /** Rostered athletes Checked in at this heat. */
  checkedIn: number;
  rosterSize: number;
}

/** The heat roster with who is Checked in, and the "14 / 20" headline.
 * Only rostered athletes are counted. */
export function callRoomState(
  runHeat: number,
  entries: readonly CallRoomEntry[],
  checkIns: readonly CheckInFacts[],
): CallRoomState {
  const here = new Set(
    checkIns.filter((c) => c.runHeat === runHeat).map((c) => c.athleteNo),
  );
  const roster = entries
    .filter((e) => e.runHeat === runHeat)
    .map((e) => ({ ...e, checkedIn: here.has(e.athleteNo) }))
    .sort((a, b) => a.athleteNo - b.athleteNo);
  return {
    roster,
    checkedIn: roster.filter((r) => r.checkedIn).length,
    rosterSize: roster.length,
  };
}
