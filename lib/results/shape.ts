import { computePoints, type PointsRow } from "./points";

type Gender = "M" | "F";

/** An athlete's published times, as league_results returns them. */
export interface ResultsAthleteRow {
  full_name: string;
  gender: Gender;
  age_group_code: string;
  run_time: string | null;
  swim_time: string | null;
}

/** A row of the points table that applies to the League. */
export interface ResultsPointsRow extends PointsRow {
  gender: Gender;
  age_group_code: string;
  age_group_label: string;
  sort_order: number;
}

export interface ShapedAthlete {
  /** Shared ranks (1, 2, 2, 4). Null when the athlete is not ranked. */
  rank: number | null;
  full_name: string;
  run_time: string | null;
  swim_time: string | null;
  run_points: number | null;
  swim_points: number | null;
  total_points: number | null;
}

export interface ResultsGroup {
  title: string;
  /** Athletes with both times, best first. */
  ranked: ShapedAthlete[];
  /** Athletes with one time, or who the points table can't score. */
  unranked: ShapedAthlete[];
}

const GENDER_TITLE: Record<Gender, string> = {
  F: "Girls/Ladies",
  M: "Boys/Men",
};

// Points are multiples of 0.02, so this only hides floating-point noise.
const tieKey = (points: number) => Math.round(points * 1e6);

const byName = (a: ShapedAthlete, b: ShapedAthlete) =>
  a.full_name.localeCompare(b.full_name);

/**
 * Groups published results by age group and gender and ranks each group by
 * points. An athlete with neither time did not show up and is left out. An
 * athlete with one time is shown but not ranked, since one component is not
 * comparable with a full total. An athlete the points table has no row for is
 * shown in an Unclassified group, with times and no points.
 */
export function shapeResults(
  athletes: ResultsAthleteRow[],
  pointsTable: ResultsPointsRow[],
): ResultsGroup[] {
  const rows = new Map(
    pointsTable.map((row) => [`${row.gender}/${row.age_group_code}`, row]),
  );

  const grouped = new Map<
    string,
    { title: string; order: [number, number]; all: ShapedAthlete[] }
  >();
  for (const a of athletes) {
    // Someone with neither time did not show up.
    if (a.run_time === null && a.swim_time === null) continue;

    const row = rows.get(`${a.gender}/${a.age_group_code}`);
    const points = row
      ? computePoints(a.run_time, a.swim_time, row)
      : { run: null, swim: null, total: null };
    const key = row ? `${row.gender}/${row.age_group_code}` : "unclassified";
    const group = grouped.get(key) ?? {
      title: row
        ? `${GENDER_TITLE[row.gender]} · ${row.age_group_label}`
        : "Unclassified",
      // Girls first, then the PDF's age group order; Unclassified last.
      order: row ? [row.gender === "F" ? 0 : 1, row.sort_order] : [2, 0],
      all: [],
    };
    group.all.push({
      rank: null,
      full_name: a.full_name,
      run_time: a.run_time,
      swim_time: a.swim_time,
      run_points: points.run,
      swim_points: points.swim,
      total_points: points.total,
    });
    grouped.set(key, group);
  }

  return [...grouped.values()]
    .sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1])
    .map(({ title, all }) => {
      const ranked = all
        .filter(
          (a) =>
            a.total_points !== null &&
            a.run_time !== null &&
            a.swim_time !== null,
        )
        .sort(
          (a, b) =>
            tieKey(b.total_points ?? 0) - tieKey(a.total_points ?? 0) ||
            byName(a, b),
        );
      ranked.forEach((a, i) => {
        const previous = ranked[i - 1];
        a.rank =
          previous &&
          tieKey(previous.total_points ?? 0) === tieKey(a.total_points ?? 0)
            ? previous.rank
            : i + 1;
      });
      const unranked = all.filter((a) => !ranked.includes(a)).sort(byName);
      return { title, ranked, unranked };
    });
}
