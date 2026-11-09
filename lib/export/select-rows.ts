import type { ExportRow } from "@/lib/export/build-xml";

export interface ExportPreviewRow extends ExportRow {
  runHeat: number;
  swimStatus: string | null;
  runStatus: string | null;
  /** The heat of the exported run when it is an Off-roster run, else null. */
  ranInHeat: number | null;
  /** Other Closed heats the athlete has Run results in, ascending. */
  otherRunHeats: number[];
}

export interface ExportEntry {
  athleteNo: number;
  runHeat: number;
  fullName: string;
}

export interface ExportSwim {
  athleteNo: number;
  swimTime: string | null;
  status: string | null;
}

export interface ExportRun {
  athleteNo: number;
  runHeat: number;
  runTime: string | null;
  status: string | null;
}

export interface ExportSelection {
  rows: ExportPreviewRow[];
  /** Athletes in a closed heat with no time on either leg. */
  excludedCount: number;
  /**
   * Athletes left out because their roster heat isn't Closed and they have no
   * Run result in a heat that is.
   */
  openHeatAthleteCount: number;
  /** The run heats those athletes are in, ascending. */
  openHeats: number[];
}

/**
 * Chooses which entered athletes reach the export, in entry order.
 *
 * Only Run results in Closed heats count (ADR 0001), and of those the one
 * countingRunFirst puts first is exported, even an Off-roster run (ADR 0008).
 * An athlete with no such Run result is left out while their roster heat
 * isn't Closed, including a heat reopened after saving. Otherwise they appear
 * if they have at least one of the two times. Both kinds of left-out athlete
 * are counted, separately, not exported.
 *
 * Status is never used to filter or blank a time — see buildResultsXml.
 */
export function selectExportRows({
  entries,
  swims,
  runs,
  closedHeats,
}: {
  entries: ExportEntry[];
  swims: ExportSwim[];
  runs: ExportRun[];
  closedHeats: ReadonlySet<number>;
}): ExportSelection {
  const swimByAthlete = new Map(swims.map((swim) => [swim.athleteNo, swim]));

  const runsByAthlete = new Map<number, ExportRun[]>();
  for (const run of runs) {
    const existing = runsByAthlete.get(run.athleteNo);
    if (existing) existing.push(run);
    else runsByAthlete.set(run.athleteNo, [run]);
  }

  const rows: ExportPreviewRow[] = [];
  let excludedCount = 0;
  let openHeatAthleteCount = 0;
  const openHeats = new Set<number>();

  for (const entry of entries) {
    const swim = swimByAthlete.get(entry.athleteNo);
    const closedRuns = (runsByAthlete.get(entry.athleteNo) ?? [])
      .filter((r) => closedHeats.has(r.runHeat))
      .sort(countingRunFirst(entry.runHeat));
    const [run] = closedRuns;
    const otherRunHeats = closedRuns
      .slice(1)
      .map((r) => r.runHeat)
      .sort((a, b) => a - b);

    if (!run && !closedHeats.has(entry.runHeat)) {
      openHeatAthleteCount += 1;
      openHeats.add(entry.runHeat);
      continue;
    }

    const swimTime = swim?.swimTime ?? null;
    const runTime = run?.runTime ?? null;

    if (swimTime === null && runTime === null) {
      excludedCount += 1;
      continue;
    }

    rows.push({
      athleteNo: entry.athleteNo,
      fullName: entry.fullName,
      swimTime,
      runTime,
      runHeat: entry.runHeat,
      swimStatus: swim?.status ?? null,
      runStatus: run?.status ?? null,
      ranInHeat: run && run.runHeat !== entry.runHeat ? run.runHeat : null,
      otherRunHeats,
    });
  }

  return {
    rows,
    excludedCount,
    openHeatAthleteCount,
    openHeats: [...openHeats].sort((a, b) => a - b),
  };
}

/**
 * Orders an athlete's Closed-heat Run results so the one that counts comes
 * first: an ok one with a time before any other, then the roster heat's, then
 * the lowest-numbered heat's (ADR 0008). published_times applies the same
 * rule in SQL, so the export and the public results pick the same run.
 */
function countingRunFirst(rosterHeat: number) {
  return (a: ExportRun, b: ExportRun) =>
    Number(isOkWithTime(b)) - Number(isOkWithTime(a)) ||
    Number(b.runHeat === rosterHeat) - Number(a.runHeat === rosterHeat) ||
    a.runHeat - b.runHeat;
}

function isOkWithTime(run: ExportRun) {
  return run.status === "ok" && run.runTime !== null;
}
