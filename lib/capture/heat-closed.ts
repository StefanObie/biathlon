/** Whether a heat is closed (ADR 0001): when and by whom, or nulls while
 * it is open — never closed, or reopened. */
export interface HeatClosed {
  closedAt: string | null;
  closedBy: string | null;
}

export const OPEN_HEAT: HeatClosed = { closedAt: null, closedBy: null };

/** Reads the closed state off a league_race row; no row means open. */
export function toHeatClosed(
  row: { closed_at: string | null; closed_by: string | null } | null,
): HeatClosed {
  return { closedAt: row?.closed_at ?? null, closedBy: row?.closed_by ?? null };
}
