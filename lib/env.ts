import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Validated at import time (first hit during build/boot) so a misconfigured
 * Supabase key fails loudly instead of surfacing as a runtime 401 on race
 * day (spec §5.16).
 */
export const env = createEnv({
  // Server-only, and optional so the app still boots without them: only
  // Invitations need them, and they fail loudly at that point (see
  // requireServerEnv). Never prefix these with NEXT_PUBLIC_.
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    ZEPTOMAIL_TOKEN: z.string().min(1).optional(),
    ZEPTOMAIL_API_URL: z.url().default("https://api.zeptomail.com/v1.1/email"),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  },
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ZEPTOMAIL_TOKEN: process.env.ZEPTOMAIL_TOKEN,
    ZEPTOMAIL_API_URL: process.env.ZEPTOMAIL_API_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
});

/** A server-only setting that Invitations can't work without. */
export function requireServerEnv(
  name: "SUPABASE_SERVICE_ROLE_KEY" | "ZEPTOMAIL_TOKEN",
): string {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is not set, so Invitations can't work.`);
  }
  return value;
}
