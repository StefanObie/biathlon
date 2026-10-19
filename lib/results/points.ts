/** The points_table fields that decide how a time scores. */
export interface PointsRow {
  run_base_time: string;
  run_points_per_second: number;
  swim_distance_m: number;
  swim_base_time: string;
  swim_points_per_second: number;
  /** The Short course adjustment: seconds added per extra turn in a 25 m pool. */
  short_course_seconds_per_turn: number;
}

/** The Pool lengths a League can swim in, in metres. */
export const POOL_LENGTHS = [25, 50] as const;
export type PoolLength = (typeof POOL_LENGTHS)[number];

export function isPoolLength(value: number): value is PoolLength {
  return (POOL_LENGTHS as readonly number[]).includes(value);
}

export interface Points {
  run: number | null;
  swim: number | null;
  /** Run plus swim points, counting only the components that exist. */
  total: number | null;
}

/** Centiseconds in an `mm:SS.ss` time, the format every stored time uses. */
function toCentiseconds(time: string): number {
  const match = /^(\d{2}):(\d{2})\.(\d{2})$/.exec(time);
  if (!match) throw new Error(`Not an mm:SS.ss time: ${time}`);
  return Number(match[1]) * 6000 + Number(match[2]) * 100 + Number(match[3]);
}

/** 1000 at the base time, plus or minus a rate for every second faster or slower. */
function componentPoints(
  time: string | null,
  baseTime: string,
  pointsPerSecond: number,
): number | null {
  if (time === null) return null;
  const secondsFaster = (toCentiseconds(baseTime) - toCentiseconds(time)) / 100;
  return 1000 + secondsFaster * pointsPerSecond;
}

/** Turns a swim of this distance makes in a pool of this length. */
function turns(distance: number, poolLength: number): number {
  return Math.max(Math.ceil(distance / poolLength) - 1, 0);
}

/**
 * Seconds a 25 m pool adds to a swim: the Short course adjustment for each
 * turn beyond the ones the swim makes in a 50 m pool (#70).
 */
function shortCourseSeconds(row: PointsRow, poolLength: PoolLength): number {
  if (poolLength === 50) return 0;
  const extraTurns =
    turns(row.swim_distance_m, 25) - turns(row.swim_distance_m, 50);
  return extraTurns * row.short_course_seconds_per_turn;
}

/**
 * An athlete's points for a run and a swim (Age Group & Points Table PDF).
 * Bonus points for age are not included: they need a birth year, which we
 * don't have. A missing time leaves that component empty, and the total is
 * the sum of whichever components exist. A swim in a 25 m pool loses the
 * Short course adjustment.
 */
export function computePoints(
  runTime: string | null,
  swimTime: string | null,
  row: PointsRow,
  poolLength: PoolLength,
): Points {
  const run = componentPoints(
    runTime,
    row.run_base_time,
    row.run_points_per_second,
  );
  const swimBeforeAdjustment = componentPoints(
    swimTime,
    row.swim_base_time,
    row.swim_points_per_second,
  );
  const swim =
    swimBeforeAdjustment === null
      ? null
      : swimBeforeAdjustment -
        shortCourseSeconds(row, poolLength) * row.swim_points_per_second;
  const total = run === null && swim === null ? null : (run ?? 0) + (swim ?? 0);
  return { run, swim, total };
}
