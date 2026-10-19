import { describe, expect, it } from "vitest";

import { computePoints, type PointsRow } from "./points";

// Boys U/15 from Age Group & Points Table 2027 (1).pdf: 2 min 47 run,
// 1 min 13 swim, 2 and 5 points per second.
const boysU15: PointsRow = {
  run_base_time: "02:47.00",
  run_points_per_second: 2,
  swim_distance_m: 100,
  swim_base_time: "01:13.00",
  swim_points_per_second: 5,
  short_course_seconds_per_turn: 0.8,
};

// The PDF's examples are long course, so they swim in a 50 m pool.

describe("computePoints — the PDF's worked example", () => {
  // Expected values are the PDF's own, not recomputed here.
  it.each([
    ["02:29.05", "01:01.03", 1035.9, 1059.85, 2095.75],
    ["02:45.00", "01:13.00", 1004.0, 1000.0, 2004.0],
    ["02:47.00", "01:19.51", 1000.0, 967.45, 1967.45],
  ])("run %s, swim %s", (run, swim, runPoints, swimPoints, total) => {
    const points = computePoints(run, swim, boysU15, 50);
    expect(points.run).toBeCloseTo(runPoints, 2);
    expect(points.swim).toBeCloseTo(swimPoints, 2);
    expect(points.total).toBeCloseTo(total, 2);
  });

  it("scores the swim in the PDF's last row", () => {
    expect(computePoints(null, "01:25.12", boysU15, 50).swim).toBeCloseTo(
      939.4,
      2,
    );
  });

  it("follows the formula, not the PDF's typo, for 02:48.52", () => {
    // The PDF prints 988.96, which is the score for 02:52.52. 1.52 s slower
    // at 2 points a second is 3.04 points off.
    expect(computePoints("02:48.52", null, boysU15, 50).run).toBeCloseTo(
      996.96,
      2,
    );
  });
});

describe("computePoints — one component missing", () => {
  it("leaves swim empty and makes the total the run points", () => {
    expect(computePoints("02:45.00", null, boysU15, 50)).toEqual({
      run: 1004,
      swim: null,
      total: 1004,
    });
  });

  it("leaves run empty and makes the total the swim points", () => {
    expect(computePoints(null, "01:13.00", boysU15, 50)).toEqual({
      run: null,
      swim: 1000,
      total: 1000,
    });
  });

  it("has no total with neither time", () => {
    expect(computePoints(null, null, boysU15, 50)).toEqual({
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
    swim_distance_m: 50,
    swim_base_time: "00:36.00",
    swim_points_per_second: 10,
    short_course_seconds_per_turn: 0.8,
  };

  it("uses the row's swim rate", () => {
    expect(computePoints(null, "00:34.50", boysU13, 50).swim).toBeCloseTo(
      1015,
      2,
    );
  });
});

describe("computePoints — Short course adjustment (#70)", () => {
  // SA Biathlon's 2027 rule: 0.8 s per turn a 25 m pool adds over a 50 m
  // pool. Expected points are the ones SA Biathlon published, not recomputed.
  const row = (
    swim_distance_m: number,
    swim_points_per_second: number,
  ): PointsRow => ({
    run_base_time: "03:00.00",
    run_points_per_second: 2,
    swim_distance_m,
    swim_base_time: "01:00.00",
    swim_points_per_second,
    short_course_seconds_per_turn: 0.8,
  });

  it.each([
    ["50 m swimmers", 50, 5, 996],
    ["100 m swimmers", 100, 5, 992],
    ["U/13 swimmers over 50 m", 50, 10, 992],
    ["25 m swimmers, who make no turns", 25, 5, 1000],
  ])("in a 25 m pool, adjusts %s", (_, distance, rate, swimPoints) => {
    const points = computePoints(null, "01:00.00", row(distance, rate), 25);
    expect(points.swim).toBeCloseTo(swimPoints, 2);
    expect(points.total).toBeCloseTo(swimPoints, 2);
  });

  it("leaves a swim in a 50 m pool as it is", () => {
    expect(computePoints(null, "01:00.00", row(100, 5), 50).swim).toBe(1000);
  });

  it("leaves the run as it is", () => {
    expect(computePoints("03:00.00", null, row(100, 5), 25).run).toBe(1000);
  });

  it("leaves swim empty with no swim time", () => {
    expect(computePoints(null, null, row(100, 5), 25).swim).toBeNull();
  });
});
