/**
 * Resume position for a heat: one past the highest position captured so
 * far, voided or not (a voided row still consumed that position — undo
 * decrements explicitly instead). A fresh heat has no rows and starts at 1.
 */
export function nextPosition(positions: number[]): number {
  if (positions.length === 0) return 1;
  return Math.max(...positions) + 1;
}
