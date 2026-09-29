"use server";

import { createClient } from "@/lib/supabase/server";

export interface RequestOtpState {
  status?: "otp_sent";
  error?: string;
}

/**
 * Emails a Sign-in OTP to any address, creating the account on first use.
 * There's no invite code: a new user signs in and then creates their own
 * Organization (#30), so an account alone grants no access to anything.
 */
export async function requestOtp(
  _prevState: RequestOtpState,
  formData: FormData,
): Promise<RequestOtpState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Email is required." };
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
