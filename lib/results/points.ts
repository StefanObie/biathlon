/** The points_table fields that decide how a time scores. */
export interface PointsRow {
  run_base_time: string;
  run_points_per_second: number;
  swim_base_time: string;
  swim_points_per_second: number;
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

/**
 * An athlete's points for a run and a swim (Age Group & Points Table PDF).
 * Bonus points for age are not included: they need a birth year, which we
 * don't have. A missing time leaves that component empty, and the total is
 * the sum of whichever components exist.
 */
export function computePoints(
  runTime: string | null,
  swimTime: string | null,
  row: PointsRow,
): Points {
  const run = componentPoints(
    runTime,
    row.run_base_time,
    row.run_points_per_second,
  );
  const swim = componentPoints(
    swimTime,
    row.swim_base_time,
    row.swim_points_per_second,
  );
  const total = run === null && swim === null ? null : (run ?? 0) + (swim ?? 0);
  return { run, swim, total };
}
