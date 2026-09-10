/**
 * Formats milliseconds elapsed since heat start into the `mm:SS.ss` text
 * format used for `time_capture.elapsed_time` (§6.4). Centisecond precision
 * matches storage even though hand-timing accuracy is closer to ~200ms
 * (§6.4 precision note).
 */
export function formatElapsed(elapsedMs: number): string {
  const totalCs = Math.round(elapsedMs / 10);
  const minutes = Math.floor(totalCs / 6000);
  const seconds = Math.floor((totalCs % 6000) / 100);
  const centis = totalCs % 100;
  return (
    `${String(minutes).padStart(2, "0")}:` +
    `${String(seconds).padStart(2, "0")}.` +
    `${String(centis).padStart(2, "0")}`
  );
}

/**
 * Next seq for a heat's timer: one past the highest seq captured so far,
 * voided or not — mirrors `nextPosition` (lib/scan/position.ts). A fresh
 * heat starts at 1.
 */
export function nextSeq(seqs: number[]): number {
  if (seqs.length === 0) return 1;
  return Math.max(...seqs) + 1;
}
