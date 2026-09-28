import type { ExportRow } from "@/lib/export/build-xml";

export interface ExportPreviewRow extends ExportRow {
  runHeat: number;
  swimStatus: string | null;
  runStatus: string | null;
  /** Athlete has run rows in heats other than their assigned entry.runHeat. */
  strayRunHeats: number[];
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
  /** Athletes left out because their assigned run heat isn't Closed. */
  openHeatAthleteCount: number;
  /** The run heats those athletes are in, ascending. */
  openHeats: number[];
}

/**
 * Chooses which entered athletes reach the export, in entry order.
 *
 * An athlete is left out when their assigned run heat isn't Closed (ADR
 * 0001): only reconciled results are official, and that includes a heat
 * that was reopened after saving. Otherwise they appear if they have at
 * least one of the two times. Both kinds of left-out athlete are counted,
 * separately, not exported.
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
    if (!closedHeats.has(entry.runHeat)) {
      openHeatAthleteCount += 1;
      openHeats.add(entry.runHeat);
      continue;
    }

    const swim = swimByAthlete.get(entry.athleteNo);
    const athleteRuns = runsByAthlete.get(entry.athleteNo) ?? [];

    // entry.runHeat is the athlete's official assignment, so that row wins;
    // any other heat is a capture artifact surfaced as a warning, not merged.
    const run = athleteRuns.find((r) => r.runHeat === entry.runHeat);
    const strayRunHeats = athleteRuns
      .filter((r) => r.runHeat !== entry.runHeat)
      .map((r) => r.runHeat);

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
      strayRunHeats,
    });
  }

  return {
    rows,
    excludedCount,
    openHeatAthleteCount,
    openHeats: [...openHeats].sort((a, b) => a - b),
  };
}
