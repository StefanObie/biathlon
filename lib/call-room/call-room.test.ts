import { describe, expect, it } from "vitest";

import {
  callRoomState,
  checkIn,
  checkInMessage,
  type CallRoomEntry,
} from "./call-room";

const entries: CallRoomEntry[] = [
  { athleteNo: 123, fullName: "Jane Doe", runHeat: 1 },
  { athleteNo: 124, fullName: "John Roe", runHeat: 1 },
  { athleteNo: 200, fullName: "Ann Poe", runHeat: 2 },
];

describe("checkIn", () => {
  it("checks in a rostered athlete", () => {
    const outcome = checkIn(123, 1, entries, []);
    expect(outcome.kind).toBe("checked-in");
    expect(checkInMessage(outcome, 1)).toBe("Checked in: #123 Jane Doe");
  });

  it("says so when the athlete is already checked in here", () => {
    const outcome = checkIn(123, 1, entries, [{ athleteNo: 123, runHeat: 1 }]);
    expect(outcome.kind).toBe("already-here");
    expect(checkInMessage(outcome, 1)).toBe(
      "#123 Jane Doe is already checked in.",
    );
  });

  it("rejects an athlete number not entered in the League", () => {
    const outcome = checkIn(999, 1, entries, []);
    expect(outcome).toEqual({ kind: "unknown", athleteNo: 999 });
    expect(checkInMessage(outcome, 1)).toBe(
      "Athlete 999 is not entered in this league.",
    );
  });

  it("rejects an athlete rostered in another heat", () => {
    const outcome = checkIn(200, 1, entries, []);
    expect(outcome.kind).toBe("other-heat");
    expect(checkInMessage(outcome, 1)).toBe(
      "#200 Ann Poe belongs to heat 2, not heat 1.",
    );
  });

  it("rejects an athlete already checked in at another heat", () => {
    const outcome = checkIn(123, 1, entries, [{ athleteNo: 123, runHeat: 2 }]);
    expect(outcome.kind).toBe("checked-in-elsewhere");
    expect(checkInMessage(outcome, 1)).toBe(
      "#123 Jane Doe was checked in at heat 2.",
    );
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
  });
});
