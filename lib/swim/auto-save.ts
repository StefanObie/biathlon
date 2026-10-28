/**
 * What a poll of the Swim results file saves on its own (#77), and how it
 * rebuilds the review the Official is working through.
 */
import { duplicateAthletes, type ResolvedSwimRow } from "@/lib/swim/resolve";

/** A swim result already saved for the League. */
export interface SavedSwimResult {
  athlete_no: number;
  swim_time: string | null;
  status: string;
  source: string;
}

export interface AutoSavePlan {
  autoSave: ResolvedSwimRow[];
  held: ResolvedSwimRow[];
}

/**
 * Splits a poll's rows into those saved without the Official and those
 * held for them. Only a new or changed row that resolved cleanly and that
 * the Official hasn't touched is saved; one that needs review, is
 * unresolved, shares its athlete with another row, or would overwrite a
 * manual result is held. A row whose result is already saved is neither.
 */
export function autoSavePlan(
  rows: ResolvedSwimRow[],
  saved: SavedSwimResult[],
): AutoSavePlan {
  const savedByNo = new Map(saved.map((row) => [row.athlete_no, row]));
  const duplicates = new Set(duplicateAthletes(rows));
  const autoSave: ResolvedSwimRow[] = [];
  const held: ResolvedSwimRow[] = [];
  for (const row of rows) {
    if (row.state === "no-result") continue;
    if (row.athleteNo === null || duplicates.has(row.athleteNo)) {
      held.push(row);
      continue;
    }
    const prior = savedByNo.get(row.athleteNo);
    if (prior && prior.swim_time === row.time && prior.status === row.status) {
      continue;
    }
    const clean =
      !row.edited &&
      (row.state === "matched" || row.state === "matched-by-lane");
    if (clean && prior?.source !== "manual") autoSave.push(row);
    else held.push(row);
  }
  return { autoSave, held };
}

/** The review table's rows and the ones the Official took out of it. */
export interface Review {
  rows: ResolvedSwimRow[];
  removed: ReadonlySet<string>;
}

/** The parser keeps only a heat's last block, so heat and lane name a row. */
const slot = (row: ResolvedSwimRow) => `${row.raw.heat}:${row.raw.lane}`;

/**
 * Rebuilds the review from a newer Swim results file without losing what
 * the Official did to it: a row they edited keeps their edit, and a row
 * they removed stays removed.
 */
export function carryOverReview(
  previous: Review,
  next: ResolvedSwimRow[],
): Review {
  const edited = new Map<string, ResolvedSwimRow>();
  const removedSlots = new Set<string>();
  for (const row of previous.rows) {
    if (row.edited) edited.set(slot(row), row);
    if (previous.removed.has(row.localId)) removedSlots.add(slot(row));
  }

  const rows = next.map((row) => {
    const kept = edited.get(slot(row));
    return kept ? { ...kept, localId: row.localId } : row;
  });
  const removed = new Set(
    rows.filter((row) => removedSlots.has(slot(row))).map((r) => r.localId),
  );
  return { rows, removed };
}
