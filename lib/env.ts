import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Validated at import time (first hit during build/boot) so a misconfigured
 * Supabase key fails loudly instead of surfacing as a runtime 401 on race
 * day (spec §5.16).
 */
export const env = createEnv({
  server: {},
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  },
  runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
});
