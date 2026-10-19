import { describe, expect, it } from "vitest";

import {
  needsSwimConfirm,
  swimCallRoomState,
  swimCheckIn,
  swimCheckInMessage,
  type SwimCallRoomEntry,
} from "./swim-call-room";

const entries: SwimCallRoomEntry[] = [
  { athleteNo: 123, fullName: "Jane Doe", swimHeat: 1, swimLane: 2 },
  { athleteNo: 124, fullName: "John Roe", swimHeat: 1, swimLane: 1 },
  { athleteNo: 200, fullName: "Ann Poe", swimHeat: 2, swimLane: 1 },
  { athleteNo: 300, fullName: "Late Comer", swimHeat: null, swimLane: null },
];

describe("swimCheckIn", () => {
  it("checks in an athlete of the swim heat", () => {
    const outcome = swimCheckIn(123, 1, entries, []);
    expect(outcome.kind).toBe("checked-in");
    expect(needsSwimConfirm(outcome)).toBe(false);
    expect(swimCheckInMessage(outcome, 1)).toBe("Checked in: #123 Jane Doe");
  });

  it("says so when the athlete is already checked in here", () => {
    const outcome = swimCheckIn(123, 1, entries, [
      { athleteNo: 123, swimHeat: 1 },
    ]);
    expect(outcome.kind).toBe("already-here");
  });

  it("rejects a number that isn't on the Start list", () => {
    const outcome = swimCheckIn(999, 1, entries, []);
    expect(outcome).toEqual({ kind: "unknown", athleteNo: 999 });
    expect(swimCheckInMessage(outcome, 1)).toBe(
      "Athlete 999 is not on the Start list.",
    );
  });

  it("warns about an athlete of another swim heat", () => {
    const outcome = swimCheckIn(200, 1, entries, []);
    expect(outcome.kind).toBe("other-heat");
    expect(needsSwimConfirm(outcome)).toBe(true);
    expect(swimCheckInMessage(outcome, 1)).toBe(
      "#200 Ann Poe belongs to swim heat 2, not swim heat 1.",
    );
  });

  it("warns about an athlete with no swim slot", () => {
    const outcome = swimCheckIn(300, 1, entries, []);
    expect(outcome.kind).toBe("other-heat");
    expect(swimCheckInMessage(outcome, 1)).toBe(
      "#300 Late Comer has no swim slot on the Start list.",
    );
  });

  it("warns about an athlete already checked in at another swim heat", () => {
    const outcome = swimCheckIn(123, 1, entries, [
      { athleteNo: 123, swimHeat: 2 },
    ]);
    expect(outcome.kind).toBe("checked-in-elsewhere");
    expect(needsSwimConfirm(outcome)).toBe(true);
    expect(swimCheckInMessage(outcome, 1)).toBe(
      "#123 Jane Doe was checked in at swim heat 2.",
    );
  });

  it("warns of both when an athlete of another heat is checked in elsewhere", () => {
    const outcome = swimCheckIn(200, 1, entries, [
      { athleteNo: 200, swimHeat: 3 },
    ]);
    expect(swimCheckInMessage(outcome, 1)).toBe(
      "#200 Ann Poe belongs to swim heat 2, not swim heat 1. They were checked in at swim heat 3.",
    );
  });
});

describe("swimCallRoomState", () => {
  it("lists the swim heat's athletes by lane", () => {
    const { roster } = swimCallRoomState(1, entries, []);
    expect(roster.map((r) => r.athleteNo)).toEqual([124, 123]);
  });

  it("counts athletes of the heat checked in here over its size", () => {
    const state = swimCallRoomState(1, entries, [
      { athleteNo: 123, swimHeat: 1 },
      { athleteNo: 124, swimHeat: 2 },
    ]);
    expect(state.checkedIn).toBe(1);
    expect(state.rosterSize).toBe(2);
    expect(state.roster.find((r) => r.athleteNo === 123)?.checkedIn).toBe(true);
  });

  it("counts athletes checked in here from elsewhere apart", () => {
    const state = swimCallRoomState(1, entries, [
      { athleteNo: 200, swimHeat: 1 },
      { athleteNo: 300, swimHeat: 1 },
    ]);
    expect(state.checkedIn).toBe(0);
    expect(state.fromOtherHeats).toBe(2);
  });
});
