import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/reconcile/audit";
import type { HeatClosed } from "@/lib/capture/heat-closed";

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
