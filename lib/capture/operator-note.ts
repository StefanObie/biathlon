/**
 * What a capture screen needs to know about operator notes.
 *
 * A note is tied to an **ordinal**: how many finishers this screen had
 * accounted for when the note was written, and 0 before the first finisher.
 * That is deliberately not `time_capture.seq` / `position_capture.position`
 * — those counters are never reused, so a voided capture leaves a hole in
 * them, while reconciliation zips the two streams of *active* captures by
 * ordinal (see `buildWorkingRows`). Anchoring on the finished count is what
 * keeps a note pointing at the same finisher the official sees on the row.
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
 */
export function captureScreen(screen: string): CaptureScreen {
  return screen === "position" ? "position" : "timer";
}
