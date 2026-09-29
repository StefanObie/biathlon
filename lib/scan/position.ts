/**
 * Resume position for a heat: one past the highest position captured so
 * far, voided or not (a voided row still consumed that position — undo
 * decrements explicitly instead). A fresh heat has no rows and starts at 1.
 */
export function nextPosition(positions: number[]): number {
  if (positions.length === 0) return 1;
  return Math.max(...positions) + 1;
}

export interface PositionCaptureFacts {
  id: string;
  position: number;
  athlete_no: number | null;
  scanned_at: string;
  voided: boolean;
  void_reason: string | null;
}

/** Void reason of a Skip replaced by a Fill. */
export const FILLED = "filled";

export type PositionRowAction = "undo" | "fill" | "undo-fill";

/**
 * Which button a row of the Position screen gets. Only the highest active
 * position can be undone, so the counter stays contiguous.
 */
export function positionRowAction(
  captures: readonly PositionCaptureFacts[],
  capture: PositionCaptureFacts,
): PositionRowAction | null {
  if (capture.voided) return null;
  const active = captures.filter((c) => !c.voided).map((c) => c.position);
  if (capture.position === Math.max(...active)) return "undo";
  if (capture.athlete_no === null) return "fill";
  // A Fill is the capture recorded straight after its Skip was voided, so
  // look only at the one before it at this position: a scan that reuses the
  // position of a Fill undone from the top is an ordinary scan.
  const previous = captures
    .filter(
      (c) =>
        c.position === capture.position && c.scanned_at < capture.scanned_at,
    )
    .sort((a, b) => b.scanned_at.localeCompare(a.scanned_at))[0];
  const filledSkip =
    previous?.athlete_no === null && previous.void_reason === FILLED;
  return filledSkip ? "undo-fill" : null;
}
