/**
 * The state both capture screens (Timer and Position) show above their
 * capture controls. One pure function so the two screens can't drift
 * apart on what "finished" means.
 */
export interface CaptureScreenState {
  /** Finishers accounted for on this screen: the heat's active captures. */
  finished: number;
  /** Athletes on this heat's roster — the denominator of "12 / 20". */
  rosterSize: number;
  /** More finishers than the roster holds, shown as a warning. */
  overRoster: boolean;
  /** The heat is closed: the screen takes no new captures, only notes. */
  locked: boolean;
  /** The Timer screen's clock on a closed heat: the time from the start to
   * the close. Null while the heat is open (the clock runs) or when it
   * closed without a start. */
  frozenElapsedMs: number | null;
}

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
 *
 * `closedAt` is when the heat was closed, or null while it is open (never
 * closed, or reopened). A closed heat takes no new captures, and its clock
 * stops at the close. `startedAtMs` is the heat's start (Date.now() epoch),
 * which only the Timer screen has; the Position screen passes null.
 */
export function captureScreenState({
  captures,
  rosterSize,
  closedAt,
  startedAtMs,
}: {
  captures: readonly { voided: boolean }[];
  rosterSize: number;
  closedAt: string | null;
  startedAtMs: number | null;
}): CaptureScreenState {
  const finished = captures.filter((c) => !c.voided).length;
  return {
    finished,
    rosterSize,
    overRoster: finished > rosterSize,
    locked: closedAt !== null,
    // Clamped: the close comes from the official's device clock and the
    // start from the timer phone's, so skew can put the close first.
    frozenElapsedMs:
      closedAt !== null && startedAtMs !== null
        ? Math.max(0, new Date(closedAt).getTime() - startedAtMs)
        : null,
  };
}
