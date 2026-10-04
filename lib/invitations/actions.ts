"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { ROLE_LABEL, LEAGUE_ROLES, type LeagueRole } from "@/lib/access/roles";
import { invitationEmail } from "@/lib/invitations/email";
import { createInvitationSecret } from "@/lib/invitations/secret";
import { sendEmail } from "@/lib/invitations/zeptomail";
import { createClient } from "@/lib/supabase/server";

export interface SendInvitationState {
  error?: string;
  sentTo?: string;
}

/**
 * Invites an email to an Organization, optionally with one Role on its
 * Default team or one League's team. The database checks the sender is an
 * Admin, replaces an open Invitation for the email and refuses an existing
 * Member. The secret in the link is made here and only its hash is stored.
 * If the email can't be sent, the Invitation is cancelled again so no
 * unsent link sits open.
 */
export async function sendInvitation(
  organizationId: number,
  _prevState: SendInvitationState,
  formData: FormData,
): Promise<SendInvitationState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email is required." };

  const roleValue = String(formData.get("role") ?? "");
  const role = LEAGUE_ROLES.find((r) => r === roleValue) ?? null;
  const team = String(formData.get("team") ?? "default");
  const leagueId = role && team !== "default" ? Number(team) : null;
  if (leagueId !== null && !Number.isInteger(leagueId)) {
    return { error: "Choose a team." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const inviterEmail = claims?.claims.email;
  if (!inviterEmail) return { error: "Sign in to invite people." };

  const { secret, hash } = createInvitationSecret();
  const { data: invitationId, error } = await supabase.rpc("send_invitation", {
    org_id: organizationId,
    invitee_email: email,
    invitee_role: role as LeagueRole,
    invitee_league_id: leagueId as number,
    new_secret_hash: hash,
  });
  if (error || !invitationId) {
    return { error: error?.message ?? "Failed to send the invitation." };
  }

  try {
    const [{ data: organization }, { data: league }] = await Promise.all([
      supabase
        .from("organization")
        .select("name")
        .eq("id", organizationId)
        .single(),
      leagueId === null
        ? { data: null }
        : supabase.from("league").select("name").eq("id", leagueId).single(),
    ]);

    const message = invitationEmail({
      organizationName: organization?.name ?? "an organization",
      inviterEmail,
      link: `${await origin()}/auth/invitation?token=${secret}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      roleText: role
        ? `${article(ROLE_LABEL[role])} ${ROLE_LABEL[role]}${league ? ` on ${league.name}` : " on the default team"}`
        : null,
    });
    await sendEmail({ to: email, replyTo: inviterEmail, ...message });
  } catch (sendError) {
    await supabase.rpc("cancel_invitation", { invitation_id: invitationId });
    revalidatePath(`/organizations/${organizationId}`);
    return {
      error:
        sendError instanceof Error
          ? `The email could not be sent: ${sendError.message}`
          : "The email could not be sent.",
    };
  }

  revalidatePath(`/organizations/${organizationId}`);
  return { sentTo: email.toLowerCase() };
}

export async function cancelInvitation(
  organizationId: number,
  invitationId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_invitation", {
    invitation_id: invitationId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/organizations/${organizationId}`);
  return {};
}

const article = (label: string) => (/^[AEIOU]/.test(label) ? "an" : "a");

async function origin(): Promise<string> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") || host?.startsWith("127.")
      ? "http"
      : "https");
  return `${protocol}://${host}`;
}
