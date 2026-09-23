/**
 * The state both capture screens (Timer and Position) show above their
 * capture controls. One pure function so the two screens can't drift
 * apart on what "finished" means.
 *
 * Later tickets extend this state with whether the heat is closed (#23)
 * and the frozen clock value (#14).
 */
export interface CaptureScreenState {
  /** Finishers accounted for on this screen: the heat's active captures. */
  finished: number;
  /** Athletes on this heat's roster — the denominator of "12 / 20". */
  rosterSize: number;
  /** More finishers than the roster holds, shown as a warning. */
  overRoster: boolean;
}

/**
 * Derives the capture screen state from a heat's captures and its roster
 * size.
 *
 * A finisher is an active (non-voided) capture, whatever kind: a Missed
 * finish on the Timer screen and a Skip on the Position screen each mark a
 * finisher, just one whose time or identity isn't known yet.
 *
 * The count can exceed the roster size — an athlete scanned from another
 * heat is a finisher here but is on that other heat's roster — so
 * `overRoster` is a warning, not an error, and equality is not over.
 */
/**
 * How many athletes are on a heat's roster — the denominator of "12 / 20".
 * Both screens hold the whole league's entries (the Position screen needs
 * them to resolve an athlete scanned from another heat), so each has to
 * narrow to this heat the same way.
 */
export function heatRosterSize(
  entryRunHeats: readonly number[],
  runHeat: number,
): number {
  return entryRunHeats.filter((h) => h === runHeat).length;
}

export function captureScreenState({
  captures,
  rosterSize,
}: {
  captures: readonly { voided: boolean }[];
  rosterSize: number;
}): CaptureScreenState {
  const finished = captures.filter((c) => !c.voided).length;
  return { finished, rosterSize, overRoster: finished > rosterSize };
}
