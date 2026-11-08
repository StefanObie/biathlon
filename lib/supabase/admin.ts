import { createClient } from "@supabase/supabase-js";

import { env, requireServerEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * A client with the invite_members_email secret key, which bypasses RLS.
 * Server-only, and used only for Invitations: to send one, so the browser
 * never picks a link's secret, and to accept one from its link, since the
 * invitee has no session yet. Create one per use, like the others.
 */
export function createAdminClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    requireServerEnv("INVITE_MEMBERS_EMAIL_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
