import { describe, expect, it } from "vitest";

import { computePoints, type PointsRow } from "./points";

// Boys U/15 from Age Group & Points Table 2027 (1).pdf: 2 min 47 run,
// 1 min 13 swim, 2 and 5 points per second.
const boysU15: PointsRow = {
  run_base_time: "02:47.00",
  run_points_per_second: 2,
  swim_base_time: "01:13.00",
  swim_points_per_second: 5,
};

describe("computePoints — the PDF's worked example", () => {
  // Expected values are the PDF's own, not recomputed here.
  it.each([
    ["02:29.05", "01:01.03", 1035.9, 1059.85, 2095.75],
    ["02:45.00", "01:13.00", 1004.0, 1000.0, 2004.0],
    ["02:47.00", "01:19.51", 1000.0, 967.45, 1967.45],
  ])("run %s, swim %s", (run, swim, runPoints, swimPoints, total) => {
    const points = computePoints(run, swim, boysU15);
    expect(points.run).toBeCloseTo(runPoints, 2);
    expect(points.swim).toBeCloseTo(swimPoints, 2);
    expect(points.total).toBeCloseTo(total, 2);
  });

  it("scores the swim in the PDF's last row", () => {
    expect(computePoints(null, "01:25.12", boysU15).swim).toBeCloseTo(939.4, 2);
  });

  it("follows the formula, not the PDF's typo, for 02:48.52", () => {
    // The PDF prints 988.96, which is the score for 02:52.52. 1.52 s slower
    // at 2 points a second is 3.04 points off.
    expect(computePoints("02:48.52", null, boysU15).run).toBeCloseTo(996.96, 2);
  });
});

describe("computePoints — one component missing", () => {
  it("leaves swim empty and makes the total the run points", () => {
    expect(computePoints("02:45.00", null, boysU15)).toEqual({
      run: 1004,
      swim: null,
      total: 1004,
    });
  });

  it("leaves run empty and makes the total the swim points", () => {
    expect(computePoints(null, "01:13.00", boysU15)).toEqual({
      run: null,
      swim: 1000,
      total: 1000,
    });
  });

  it("has no total with neither time", () => {
    expect(computePoints(null, null, boysU15)).toEqual({
      run: null,
      swim: null,
      total: null,
    });
  });
});

describe("computePoints — U/13 swimming 50 m", () => {
  // PDF: adjustment is 10 points per second, carried in the row.
  const boysU13: PointsRow = {
    run_base_time: "03:00.00",
    run_points_per_second: 2,
    swim_base_time: "00:36.00",
    swim_points_per_second: 10,
  };

  it("uses the row's swim rate", () => {
    expect(computePoints(null, "00:34.50", boysU13).swim).toBeCloseTo(1015, 2);
  });
});
