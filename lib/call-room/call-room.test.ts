import { describe, expect, it } from "vitest";

import {
  callRoomState,
  checkIn,
  checkInMessage,
  needsConfirm,
  type CallRoomEntry,
  type OrganizationAthlete,
} from "./call-room";

const entries: CallRoomEntry[] = [
  { athleteNo: 123, fullName: "Jane Doe", runHeat: 1 },
  { athleteNo: 124, fullName: "John Roe", runHeat: 1 },
  { athleteNo: 200, fullName: "Ann Poe", runHeat: 2 },
];

const athletes: OrganizationAthlete[] = [
  ...entries.map(({ athleteNo, fullName }) => ({ athleteNo, fullName })),
  { athleteNo: 6918, fullName: "Late Comer" },
];

describe("checkIn", () => {
  it("checks in a rostered athlete", () => {
    const outcome = checkIn(123, 1, entries, athletes, []);
    expect(outcome.kind).toBe("checked-in");
    expect(checkInMessage(outcome, 1)).toBe("Checked in: #123 Jane Doe");
  });

  it("says so when the athlete is already checked in here", () => {
    const outcome = checkIn(123, 1, entries, athletes, [
      { athleteNo: 123, runHeat: 1 },
    ]);
    expect(outcome.kind).toBe("already-here");
    expect(checkInMessage(outcome, 1)).toBe(
      "#123 Jane Doe is already checked in.",
    );
  });

  it("rejects a number that belongs to no athlete of the Organization", () => {
    const outcome = checkIn(999, 1, entries, athletes, []);
    expect(outcome).toEqual({ kind: "unknown", athleteNo: 999 });
    expect(needsConfirm(outcome)).toBe(false);
    expect(checkInMessage(outcome, 1)).toBe(
      "Athlete 999 is not an athlete of this organization.",
    );
  });

  it("warns about an athlete of the Organization not on the Start list", () => {
    const outcome = checkIn(6918, 3, entries, athletes, []);
    expect(outcome).toEqual({
      kind: "not-on-start-list",
      athlete: { athleteNo: 6918, fullName: "Late Comer" },
    });
    expect(needsConfirm(outcome)).toBe(true);
    expect(checkInMessage(outcome, 3)).toBe(
      "#6918 Late Comer is not on the Start list. Add them to heat 3?",
    );
  });

  it("warns about an athlete rostered in another heat", () => {
    const outcome = checkIn(200, 1, entries, athletes, []);
    expect(outcome.kind).toBe("other-heat");
    expect(needsConfirm(outcome)).toBe(true);
    expect(checkInMessage(outcome, 1)).toBe(
      "#200 Ann Poe belongs to heat 2, not heat 1.",
    );
  });

  it("warns about an athlete already checked in at another heat", () => {
    const outcome = checkIn(123, 1, entries, athletes, [
      { athleteNo: 123, runHeat: 2 },
    ]);
    expect(outcome.kind).toBe("checked-in-elsewhere");
    expect(needsConfirm(outcome)).toBe(true);
    expect(checkInMessage(outcome, 1)).toBe(
      "#123 Jane Doe was checked in at heat 2.",
    );
  });

  it("warns of both when a wrong-heat athlete is checked in elsewhere", () => {
    const outcome = checkIn(200, 1, entries, athletes, [
      { athleteNo: 200, runHeat: 3 },
    ]);
    expect(outcome).toMatchObject({ kind: "other-heat", movedFrom: 3 });
    expect(checkInMessage(outcome, 1)).toBe(
      "#200 Ann Poe belongs to heat 2, not heat 1. They were checked in at heat 3.",
    );
  });

  it("says already checked in for a wrong-heat athlete checked in here", () => {
    const outcome = checkIn(200, 1, entries, athletes, [
      { athleteNo: 200, runHeat: 1 },
    ]);
    expect(outcome.kind).toBe("already-here");
  });

  it("needs no confirm for a plain check-in", () => {
    expect(needsConfirm(checkIn(123, 1, entries, athletes, []))).toBe(false);
  });
});

describe("callRoomState", () => {
  it("counts the rostered athletes checked in here over the roster size", () => {
    const state = callRoomState(1, entries, [{ athleteNo: 124, runHeat: 1 }]);
    expect(state.checkedIn).toBe(1);
    expect(state.rosterSize).toBe(2);
    expect(state.roster).toEqual([
      { ...entries[0], checkedIn: false },
      { ...entries[1], checkedIn: true },
    ]);
  });

  it("doesn't count check-ins at other heats", () => {
    const state = callRoomState(1, entries, [
      { athleteNo: 123, runHeat: 2 },
      { athleteNo: 200, runHeat: 1 },
    ]);
    expect(state.checkedIn).toBe(0);
    expect(state.rosterSize).toBe(2);
    expect(state.fromOtherHeats).toBe(1);
  });

  it("counts athletes checked in here from other heats apart", () => {
    const state = callRoomState(1, entries, [
      { athleteNo: 123, runHeat: 1 },
      { athleteNo: 200, runHeat: 1 },
    ]);
    expect(state.checkedIn).toBe(1);
    expect(state.rosterSize).toBe(2);
    expect(state.fromOtherHeats).toBe(1);
  });
});
