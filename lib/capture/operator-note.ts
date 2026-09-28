/**
 * What a capture screen needs to know about operator notes.
 *
 * A note is tied to an **anchor**: the latest active capture on its screen
 * when it was written — `time_capture.seq` on the Timer screen,
 * `position_capture.position` on the Position screen — and 0 before the
 * first finisher. Anchoring on a capture rather than a row number keeps the
 * note beside that capture while the official inserts gaps or removes rows
 * on reconciliation.
 */

/** Which capture screen an operator note was written on. */
export type CaptureScreen = "timer" | "position";

export const CAPTURE_SCREEN_LABEL: Record<CaptureScreen, string> = {
  timer: "Timer screen",
  position: "Position screen",
};

/**
 * Narrows `operator_note.screen`, a text column with a check constraint, so
 * the database's two allowed values become the union everywhere else uses.
 * Anything else means the constraint and this union have drifted apart, so
 * it throws rather than guessing a screen.
 */
export function parseCaptureScreen(screen: string): CaptureScreen {
  if (screen === "timer" || screen === "position") return screen;
  throw new Error(`Unknown operator note screen: ${screen}`);
}

/**
 * The anchor for a note written now: the highest active seq or position,
 * or 0 when nothing has finished yet. Undo only ever voids the highest
 * capture, so the highest active one is also the latest.
 */
export function noteAnchor(activeSeqsOrPositions: readonly number[]): number {
  return Math.max(0, ...activeSeqsOrPositions);
}

/** How a note's anchor reads to an operator or official, e.g. "time #4". */
export function describeAnchor(screen: CaptureScreen, anchor: number): string {
  if (anchor === 0) return "the start of the heat";
  return screen === "timer" ? `time #${anchor}` : `position #${anchor}`;
}
