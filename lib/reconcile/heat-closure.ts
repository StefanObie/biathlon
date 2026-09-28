import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/reconcile/audit";
import type { HeatClosed } from "@/lib/capture/heat-closed";

/**
 * Closes a heat if it isn't closed already (ADR 0001) and writes the close
 * to audit_log. Returns the new closed state, or null when the heat was
 * already closed — saving again leaves the original close as it was.
 *
 * The "already closed" check is in the write itself, not read first, so two
 * officials saving at once can't both close it.
 */
export async function closeHeat({
  leagueId,
  runHeat,
  actor,
}: {
  leagueId: number;
  runHeat: number;
  actor: string;
}): Promise<{ closed: HeatClosed | null; error: string | null }> {
  const supabase = createClient();
  const closed = { closed_at: new Date().toISOString(), closed_by: actor };

  // The row usually exists already (the timer started the heat)…
  const updated = await supabase
    .from("league_race")
    .update(closed)
    .eq("league_id", leagueId)
    .eq("run_heat", runHeat)
    .is("closed_at", null)
    .select("run_heat");
  if (updated.error) return { closed: null, error: updated.error.message };

  let didClose = updated.data.length > 0;
  if (!didClose) {
    // …but not always: a heat can be reconciled with no timer start. If the
    // row exists, it's already closed and this insert does nothing.
    const inserted = await supabase
      .from("league_race")
      .upsert(
        { league_id: leagueId, run_heat: runHeat, ...closed },
        { onConflict: "league_id,run_heat", ignoreDuplicates: true },
      )
      .select("run_heat");
    if (inserted.error) return { closed: null, error: inserted.error.message };
    didClose = inserted.data.length > 0;
  }
  if (!didClose) return { closed: null, error: null };

  await logAudit({
    leagueId,
    actor,
    entity: "league_race",
    action: "close",
    after: { league_id: leagueId, run_heat: runHeat, ...closed },
    reason: `Closed run heat ${runHeat}`,
  });
  return {
    closed: { closedAt: closed.closed_at, closedBy: closed.closed_by },
    error: null,
  };
}

/**
 * Reopens a closed heat, so its capture screens take captures again, and
 * writes the reopen with the official's reason to audit_log. A heat someone
 * else already reopened is left alone and not logged again.
 */
export async function reopenHeat({
  leagueId,
  runHeat,
  actor,
  reason,
  before,
}: {
  leagueId: number;
  runHeat: number;
  actor: string;
  reason: string;
  before: HeatClosed;
}): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("league_race")
    .update({ closed_at: null, closed_by: null })
    .eq("league_id", leagueId)
    .eq("run_heat", runHeat)
    .not("closed_at", "is", null)
    .select("run_heat");
  if (error) return { error: error.message };
  if (data.length === 0) return { error: null };

  await logAudit({
    leagueId,
    actor,
    entity: "league_race",
    action: "reopen",
    before: {
      league_id: leagueId,
      run_heat: runHeat,
      closed_at: before.closedAt,
      closed_by: before.closedBy,
    },
    after: { league_id: leagueId, run_heat: runHeat, closed_at: null },
    reason,
  });
  return { error: null };
}
