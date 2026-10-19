/**
 * The swim Call room's decisions: what happens when an athlete number is
 * scanned or typed at a swim heat, and the headline count. Swim check-ins
 * are information only: they never set or refuse a swim result, never
 * change a swim slot, and a swim heat is never Closed. Pure, so the screen
 * stays thin.
 */

/** An athlete entered in the League, and their swim slot when known. */
export interface SwimCallRoomEntry {
  athleteNo: number;
  fullName: string;
  swimHeat: number | null;
  swimLane: number | null;
}

/** A swim Checked in athlete and the swim heat they were checked in at. */
export interface SwimCheckInFacts {
  athleteNo: number;
  swimHeat: number;
}

export type SwimCheckInOutcome =
  /** Record the check-in. */
  | { kind: "checked-in"; athlete: SwimCallRoomEntry }
  /** Already Checked in at this swim heat; change nothing. */
  | { kind: "already-here"; athlete: SwimCallRoomEntry }
  /** Not on the League's Start list, so there is no entry to check in. */
  | { kind: "unknown"; athleteNo: number }
  /**
   * In another swim heat, or with no swim slot. Warn, and on confirm check
   * them in here without touching the swim slot. `movedFrom` is set when
   * they are also checked in at another swim heat, which the confirm moves.
   */
  | { kind: "other-heat"; athlete: SwimCallRoomEntry; movedFrom?: number }
  /** In this swim heat but checked in at another. Warn; confirm moves it. */
  | {
      kind: "checked-in-elsewhere";
      athlete: SwimCallRoomEntry;
      swimHeat: number;
    };

/** Whether the Caller has to confirm the outcome before it is applied. */
export function needsSwimConfirm(outcome: SwimCheckInOutcome) {
  return (
    outcome.kind === "other-heat" || outcome.kind === "checked-in-elsewhere"
  );
}

/** What checking in `athleteNo` at `swimHeat` should do. */
export function swimCheckIn(
  athleteNo: number,
  swimHeat: number,
  entries: readonly SwimCallRoomEntry[],
  checkIns: readonly SwimCheckInFacts[],
): SwimCheckInOutcome {
  const athlete = entries.find((e) => e.athleteNo === athleteNo);
  if (!athlete) return { kind: "unknown", athleteNo };
  const existing = checkIns.find((c) => c.athleteNo === athleteNo);
  if (existing?.swimHeat === swimHeat) return { kind: "already-here", athlete };
  if (athlete.swimHeat !== swimHeat) {
    return { kind: "other-heat", athlete, movedFrom: existing?.swimHeat };
  }
  if (!existing) return { kind: "checked-in", athlete };
  return {
    kind: "checked-in-elsewhere",
    athlete,
    swimHeat: existing.swimHeat,
  };
}

/** The message the Caller sees for an outcome. */
export function swimCheckInMessage(
  outcome: SwimCheckInOutcome,
  swimHeat: number,
) {
  switch (outcome.kind) {
    case "checked-in":
      return `Checked in: #${outcome.athlete.athleteNo} ${outcome.athlete.fullName}`;
    case "already-here":
      return `#${outcome.athlete.athleteNo} ${outcome.athlete.fullName} is already checked in.`;
    case "unknown":
      return `Athlete ${outcome.athleteNo} is not on the Start list.`;
    case "other-heat": {
      const { athleteNo, fullName, swimHeat: entered } = outcome.athlete;
      const where =
        entered === null
          ? `has no swim slot on the Start list`
          : `belongs to swim heat ${entered}, not swim heat ${swimHeat}`;
      return `#${athleteNo} ${fullName} ${where}.${
        outcome.movedFrom === undefined
          ? ""
          : ` They were checked in at swim heat ${outcome.movedFrom}.`
      }`;
    }
    case "checked-in-elsewhere":
      return `#${outcome.athlete.athleteNo} ${outcome.athlete.fullName} was checked in at swim heat ${outcome.swimHeat}.`;
  }
}

export interface SwimHeatRosterRow extends SwimCallRoomEntry {
  checkedIn: boolean;
}

export interface SwimCallRoomState {
  /** This swim heat's athletes, by lane. */
  roster: SwimHeatRosterRow[];
  /** Athletes of this swim heat Checked in at it. */
  checkedIn: number;
  rosterSize: number;
  /** Athletes Checked in here but in another swim heat or with none. */
  fromOtherHeats: number;
}

/** The swim heat's athletes with who is Checked in, and the "5 / 8"
 * headline. Athletes checked in here from elsewhere are counted apart. */
export function swimCallRoomState(
  swimHeat: number,
  entries: readonly SwimCallRoomEntry[],
  checkIns: readonly SwimCheckInFacts[],
): SwimCallRoomState {
  const here = new Set(
    checkIns.filter((c) => c.swimHeat === swimHeat).map((c) => c.athleteNo),
  );
  const roster = entries
    .filter((e) => e.swimHeat === swimHeat)
    .map((e) => ({ ...e, checkedIn: here.has(e.athleteNo) }))
    .sort(
      (a, b) =>
        (a.swimLane ?? 0) - (b.swimLane ?? 0) || a.athleteNo - b.athleteNo,
    );
  const inHeat = new Set(roster.map((r) => r.athleteNo));
  return {
    roster,
    checkedIn: roster.filter((r) => r.checkedIn).length,
    rosterSize: roster.length,
    fromOtherHeats: [...here].filter((no) => !inHeat.has(no)).length,
  };
}
