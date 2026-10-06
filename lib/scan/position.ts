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

/** An athlete of the League's Organization, on the Start list or not. */
export interface OrganizationAthlete {
  athleteNo: number;
  fullName: string;
}

/** An athlete on this League's Start list, and the heat they're rostered in. */
export interface LeagueRosterAthlete extends OrganizationAthlete {
  runHeat: number;
}

export type ScanOutcome =
  /** Record the Capture. */
  | { kind: "record"; athlete: LeagueRosterAthlete }
  /** Already has an active Capture in this heat; record nothing. */
  | { kind: "already-captured"; athlete: OrganizationAthlete }
  /** Rostered in another heat. Confirm, then record. */
  | { kind: "other-heat"; athlete: LeagueRosterAthlete }
  /**
   * An athlete of the Organization who isn't on the Start list. Confirm,
   * then record; Reconcile turns them into a Late entry.
   */
  | { kind: "not-on-start-list"; athlete: OrganizationAthlete }
  /** No athlete of the Organization has this number. */
  | { kind: "unknown"; athleteNo: number };

/**
 * What scanning or typing `athleteNo` on heat `runHeat`'s Position screen
 * should do. The finishing order is never lost, so any athlete of the
 * Organization can be captured; mismatches are resolved in Reconcile.
 */
export function scanOutcome(
  athleteNo: number,
  runHeat: number,
  leagueRoster: readonly LeagueRosterAthlete[],
  athletes: readonly OrganizationAthlete[],
  captures: readonly PositionCaptureFacts[],
): ScanOutcome {
  const entered = leagueRoster.find((a) => a.athleteNo === athleteNo);
  const athlete = entered ?? athletes.find((a) => a.athleteNo === athleteNo);
  if (!athlete) return { kind: "unknown", athleteNo };
  if (captures.some((c) => !c.voided && c.athlete_no === athleteNo)) {
    return { kind: "already-captured", athlete };
  }
  if (!entered) return { kind: "not-on-start-list", athlete };
  if (entered.runHeat !== runHeat) {
    return { kind: "other-heat", athlete: entered };
  }
  return { kind: "record", athlete: entered };
}

/** A scan the Placer confirms before it is recorded. */
export type ConfirmScanOutcome = Extract<
  ScanOutcome,
  { kind: "other-heat" | "not-on-start-list" }
>;

/** Whether the Placer has to confirm the outcome before it is recorded. */
export function needsConfirm(
  outcome: ScanOutcome,
): outcome is ConfirmScanOutcome {
  return outcome.kind === "other-heat" || outcome.kind === "not-on-start-list";
}

/** The error a refused scan shows, or null when it is recorded or confirmed. */
export function scanOutcomeMessage(outcome: ScanOutcome): string | null {
  switch (outcome.kind) {
    case "already-captured":
      return `Athlete ${outcome.athlete.athleteNo} ${outcome.athlete.fullName} is already captured in this heat.`;
    case "unknown":
      return `Athlete ${outcome.athleteNo} is not an athlete of this organization.`;
    default:
      return null;
  }
}
