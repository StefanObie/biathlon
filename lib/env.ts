import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Validated at import time (first hit during build/boot) so a misconfigured
 * Supabase key fails loudly instead of surfacing as a runtime 401 on race
 * day (spec §5.16).
 */
export const env = createEnv({
  // Server-only, and optional so the app still boots without them: only
  // Invitations and fetching swims from Drive need them, and they fail
  // loudly at that point (see requireServerEnv). Never prefix these with
  // NEXT_PUBLIC_.
  server: {
    INVITE_MEMBERS_EMAIL_SECRET_KEY: z.string().min(1).optional(),
    ZEPTOMAIL_TOKEN: z.string().min(1).optional(),
    ZEPTOMAIL_API_URL: z.url().default("https://api.zeptomail.com/v1.1/email"),
    // The Swim folder service account's JSON key, as Google downloads it
    // (ADR 0005).
    GOOGLE_SERVICE_ACCOUNT_KEY: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  },
  runtimeEnv: {
    INVITE_MEMBERS_EMAIL_SECRET_KEY:
      process.env.INVITE_MEMBERS_EMAIL_SECRET_KEY,
    ZEPTOMAIL_TOKEN: process.env.ZEPTOMAIL_TOKEN,
    ZEPTOMAIL_API_URL: process.env.ZEPTOMAIL_API_URL,
    GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
});

const NEEDED_BY = {
  INVITE_MEMBERS_EMAIL_SECRET_KEY: "Invitations",
  ZEPTOMAIL_TOKEN: "Invitations",
  GOOGLE_SERVICE_ACCOUNT_KEY: "fetching swims from Google Drive",
} as const;

/** A server-only setting that a feature can't work without. */
export function requireServerEnv(name: keyof typeof NEEDED_BY): string {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is not set, so ${NEEDED_BY[name]} can't work.`);
  }
  return value;
}
