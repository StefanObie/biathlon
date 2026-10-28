import type { PoolLength } from "@/lib/results/points";
import {
  shapeResults,
  type Gender,
  type ResultsAthleteRow,
  type ResultsPointsRow,
} from "@/lib/results/shape";

/** Gold, Silver and Bronze. */
export type MedalPlace = 1 | 2 | 3;

/** An athlete's published times, with the athlete number Officials see. */
export interface MedalAthleteRow extends ResultsAthleteRow {
  athlete_no: number;
}

export interface PodiumAthlete {
  medal_place: MedalPlace;
  athlete_no: number;
  full_name: string;
  total_points: number;
}

/** One athlete's Medal place, as saved when the medals were presented. */
export interface SavedMedal {
  athlete_no: number;
  medal_place: MedalPlace;
}

/** A group's Medals presented mark. */
export interface MedalPresentation {
  gender: Gender;
  age_group_code: string;
  podium: SavedMedal[];
  presented_at: string;
}

export type PresentationState =
  | { state: "not-presented" }
  | { state: "presented" | "changed"; presented_at: string };

export interface MedalGroup {
  title: string;
  gender: Gender;
  age_group_code: string;
  podium: PodiumAthlete[];
  /** Athletes entered in the group without both times, no-shows included. */
  missing: number;
  /** "changed" when the podium is no longer the one presented. */
  presentation: PresentationState;
}

const medalKey = (m: SavedMedal) => `${m.athlete_no}:${m.medal_place}`;

/** The same athletes in the same Medal places, in any order. */
function samePodium(a: SavedMedal[], b: SavedMedal[]): boolean {
  const keys = new Set(a.map(medalKey));
  return a.length === b.length && b.every((m) => keys.has(medalKey(m)));
}

/**
 * Each group's podium, in the results page's group order, with how many of
 * its athletes still miss a time and whether its medals are presented. The
 * groups and points come from shapeResults, so the podium can't disagree with
 * the results page. Unclassified athletes get no medals, so their groups are
 * left out.
 */
export function medalBoard(
  athletes: MedalAthleteRow[],
  pointsTable: ResultsPointsRow[],
  poolLength: PoolLength,
  presentations: MedalPresentation[],
): MedalGroup[] {
  const groups = shapeResults(athletes, pointsTable, poolLength);
  const missing = new Map<string, number>();
  for (const a of athletes) {
    if (a.run_time !== null && a.swim_time !== null) continue;
    const key = `${a.gender}/${a.age_group_code}`;
    missing.set(key, (missing.get(key) ?? 0) + 1);
  }
  return groups.flatMap((group) => {
    if (group.age_group_code === null) return [];
    // Ties don't skip places: ranks 1, 2, 2, 4 are places 1, 2, 2, 3.
    const podium: PodiumAthlete[] = [];
    let place = 0;
    group.ranked.forEach((a, i) => {
      if (i === 0 || a.rank !== group.ranked[i - 1].rank) place++;
      if (place > 3) return;
      podium.push({
        medal_place: place as MedalPlace,
        athlete_no: a.athlete_no!,
        full_name: a.full_name,
        total_points: a.total_points!,
      });
    });
    const saved = presentations.find(
      (p) =>
        p.gender === group.gender && p.age_group_code === group.age_group_code,
    );
    return [
      {
        title: group.title,
        gender: group.gender,
        age_group_code: group.age_group_code,
        podium,
        missing: missing.get(`${group.gender}/${group.age_group_code}`) ?? 0,
        presentation: saved
          ? {
              state: samePodium(saved.podium, podium) ? "presented" : "changed",
              presented_at: saved.presented_at,
            }
          : { state: "not-presented" },
      },
    ];
  });
}
