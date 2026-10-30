import { describe, expect, it } from "vitest";

import type { ResultsPointsRow } from "@/lib/results/shape";

import { medalBoard, type MedalAthleteRow } from "./board";

const boysU15: ResultsPointsRow = {
  gender: "M",
  age_group_code: "U15",
  age_group_label: "Under 15",
  sort_order: 5,
  run_base_time: "02:47.00",
  run_points_per_second: 2,
  swim_distance_m: 100,
  swim_base_time: "01:13.00",
  swim_points_per_second: 5,
  short_course_seconds_per_turn: 0.8,
};
const girlsU15: ResultsPointsRow = {
  ...boysU15,
  gender: "F",
  run_base_time: "02:53.00",
  swim_base_time: "01:15.00",
};
const table = [boysU15, girlsU15];

function athlete(
  athlete_no: number,
  run_time: string | null,
  swim_time: string | null,
  over: Partial<MedalAthleteRow> = {},
): MedalAthleteRow {
  return {
    athlete_no,
    full_name: `Athlete ${athlete_no}`,
    gender: "M",
    age_group_code: "U15",
    run_time,
    swim_time,
    missing_age: false,
    ...over,
  };
}

const places = (group: {
  podium: { medal_place: number; athlete_no: number }[];
}) => group.podium.map((a) => [a.medal_place, a.athlete_no]);

describe("medalBoard — Medal places", () => {
  it("gives Gold, Silver, Silver, Bronze when two athletes tie for second", () => {
    const [group] = medalBoard(
      [
        athlete(1, "02:40.00", "01:10.00"),
        athlete(2, "02:45.00", "01:12.00"),
        athlete(3, "02:45.00", "01:12.00"),
        athlete(4, "02:50.00", "01:14.00"),
        athlete(5, "02:55.00", "01:15.00"),
      ],
      table,
      50,
      [],
    );

    expect(places(group)).toEqual([
      [1, 1],
      [2, 2],
      [2, 3],
      [3, 4],
    ]);
  });
});

describe("medalBoard — age bonus", () => {
  it("includes the bonus in the podium's Points and Medal places", () => {
    const [group] = medalBoard(
      [
        athlete(1, "02:46.00", "01:13.00", { bonus_points: 0 }),
        athlete(2, "02:47.00", "01:13.00", { bonus_points: 30 }),
      ],
      table,
      50,
      [],
    );

    expect(group.podium).toEqual([
      {
        medal_place: 1,
        athlete_no: 2,
        full_name: "Athlete 2",
        total_points: 2030,
      },
      {
        medal_place: 2,
        athlete_no: 1,
        full_name: "Athlete 1",
        total_points: 2002,
      },
    ]);
  });

  it("shows the podium changed when the bonus moves a presented group's order", () => {
    const [group] = medalBoard(
      [
        athlete(1, "02:46.00", "01:13.00", { bonus_points: 0 }),
        athlete(2, "02:47.00", "01:13.00", { bonus_points: 30 }),
      ],
      table,
      50,
      [
        {
          gender: "M",
          age_group_code: "U15",
          podium: [
            { athlete_no: 1, medal_place: 1 },
            { athlete_no: 2, medal_place: 2 },
          ],
          presented_at: "2027-01-10T10:00:00Z",
        },
      ],
    );

    expect(group.presentation.state).toBe("changed");
  });
});

describe("medalBoard — athletes with no age", () => {
  it("names the athletes the database reports as having no age", () => {
    const [group] = medalBoard(
      [
        athlete(1, "02:40.00", "01:10.00"),
        athlete(2, "02:50.00", "01:14.00", { missing_age: true }),
      ],
      table,
      50,
      [],
    );

    expect(group.athletes_missing_age).toEqual([
      { athlete_no: 2, full_name: "Athlete 2" },
    ]);
  });

  it("has no one to name in a group where the database reports no missing age", () => {
    const [group] = medalBoard(
      [athlete(1, "02:40.00", "01:10.00")],
      table,
      50,
      [],
    );

    expect(group.athletes_missing_age).toEqual([]);
  });

  it("blocks nothing: an athlete with no age still gets a Medal place", () => {
    const [group] = medalBoard(
      [
        athlete(1, "02:40.00", "01:10.00", { missing_age: true }),
        athlete(2, "02:50.00", "01:14.00"),
      ],
      table,
      50,
      [],
    );

    expect(places(group)).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });

  it("only names athletes in their own group", () => {
    const groups = medalBoard(
      [
        athlete(1, "02:40.00", "01:10.00", { missing_age: true }),
        athlete(2, "02:40.00", "01:10.00", { gender: "F" }),
      ],
      table,
      50,
      [],
    );

    expect(
      groups.map((g) => [
        g.gender,
        g.athletes_missing_age.map((a) => a.athlete_no),
      ]),
    ).toEqual([
      ["F", []],
      ["M", [1]],
    ]);
  });
});

