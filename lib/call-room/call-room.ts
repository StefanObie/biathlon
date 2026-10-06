/**
 * The Call room screen's decisions (#41): what happens when an athlete
 * number is scanned or typed, and the headline count. Pure, so the screen
 * stays thin.
 */

/** An athlete of the League's Organization, on the Start list or not. */
export interface OrganizationAthlete {
  athleteNo: number;
  fullName: string;
}

/** An athlete entered in the League, and the heat they're rostered in. */
export interface CallRoomEntry extends OrganizationAthlete {
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
  /**
   * An athlete of the Organization who isn't on the Start list. Warn, and on
   * confirm add them as a Late entry in this heat and check them in.
   */
  | { kind: "not-on-start-list"; athlete: OrganizationAthlete }
  /** No athlete of the Organization has this number. */
  | { kind: "unknown"; athleteNo: number }
  /**
   * Rostered in another heat. Warn, and on confirm check them in here
   * without touching the roster. `movedFrom` is set when they are also
   * checked in at another heat, which the confirm moves.
   */
  | { kind: "other-heat"; athlete: CallRoomEntry; movedFrom?: number }
  /** Rostered here but checked in at another heat. Warn; confirm moves it. */
  | { kind: "checked-in-elsewhere"; athlete: CallRoomEntry; runHeat: number };

/** Whether the Caller has to confirm the outcome before it is applied. */
export function needsConfirm(outcome: CheckInOutcome) {
  return (
    outcome.kind === "other-heat" ||
    outcome.kind === "checked-in-elsewhere" ||
    outcome.kind === "not-on-start-list"
  );
}

/** What checking in `athleteNo` at `runHeat` should do. */
export function checkIn(
  athleteNo: number,
  runHeat: number,
  entries: readonly CallRoomEntry[],
  athletes: readonly OrganizationAthlete[],
  checkIns: readonly CheckInFacts[],
): CheckInOutcome {
  const athlete = entries.find((e) => e.athleteNo === athleteNo);
  if (!athlete) {
    const known = athletes.find((a) => a.athleteNo === athleteNo);
    return known
      ? { kind: "not-on-start-list", athlete: known }
      : { kind: "unknown", athleteNo };
  }
  const existing = checkIns.find((c) => c.athleteNo === athleteNo);
  if (existing?.runHeat === runHeat) return { kind: "already-here", athlete };
  if (athlete.runHeat !== runHeat) {
    return { kind: "other-heat", athlete, movedFrom: existing?.runHeat };
  }
  if (!existing) return { kind: "checked-in", athlete };
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
    case "not-on-start-list":
      return `#${outcome.athlete.athleteNo} ${outcome.athlete.fullName} is not on the Start list. Add them to heat ${runHeat}?`;
    case "unknown":
      return `Athlete ${outcome.athleteNo} is not an athlete of this organization.`;
    case "other-heat":
      return `#${outcome.athlete.athleteNo} ${outcome.athlete.fullName} belongs to heat ${outcome.athlete.runHeat}, not heat ${runHeat}.${
        outcome.movedFrom === undefined
          ? ""
          : ` They were checked in at heat ${outcome.movedFrom}.`
      }`;
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
  /** Athletes Checked in here but rostered in another heat. */
  fromOtherHeats: number;
}

/** The heat roster with who is Checked in, and the "14 / 20" headline.
 * The "14" counts rostered athletes only; athletes checked in here from
 * other heats are counted apart, for "+2 from other heats". */
export function callRoomState(
  runHeat: number,
  entries: readonly CallRoomEntry[],
  checkIns: readonly CheckInFacts[],
): CallRoomState {
  const here = new Set(
    checkIns.filter((c) => c.runHeat === runHeat).map((c) => c.athleteNo),
  );
  const rostered = new Set(
    entries.filter((e) => e.runHeat === runHeat).map((e) => e.athleteNo),
  );
  const roster = entries
    .filter((e) => e.runHeat === runHeat)
    .map((e) => ({ ...e, checkedIn: here.has(e.athleteNo) }))
    .sort((a, b) => a.athleteNo - b.athleteNo);
  return {
    roster,
    checkedIn: roster.filter((r) => r.checkedIn).length,
    rosterSize: roster.length,
    fromOtherHeats: [...here].filter((no) => !rostered.has(no)).length,
  };
}
