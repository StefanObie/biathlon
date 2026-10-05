import { createClient } from "@supabase/supabase-js";

import { env, requireServerEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * A client with the invite_members_email secret key, which bypasses RLS. Server-only, and
 * used only to accept an Invitation from its link: the invitee has no
 * session yet, so nothing else can. Create one per use, like the others.
 */
export function createAdminClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    requireServerEnv("INVITE_MEMBERS_EMAIL_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
