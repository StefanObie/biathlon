export interface PositionCaptureChange {
  void_reason?: string | null;
  run_heat: number;
  position: number;
  athlete_no: number | null;
  voided: boolean;
}

/**
 * The toast for a position capture arriving live in reconciliation when it
 * is a Fill: an athlete captured at a position that was a Skip when the
 * page loaded. Null for any other capture, which gets the generic toast.
 */
export function fillToastMessage(
  change: PositionCaptureChange,
  {
    runHeat,
    known,
    names,
  }: {
    runHeat: number;
    known: readonly Omit<PositionCaptureChange, "run_heat">[];
    names: ReadonlyMap<number, string>;
  },
): string | null {
  const athleteNo = change.athlete_no;
  if (change.run_heat !== runHeat || athleteNo === null) return null;
  const wasSkip = known.some(
    (c) => !c.voided && c.position === change.position && c.athlete_no === null,
  );
  if (!wasSkip) return null;
  const name = names.get(athleteNo);
  const athlete = name ? `${athleteNo} ${name}` : `${athleteNo}`;
  return `Position #${change.position} was filled with ${athlete} — refresh to load it.`;
}
