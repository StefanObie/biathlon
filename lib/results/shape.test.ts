import { describe, expect, it } from "vitest";

import {
  shapeResults,
  type ResultsAthleteRow,
  type ResultsPointsRow,
} from "./shape";

const boysU15: ResultsPointsRow = {
  gender: "M",
  age_group_code: "U15",
  age_group_label: "Under 15",
  sort_order: 5,
  run_base_time: "02:47.00",
  run_points_per_second: 2,
  swim_base_time: "01:13.00",
  swim_points_per_second: 5,
};
const girlsU15: ResultsPointsRow = {
  ...boysU15,
  gender: "F",
  run_base_time: "02:53.00",
  swim_base_time: "01:15.00",
};
const boysU11: ResultsPointsRow = {
  ...boysU15,
  age_group_code: "U11",
  age_group_label: "Under 11",
  sort_order: 3,
};
const table = [boysU15, girlsU15, boysU11];

function athlete(
  full_name: string,
  run_time: string | null,
  swim_time: string | null,
  over: Partial<ResultsAthleteRow> = {},
): ResultsAthleteRow {
  return {
    full_name,
    gender: "M",
    age_group_code: "U15",
    run_time,
    swim_time,
    ...over,
  };
}

describe("shapeResults — grouping and ranking", () => {
  it("ranks athletes by total points within their age group and gender", () => {
    const groups = shapeResults(
      [
        athlete("Slow", "02:48.00", "01:14.00"),
        athlete("Fast", "02:40.00", "01:10.00"),
        athlete("Girl", "02:50.00", "01:10.00", { gender: "F" }),
      ],
      table,
    );

    const boys = groups.find((g) => g.title === "Boys/Men · Under 15");
    expect(boys?.ranked.map((a) => [a.rank, a.full_name])).toEqual([
      [1, "Fast"],
      [2, "Slow"],
    ]);
    const girls = groups.find((g) => g.title === "Girls/Ladies · Under 15");
    expect(girls?.ranked.map((a) => a.full_name)).toEqual(["Girl"]);
  });

  it("shows each athlete's run points, swim points and total", () => {
    const [group] = shapeResults([athlete("A", "02:45.00", "01:13.00")], table);
    expect(group.ranked[0]).toMatchObject({
      run_time: "02:45.00",
      swim_time: "01:13.00",
      run_points: 1004,
      swim_points: 1000,
      total_points: 2004,
    });
  });

  it("orders groups girls first, then by the PDF's age group order", () => {
    const groups = shapeResults(
      [
        athlete("B15", "02:45.00", "01:13.00"),
        athlete("B11", "02:45.00", "01:13.00", { age_group_code: "U11" }),
        athlete("G15", "02:45.00", "01:13.00", { gender: "F" }),
      ],
      table,
    );
    expect(groups.map((g) => g.title)).toEqual([
      "Girls/Ladies · Under 15",
      "Boys/Men · Under 11",
      "Boys/Men · Under 15",
    ]);
  });
});

describe("shapeResults — ties", () => {
  it("shares a rank on equal points and orders the tie by name", () => {
    const [group] = shapeResults(
      [
        athlete("Cara", "02:47.00", "01:13.00"),
        athlete("Ann", "02:45.00", "01:16.00"), // 1004 + 985 = 1989
        athlete("Bea", "02:47.00", "01:13.00"),
        athlete("Dot", "02:47.50", "01:13.00"),
      ],
      table,
    );
    expect(group.ranked.map((a) => [a.rank, a.full_name])).toEqual([
      [1, "Bea"],
      [1, "Cara"],
      [3, "Dot"],
      [4, "Ann"],
    ]);
  });
});

describe("shapeResults — who is shown and ranked", () => {
  it("lists an athlete with one time unranked, below the ranked", () => {
    const [group] = shapeResults(
      [
        athlete("Runner", "02:45.00", null),
        athlete("Swimmer", null, "01:13.00"),
        athlete("Both", "02:47.00", "01:13.00"),
      ],
      table,
    );
    expect(group.ranked.map((a) => a.full_name)).toEqual(["Both"]);
    expect(group.unranked.map((a) => a.full_name)).toEqual([
      "Runner",
      "Swimmer",
    ]);
    expect(group.unranked[0]).toMatchObject({
      rank: null,
      run_points: 1004,
      swim_points: null,
      total_points: 1004,
    });
  });

  it("leaves out an athlete with neither time", () => {
    const groups = shapeResults([athlete("No show", null, null)], table);
    expect(groups).toEqual([]);
  });
});

describe("shapeResults — Unclassified", () => {
  it("shows an athlete the points table has no row for, with no points", () => {
    const groups = shapeResults(
      [
        athlete("Stray", "02:45.00", "01:13.00", { age_group_code: "M80" }),
        athlete("Normal", "02:45.00", "01:13.00"),
      ],
      table,
    );
    expect(groups.map((g) => g.title)).toEqual([
      "Boys/Men · Under 15",
      "Unclassified",
    ]);
    const unclassified = groups[1];
    expect(unclassified.ranked).toEqual([]);
    expect(unclassified.unranked).toEqual([
      {
        rank: null,
        full_name: "Stray",
        run_time: "02:45.00",
        swim_time: "01:13.00",
        run_points: null,
        swim_points: null,
        total_points: null,
      },
    ]);
  });

  it("leaves out an unclassified athlete with no times", () => {
    const groups = shapeResults(
      [athlete("Ghost", null, null, { age_group_code: "M80" })],
      table,
    );
    expect(groups).toEqual([]);
  });
});
