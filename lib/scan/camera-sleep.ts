/**
 * When the Position screen's camera is on (#17). It's only on while it's
 * being used: it sleeps after a stretch with no scan or manual entry, and
 * wakes when the Placer taps the scanner area.
 */

/** How long the camera stays on without a scan or manual entry. */
const CAMERA_IDLE_MS = 45_000;

export type CameraState =
  { awake: true; lastUsedAt: number } | { awake: false };

export type CameraEvent =
  /** The Placer tapped the sleeping scanner area. */
  | { type: "wake"; at: number }
  /** A scan or a manual athlete-number entry of an accepted athlete. */
  | { type: "used"; at: number }
  /** The clock moved on; sends the camera to sleep once it's been idle. */
  | { type: "tick"; at: number }
  /** The page was hidden: switched tab, locked phone. */
  | { type: "hidden" };

export function wokenAt(at: number): CameraState {
  return { awake: true, lastUsedAt: at };
}

export function nextCameraState(
  state: CameraState,
  event: CameraEvent,
): CameraState {
  switch (event.type) {
    case "wake":
      return wokenAt(event.at);
    case "used":
      // Manual entry works with the camera off, but doesn't turn it on.
      return state.awake ? wokenAt(event.at) : state;
    case "tick":
      return state.awake && event.at >= sleepsAt(state)
        ? { awake: false }
        : state;
    case "hidden":
      return { awake: false };
  }
}

/** When an awake camera goes to sleep if nothing else happens. */
function sleepsAt(state: { lastUsedAt: number }): number {
  return state.lastUsedAt + CAMERA_IDLE_MS;
}
