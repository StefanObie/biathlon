import { NextResponse, type NextRequest } from "next/server";

import { acceptDecision, landingPath } from "@/lib/invitations/landing";
import { hashInvitationSecret } from "@/lib/invitations/secret";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Follows an Invitation link (#34). The link's GET only loads a landing
 * page, which posts here, so a mail scanner that opens links can't use it
 * up. This confirms the invitee's email, signs them in (creating the
 * account if needed) and accepts the Invitation, with no Sign-in OTP.
 *
 * Anything that goes wrong sends the visitor to the normal sign-in page.
 * A different signed-in user is left alone and the Invitation isn't
 * consumed: they carry on down the usual path (create an Organization).
 */
export async function POST(request: NextRequest) {
  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, request.url), 303);

  const token = String((await request.formData()).get("token") ?? "");
  if (!token) return redirectTo("/auth/login");
  const hash = hashInvitationSecret(token);

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: open } = await admin
    .from("invitation")
    .select("email")
    .eq("secret_hash", hash)
    .is("accepted_at", null)
    .is("cancelled_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  const { data: claims } = await supabase.auth.getClaims();
  const signedInEmail = claims?.claims.email ?? null;
  const decision = acceptDecision(open?.email ?? null, signedInEmail);

  if (decision === "sign-in") return redirectTo("/auth/login");
  if (decision === "other-user") return redirectTo("/leagues");

  // generateLink makes the account if the email has none, and gives a token
  // that signs in as it; nothing is emailed.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: open!.email,
  });
  if (linkError || !link.user) return redirectTo("/auth/login");

  // Accepting is atomic, so of two people opening the link at once only one
  // gets this far, and the other never gets a session.
  const { data: landing, error: acceptError } = await admin
    .rpc("accept_invitation", {
      secret_hash_in: hash,
      accepting_user: link.user.id,
    })
    .single();
  if (acceptError || !landing) return redirectTo("/auth/login");

  if (decision === "sign-invitee-in") {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "email",
    });
    if (verifyError) return redirectTo("/auth/login");
  }

  return redirectTo(
    landingPath({
      organizationId: landing.landing_organization_id,
      role: landing.landing_role,
      leagueId: landing.landing_league_id,
    }),
  );
}
