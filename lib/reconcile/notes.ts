/**
 * Placing operator notes on the reconciliation table.
 *
 * A note carries its anchor: the seq (Timer screen) or position (Position
 * screen) of the latest active capture when it was written — see
 * lib/capture/operator-note.ts. It is placed on whichever working row holds
 * that capture, so it follows the capture when the official inserts a gap
 * or removes a row.
 */

import type { CaptureScreen } from "@/lib/capture/operator-note";
import type { WorkingRow } from "./join";

export interface OperatorNote {
  id: string;
  /** Seq or position of the latest active capture; 0 before the first. */
  anchor: number;
  screen: CaptureScreen;
  body: string;
  createdAt: string;
}

export interface PlacedNotes {
  /** Notes keyed by the `localId` of the row holding their capture. */
  byRow: Map<string, OperatorNote[]>;
  /** Notes tied to 0, or to a capture no row in the table holds. */
  heatLevel: OperatorNote[];
}

function holdsAnchor(row: WorkingRow, note: OperatorNote): boolean {
  return note.screen === "timer"
    ? row.time?.seq === note.anchor
    : row.position?.position === note.anchor;
}

/**
 * Splits notes into per-row and heat-level buckets. A note tied to 0
 * (written before the first finisher) or to a capture no row holds any more
 * (voided after the note, or its row removed) has no row to sit next to, so
 * it is shown at heat level rather than dropped — the operator wrote it for
 * a reason, and reconciliation is where that reason gets acted on.
 *
 * Both buckets come back in the order the notes were written, so a later
 * note correcting an earlier one reads after it.
 */
export function placeNotes(
  notes: readonly OperatorNote[],
  rows: readonly WorkingRow[],
): PlacedNotes {
  const ordered = [...notes].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const byRow = new Map<string, OperatorNote[]>();
  const heatLevel: OperatorNote[] = [];

  for (const note of ordered) {
    const row =
      note.anchor === 0 ? undefined : rows.find((r) => holdsAnchor(r, note));
    if (!row) {
      heatLevel.push(note);
      continue;
    }
    const existing = byRow.get(row.localId);
    if (existing) existing.push(note);
    else byRow.set(row.localId, [note]);
  }

  return { byRow, heatLevel };
}
