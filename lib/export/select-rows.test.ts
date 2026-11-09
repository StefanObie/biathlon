import { describe, expect, it } from "vitest";

import {
  selectExportRows,
  type ExportEntry,
  type ExportRun,
  type ExportSwim,
} from "./select-rows";

const entry = (athleteNo: number, runHeat: number): ExportEntry => ({
  athleteNo,
  runHeat,
  fullName: `Athlete ${athleteNo}`,
});

const swim = (athleteNo: number, swimTime = "00:56.12"): ExportSwim => ({
  athleteNo,
  swimTime,
  status: "ok",
});

const run = (
  athleteNo: number,
  runHeat: number,
  runTime: string | null = "01:47.03",
  status = "ok",
): ExportRun => ({ athleteNo, runHeat, runTime, status });

describe("selectExportRows", () => {
  it("exports athletes whose heat is closed", () => {
    const result = selectExportRows({
      entries: [entry(1, 1), entry(2, 1)],
      swims: [swim(1), swim(2)],
      runs: [run(1, 1), run(2, 1)],
      closedHeats: new Set([1]),
    });

    expect(result.rows.map((row) => row.athleteNo)).toEqual([1, 2]);
    expect(result.rows[0]).toMatchObject({
      athleteNo: 1,
      fullName: "Athlete 1",
      swimTime: "00:56.12",
      runTime: "01:47.03",
      runHeat: 1,
      swimStatus: "ok",
      runStatus: "ok",
      ranInHeat: null,
      otherRunHeats: [],
    });
    expect(result.openHeatAthleteCount).toBe(0);
    expect(result.openHeats).toEqual([]);
  });

  it("leaves out athletes in open heats and counts them separately", () => {
    const result = selectExportRows({
      entries: [entry(1, 1), entry(2, 2), entry(3, 3), entry(4, 3)],
      swims: [swim(1), swim(2), swim(3), swim(4)],
      runs: [run(1, 1), run(2, 2)],
      closedHeats: new Set([1]),
    });

    expect(result.rows.map((row) => row.athleteNo)).toEqual([1]);
    expect(result.openHeatAthleteCount).toBe(3);
    expect(result.openHeats).toEqual([2, 3]);
    expect(result.excludedCount).toBe(0);
  });

  it("leaves out a reopened heat even though it has saved results", () => {
    // Heat 2 was saved (run_result rows exist) and then reopened, so it is
    // no longer in the closed set.
    const result = selectExportRows({
      entries: [entry(1, 1), entry(2, 2)],
      swims: [],
      runs: [run(1, 1), run(2, 2)],
      closedHeats: new Set([1]),
    });

    expect(result.rows.map((row) => row.athleteNo)).toEqual([1]);
    expect(result.openHeatAthleteCount).toBe(1);
    expect(result.openHeats).toEqual([2]);
  });

  it("leaves out a swim-only athlete whose heat is open", () => {
    const result = selectExportRows({
      entries: [entry(1, 2)],
      swims: [swim(1)],
      runs: [],
      closedHeats: new Set(),
    });

    expect(result.rows).toEqual([]);
    expect(result.openHeatAthleteCount).toBe(1);
  });

  it("still excludes athletes with no swim and no run in a closed heat", () => {
    const result = selectExportRows({
      entries: [entry(1, 1), entry(2, 1)],
      swims: [swim(1)],
      runs: [],
      closedHeats: new Set([1]),
    });

    expect(result.rows.map((row) => row.athleteNo)).toEqual([1]);
    expect(result.rows[0].runTime).toBeNull();
    expect(result.excludedCount).toBe(1);
    expect(result.openHeatAthleteCount).toBe(0);
  });

  it("uses the roster heat's run and lists the other heats", () => {
    const result = selectExportRows({
      entries: [entry(1, 1)],
      swims: [],
      runs: [run(1, 3, "02:10.00"), run(1, 1, "01:47.03")],
      closedHeats: new Set([1, 3]),
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].runTime).toBe("01:47.03");
    expect(result.rows[0]).toMatchObject({
      ranInHeat: null,
      otherRunHeats: [3],
    });
  });

  it("exports an Off-roster run and says which heat it came from", () => {
    const result = selectExportRows({
      entries: [entry(1, 1)],
      swims: [],
      runs: [run(1, 7, "02:10.00")],
      closedHeats: new Set([1, 7]),
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      runTime: "02:10.00",
      runHeat: 1,
      ranInHeat: 7,
      otherRunHeats: [],
    });
    expect(result.excludedCount).toBe(0);
  });

  it("uses the lowest-numbered heat when no run is in the roster heat", () => {
    const result = selectExportRows({
      entries: [entry(1, 1)],
      swims: [],
      runs: [run(1, 7, "02:10.00"), run(1, 5, "01:59.00")],
      closedHeats: new Set([1, 5, 7]),
    });

    expect(result.rows[0]).toMatchObject({
      runTime: "01:59.00",
      ranInHeat: 5,
      otherRunHeats: [7],
    });
  });

  it("lets an ok Off-roster run beat a DNS in the roster heat", () => {
    const result = selectExportRows({
      entries: [entry(1, 1)],
      swims: [],
      runs: [run(1, 1, null, "dns"), run(1, 7, "02:10.00")],
      closedHeats: new Set([1, 7]),
    });

    expect(result.rows[0]).toMatchObject({
      runTime: "02:10.00",
      runStatus: "ok",
      ranInHeat: 7,
      otherRunHeats: [1],
    });
  });

  it("still exports a DQ when it is the athlete's only Run result", () => {
    const result = selectExportRows({
      entries: [entry(1, 1)],
      swims: [swim(1)],
      runs: [run(1, 1, "01:47.03", "dq")],
      closedHeats: new Set([1]),
    });

    expect(result.rows[0]).toMatchObject({ runStatus: "dq", ranInHeat: null });
  });

  it("exports an Off-roster run while the roster heat is still open", () => {
    const result = selectExportRows({
      entries: [entry(1, 1)],
      swims: [],
      runs: [run(1, 7, "02:10.00")],
      closedHeats: new Set([7]),
    });

    expect(result.rows[0]).toMatchObject({ runTime: "02:10.00", ranInHeat: 7 });
    expect(result.openHeatAthleteCount).toBe(0);
    expect(result.openHeats).toEqual([]);
  });

  it("does not count an ok Run result that has no time", () => {
    const result = selectExportRows({
      entries: [entry(1, 1)],
      swims: [],
      runs: [run(1, 1, null, "ok"), run(1, 7, "02:10.00")],
      closedHeats: new Set([1, 7]),
    });

    expect(result.rows[0]).toMatchObject({ runTime: "02:10.00", ranInHeat: 7 });
  });
});
