"use server";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export interface RequestLoginState {
  status?: "otp_sent" | "needs_invite_code";
  error?: string;
}

/**
 * Tries to send an OTP without creating a new account. GoTrue rejects this
 * with `otp_disabled` when the email has no existing user — that's the
 * signal to prompt for an invite code instead of silently signing anyone up.
 */
export async function requestLogin(
  _prevState: RequestLoginState,
  formData: FormData,
): Promise<RequestLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Email is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (!error) {
    return { status: "otp_sent" };
  }
  if (error.code === "otp_disabled") {
    return { status: "needs_invite_code" };
  }
  return { error: error.message };
}

export interface RequestSignupState {
  status?: "otp_sent";
  error?: string;
}

/**
 * Creates a new account, gated by a shared invite code distributed
 * out-of-band to the team (spec: operator accounts are provisioned, not
 * open self-signup).
 */
export async function requestSignup(
  _prevState: RequestSignupState,
  formData: FormData,
): Promise<RequestSignupState> {
  const email = String(formData.get("email") ?? "").trim();
  const inviteCode = String(formData.get("inviteCode") ?? "").trim();

  if (!email) {
    return { error: "Email is required." };
  }
  if (inviteCode !== env.INVITE_CODE) {
    return { error: "Invalid invite code." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    return { error: error.message };
  }
  return { status: "otp_sent" };
}
