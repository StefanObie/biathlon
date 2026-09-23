/**
 * Placing operator notes on the reconciliation table.
 *
 * A note carries the ordinal it was written at: how many finishers the
 * capture screen had accounted for at the time. `buildWorkingRows` zips the
 * two streams of active captures by that same ordinal, so the note's ordinal
 * is the ordinal of the row it is about — as long as both sides count active
 * captures and not the never-reused seq/position counters (see
 * lib/capture/operator-note.ts).
 */

import type { CaptureScreen } from "@/lib/capture/operator-note";

export interface OperatorNoteEntry {
  id: string;
  /** Finishers accounted for when it was written; 0 before the first. */
  ordinal: number;
  screen: CaptureScreen;
  body: string;
  createdAt: string;
}

export interface PlacedNotes {
  /** Notes keyed by the 1-based ordinal of the row they apply to. */
  byOrdinal: Map<number, OperatorNoteEntry[]>;
  /** Notes tied to 0, or to an ordinal no row in the table has. */
  heatLevel: OperatorNoteEntry[];
}

/**
 * Splits notes into per-row and heat-level buckets against a table of
 * `rowCount` rows. A note tied to 0 (written before the first finisher) or
 * to an ordinal past the end of the table has no row to sit next to, so it
 * is shown at heat level rather than dropped — the operator wrote it for a
 * reason, and reconciliation is where that reason gets acted on.
 *
 * Both buckets come back in the order the notes were written, so a later
 * note correcting an earlier one reads after it.
 */
export function placeNotes(
  notes: readonly OperatorNoteEntry[],
  rowCount: number,
): PlacedNotes {
  const ordered = [...notes].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const byOrdinal = new Map<number, OperatorNoteEntry[]>();
  const heatLevel: OperatorNoteEntry[] = [];

  for (const note of ordered) {
    if (note.ordinal < 1 || note.ordinal > rowCount) {
      heatLevel.push(note);
      continue;
    }
    const existing = byOrdinal.get(note.ordinal);
    if (existing) existing.push(note);
    else byOrdinal.set(note.ordinal, [note]);
  }

  return { byOrdinal, heatLevel };
}
