import { describe, expect, it } from "vitest";

import { nextPosition, positionRowAction } from "./position";

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
