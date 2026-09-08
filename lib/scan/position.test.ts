import { describe, expect, it } from "vitest";

import { nextPosition } from "./position";

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
