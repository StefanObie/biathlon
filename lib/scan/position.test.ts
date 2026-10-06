import { describe, expect, it } from "vitest";

import {
  nextPosition,
  positionRowAction,
  scanOutcome,
  needsConfirm,
  scanOutcomeMessage,
  type LeagueRosterAthlete,
  type OrganizationAthlete,
} from "./position";

describe("nextPosition", () => {
  it("starts a fresh heat at 1", () => {
    expect(nextPosition([])).toBe(1);
  });

  it("resumes one past the highest captured position", () => {
    expect(nextPosition([1, 2, 3])).toBe(4);
  });

  it("uses the max regardless of array order", () => {
    expect(nextPosition([3, 1, 2])).toBe(4);
  });

  it("still counts voided positions towards the max", () => {
    // Undo decrements the counter explicitly rather than being excluded
    // here — a voided row still occupied that position slot.
    expect(nextPosition([1, 2, 3, 3])).toBe(4);
  });
});

function capture(
  position: number,
  athleteNo: number | null,
  scannedAt: string,
  voided: { reason: string } | null = null,
) {
  return {
    id: `${position}-${scannedAt}`,
    position,
    athlete_no: athleteNo,
    scanned_at: `2026-09-29T10:00:${scannedAt}Z`,
    voided: voided !== null,
    void_reason: voided?.reason ?? null,
  };
}

describe("positionRowAction", () => {
  it("offers Undo on the highest active position", () => {
    const captures = [capture(1, 101, "01"), capture(2, 102, "02")];
    expect(positionRowAction(captures, captures[1])).toBe("undo");
    expect(positionRowAction(captures, captures[0])).toBeNull();
  });

  it("offers Fill on a Skip below the top", () => {
    const captures = [capture(1, null, "01"), capture(2, 102, "02")];
    expect(positionRowAction(captures, captures[0])).toBe("fill");
  });

  it("offers Undo fill on a Fill below the top", () => {
    const captures = [
      capture(1, null, "01", { reason: "filled" }),
      capture(2, 102, "02"),
      capture(1, 101, "03"),
    ];
    expect(positionRowAction(captures, captures[2])).toBe("undo-fill");
  });

  it("does not treat a later scan at an undone Fill's position as a Fill", () => {
    // #2 was a Skip, filled while it was the top row, then undone from the
    // top. The next finisher's scan reuses position 2.
    const captures = [
      capture(1, 101, "01"),
      capture(2, null, "02", { reason: "filled" }),
      capture(2, 102, "03", { reason: "operator undo" }),
      capture(2, 103, "04"),
      capture(3, 104, "05"),
    ];
    expect(positionRowAction(captures, captures[3])).toBeNull();
  });
});

describe("scanOutcome", () => {
  const roster: LeagueRosterAthlete[] = [
    { athleteNo: 101, fullName: "Jane Doe", runHeat: 1 },
    { athleteNo: 200, fullName: "Ann Poe", runHeat: 2 },
  ];
  const athletes: OrganizationAthlete[] = [
    { athleteNo: 101, fullName: "Jane Doe" },
    { athleteNo: 200, fullName: "Ann Poe" },
    { athleteNo: 6918, fullName: "Sam Late" },
  ];

  it("records an athlete rostered in this heat", () => {
    const outcome = scanOutcome(101, 1, roster, athletes, []);
    expect(outcome).toEqual({ kind: "record", athlete: roster[0] });
    expect(needsConfirm(outcome)).toBe(false);
    expect(scanOutcomeMessage(outcome)).toBeNull();
  });

  it("refuses an athlete already captured in this heat", () => {
    const outcome = scanOutcome(101, 1, roster, athletes, [
      capture(1, 101, "01"),
    ]);
    expect(outcome.kind).toBe("already-captured");
    expect(scanOutcomeMessage(outcome)).toBe(
      "Athlete 101 Jane Doe is already captured in this heat.",
    );
  });

  it("records again an athlete whose capture was voided", () => {
    const outcome = scanOutcome(101, 1, roster, athletes, [
      capture(1, 101, "01", { reason: "operator undo" }),
    ]);
    expect(outcome.kind).toBe("record");
  });

  it("asks to confirm an athlete rostered in another heat", () => {
    const outcome = scanOutcome(200, 1, roster, athletes, []);
    expect(outcome).toEqual({ kind: "other-heat", athlete: roster[1] });
    expect(needsConfirm(outcome)).toBe(true);
  });

  it("asks to confirm an athlete of the Organization not on the Start list", () => {
    const outcome = scanOutcome(6918, 1, roster, athletes, []);
    expect(outcome).toEqual({
      kind: "not-on-start-list",
      athlete: { athleteNo: 6918, fullName: "Sam Late" },
    });
    expect(needsConfirm(outcome)).toBe(true);
  });

  it("refuses an athlete not on the Start list who is already captured", () => {
    const outcome = scanOutcome(6918, 1, roster, athletes, [
      capture(1, 6918, "01"),
    ]);
    expect(scanOutcomeMessage(outcome)).toBe(
      "Athlete 6918 Sam Late is already captured in this heat.",
    );
  });

  it("rejects a number that belongs to no athlete of the Organization", () => {
    const outcome = scanOutcome(999, 1, roster, athletes, []);
    expect(outcome).toEqual({ kind: "unknown", athleteNo: 999 });
    expect(scanOutcomeMessage(outcome)).toBe(
      "Athlete 999 is not an athlete of this organization.",
    );
  });
});
