import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { NoAccess } from "@/components/leagues/no-access";
import { InviteForm } from "@/components/invitations/invite-form";
import { PendingInvitations } from "@/components/invitations/pending-invitations";
import { ROLE_LABEL } from "@/lib/access/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function InvitationsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground">Loading invitations…</p>}
    >
      <InvitationsSection params={params} />
    </Suspense>
  );
}

// Only an Admin of the Organization sends and cancels Invitations; RLS and
// the database functions enforce that, and this shows everyone else "no
// access" rather than an empty page.
async function InvitationsSection({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const organizationIdNum = Number(organizationId);
  if (!Number.isInteger(organizationIdNum)) notFound();

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return <NoAccess />;

  const { data: membership } = await supabase
    .from("organization_member")
    .select("is_admin, organization(name)")
    .eq("organization_id", organizationIdNum)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership?.is_admin) {
    return (
      <NoAccess>
        Only the organization&apos;s Admins can invite members.
      </NoAccess>
    );
  }

  const [{ data: leagues }, { data: invitations, error }] = await Promise.all([
    supabase
      .from("league")
      .select("id, name")
      .eq("organization_id", organizationIdNum)
      .order("league_date", { ascending: false }),
    supabase
      .from("invitation")
      .select("id, email, role, league_id, expires_at, invited_by_email")
      .eq("organization_id", organizationIdNum)
      .is("accepted_at", null)
      .is("cancelled_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  const leagueNames = new Map((leagues ?? []).map((l) => [l.id, l.name]));
  const rows = (invitations ?? []).map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    roleText: invitation.role
      ? `${ROLE_LABEL[invitation.role]} on ${
          invitation.league_id === null
            ? "the default team"
            : (leagueNames.get(invitation.league_id) ?? "a league that's gone")
        }`
      : "No role",
    expiresOn: new Date(invitation.expires_at).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }),
    sentBy: invitation.invited_by_email,
  }));

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <Link
          href={`/leagues#organization-${organizationIdNum}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Leagues
        </Link>
        <h1 className="text-2xl font-bold">
          Invite members to {membership.organization.name}
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm
            organizationId={organizationIdNum}
            leagues={leagues ?? []}
          />
        </CardContent>
      </Card>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Pending invitations</h2>
        <PendingInvitations organizationId={organizationIdNum} rows={rows} />
      </section>
    </div>
  );
}