describe("medalBoard — who can't get a medal", () => {
  it("never gives a medal to a partial result or an Unclassified athlete", () => {
    const groups = medalBoard(
      [
        athlete(1, "02:40.00", null),
        athlete(2, null, "01:00.00"),
        athlete(3, "02:50.00", "01:14.00"),
        athlete(4, "02:30.00", "01:00.00", { age_group_code: "XYZ" }),
      ],
      table,
      50,
      [],
    );

    expect(groups.map((g) => g.title)).toEqual(["Boys/Men · Under 15"]);
    expect(places(groups[0])).toEqual([[1, 3]]);
  });
});

describe("medalBoard — athletes still missing a time", () => {
  it("counts each athlete in the group without both times, no-shows included", () => {
    const groups = medalBoard(
      [
        athlete(1, "02:40.00", "01:10.00"),
        athlete(2, "02:40.00", null),
        athlete(3, null, "01:10.00"),
        athlete(4, null, null),
        athlete(5, null, null, { gender: "F" }),
        athlete(6, "02:50.00", "01:14.00", { gender: "F" }),
      ],
      table,
      50,
      [],
    );

    expect(groups.map((g) => [g.title, g.missing])).toEqual([
      ["Girls/Ladies · Under 15", 1],
      ["Boys/Men · Under 15", 3],
    ]);
  });
});

describe("medalBoard — Medals presented", () => {
  const athletes = [
    athlete(1, "02:40.00", "01:10.00"),
    athlete(2, "02:45.00", "01:12.00"),
    athlete(3, "02:50.00", "01:14.00"),
  ];
  const presentedAt = "2027-01-10T10:00:00Z";
  const boys = (podium: { athlete_no: number; medal_place: 1 | 2 | 3 }[]) => ({
    gender: "M" as const,
    age_group_code: "U15",
    podium,
    presented_at: presentedAt,
  });

  it("shows a group with no mark as not presented", () => {
    const [group] = medalBoard(athletes, table, 50, []);
    expect(group.presentation).toEqual({ state: "not-presented" });
  });

  it("shows a group as presented when its podium matches the saved one", () => {
    const [group] = medalBoard(athletes, table, 50, [
      boys([
        { athlete_no: 3, medal_place: 3 },
        { athlete_no: 1, medal_place: 1 },
        { athlete_no: 2, medal_place: 2 },
      ]),
    ]);
    expect(group.presentation).toEqual({
      state: "presented",
      presented_at: presentedAt,
    });
  });

  it("shows the podium changed when a medal place or athlete differs", () => {
    const [swapped] = medalBoard(athletes, table, 50, [
      boys([
        { athlete_no: 2, medal_place: 1 },
        { athlete_no: 1, medal_place: 2 },
        { athlete_no: 3, medal_place: 3 },
      ]),
    ]);
    const [fewer] = medalBoard(athletes, table, 50, [
      boys([
        { athlete_no: 1, medal_place: 1 },
        { athlete_no: 2, medal_place: 2 },
      ]),
    ]);
    expect(swapped.presentation.state).toBe("changed");
    expect(fewer.presentation.state).toBe("changed");
  });

  it("only matches a mark to its own gender and age group", () => {
    const [group] = medalBoard(athletes, table, 50, [
      { ...boys([{ athlete_no: 1, medal_place: 1 }]), gender: "F" },
    ]);
    expect(group.presentation).toEqual({ state: "not-presented" });
  });

  it("still shows a presented group whose athletes all lost their times, as changed", () => {
    const groups = medalBoard([athlete(1, null, null)], table, 50, [
      boys([{ athlete_no: 1, medal_place: 1 }]),
    ]);
    expect(groups).toEqual([
      {
        title: "Boys/Men · Under 15",
        gender: "M",
        age_group_code: "U15",
        podium: [],
        missing: 1,
        athletes_missing_age: [],
        presentation: { state: "changed", presented_at: presentedAt },
      },
    ]);
  });
});
