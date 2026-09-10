import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Every reconciliation mutation writes an audit_log row alongside its real
 * effect (never a substitute for it) — cheap enough to do for every edit,
 * not just the ones that change a saved result.
 */
export async function logAudit({
  actor,
  entity,
  action,
  before,
  after,
  reason,
}: {
  actor: string;
  entity: string;
  action: string;
  before?: Json | null;
  after?: Json | null;
  reason?: string | null;
}): Promise<void> {
  const supabase = createClient();
  await supabase.from("audit_log").insert({
    actor,
    entity,
    action,
    before: before ?? null,
    after: after ?? null,
    reason: reason ?? null,
  });
}
