import { describe, expect, it } from "vitest";

import { fillToastMessage } from "./fill-toast";

const names = new Map([[123, "Jane Doe"]]);
const known = [
  { position: 4, athlete_no: 101, voided: false },
  { position: 5, athlete_no: null, voided: false },
  { position: 6, athlete_no: 102, voided: false },
];

describe("fillToastMessage", () => {
  it("names the position and athlete when a Skip is filled", () => {
    expect(
      fillToastMessage(
        { run_heat: 2, position: 5, athlete_no: 123, voided: false },
        { runHeat: 2, known, names },
      ),
    ).toBe("Position #5 was filled with 123 Jane Doe — refresh to load it.");
  });

  it("ignores a capture at a new position", () => {
    expect(
      fillToastMessage(
        { run_heat: 2, position: 7, athlete_no: 123, voided: false },
        { runHeat: 2, known, names },
      ),
    ).toBeNull();
  });

  it("ignores a capture from another heat", () => {
    expect(
      fillToastMessage(
        { run_heat: 3, position: 5, athlete_no: 123, voided: false },
        { runHeat: 2, known, names },
      ),
    ).toBeNull();
  });

  it("names the athlete by number alone when their name is unknown", () => {
    expect(
      fillToastMessage(
        { run_heat: 2, position: 5, athlete_no: 999, voided: false },
        { runHeat: 2, known, names },
      ),
    ).toBe("Position #5 was filled with 999 — refresh to load it.");
  });
});
