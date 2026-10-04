import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { leagueAddress } from "@/lib/leagues/address";
import { splitLeagues } from "@/lib/leagues/split";
import { ROLE_LABEL } from "@/lib/access/roles";
import {
  removeFromDefaultTeam,
  setDefaultTeamRole,
} from "@/lib/organizations/default-team-actions";
import { teamRows } from "@/lib/organizations/team-rows";
import { InviteForm } from "@/components/invitations/invite-form";
import { PendingInvitations } from "@/components/invitations/pending-invitations";
import { NewLeagueButton } from "@/components/leagues/new-league-button";
import { MembersList } from "@/components/members/members-list";
import { TeamRoles } from "@/components/organizations/team-roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tab = "leagues" | "members" | "team";

type Params = Promise<{ organizationId: string }>;
type SearchParams = Promise<{ tab?: string | string[] }>;

// The Organization home: Leagues for every Member, Members and Default team
// for Admins. It's also where an Invitation lands someone with no League
// Role.
export default function OrganizationPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<div className="h-24" />}>
      <OrganizationSection params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function OrganizationSection({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { organizationId } = await params;
  const { tab: tabParam } = await searchParams;
  const organizationIdNum = Number(organizationId);
  if (!Number.isInteger(organizationIdNum)) notFound();

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) notFound();

  // RLS only shows an Organization to its Members, so no membership means
  // there's nothing here for this user.
  const { data: membership } = await supabase
    .from("organization_member")
    .select("is_admin, organization(id, name)")
    .eq("organization_id", organizationIdNum)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) notFound();

  const { is_admin: isAdmin, organization } = membership;
  const requested = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  const tab: Tab =
    isAdmin && (requested === "members" || requested === "team")
      ? requested
      : "leagues";

  const tabs: { id: Tab; label: string }[] = [
    { id: "leagues", label: "Leagues" },
    ...(isAdmin
      ? [
          { id: "members" as const, label: "Members" },
          { id: "team" as const, label: "Default team" },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{organization.name}</h1>
      {tabs.length > 1 && (
        <nav className="flex gap-1 border-b" aria-label="Organization">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={
                t.id === "leagues"
                  ? `/organizations/${organizationIdNum}`
                  : `/organizations/${organizationIdNum}?tab=${t.id}`
              }
              aria-current={t.id === tab ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                t.id === tab
                  ? "border-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
      {tab === "leagues" && (
        <LeaguesTab organization={organization} isAdmin={isAdmin} />
      )}
      {tab === "members" && (
        <MembersTab organizationId={organizationIdNum} userId={userId} />
      )}
      {tab === "team" && <TeamTab organizationId={organizationIdNum} />}
    </div>
  );
}

async function LeaguesTab({
  organization,
  isAdmin,
}: {
  organization: { id: number; name: string };
  isAdmin: boolean;
}) {
  const supabase = await createClient();
  const { data: leagues, error } = await supabase
    .from("league")
    .select("id, name, league_date, season")
    .eq("organization_id", organization.id);
  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  const today = new Date().toISOString().slice(0, 10);
  const { upcoming, past } = splitLeagues(leagues ?? [], today);

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && (
        <div>
          <NewLeagueButton organization={organization} />
        </div>
      )}
      <LeagueGroup
        title="Upcoming"
        organizationId={organization.id}
        leagues={upcoming}
      />
      <LeagueGroup
        title="Past"
        organizationId={organization.id}
        leagues={past}
      />
    </div>
  );
}

function LeagueGroup({
  title,
  organizationId,
  leagues,
}: {
  title: string;
  organizationId: number;
  leagues: { id: number; name: string; league_date: string; season: number }[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {leagues.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No {title.toLowerCase()} leagues.
        </p>
      ) : (
        leagues.map((league) => (
          <Link
            key={league.id}
            href={leagueAddress({ organizationId, leagueId: league.id })}
          >
            <Card className="hover:bg-accent transition-colors">
              <CardHeader>
                <CardTitle>{league.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {league.league_date} · Season {league.season}
                </p>
              </CardHeader>
            </Card>
          </Link>
        ))
      )}
    </section>
  );
}

// Members, pending Invitations and the invite form in one place.
async function MembersTab({
  organizationId,
  userId,
}: {
  organizationId: number;
  userId: string;
}) {
  const supabase = await createClient();
  const [
    { data: members, error: membersError },
    { data: leagues },
    { data: invitations, error },
  ] = await Promise.all([
    supabase.rpc("organization_members", { org_id: organizationId }),
    supabase
      .from("league")
      .select("id, name")
      .eq("organization_id", organizationId)
      .order("league_date", { ascending: false }),
    supabase
      .from("invitation")
      .select("id, email, role, league_id, expires_at, invited_by_email")
      .eq("organization_id", organizationId)
      .is("accepted_at", null)
      .is("cancelled_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  if (membersError || error) {
    return (
      <p className="text-sm text-destructive">
        {(membersError ?? error)?.message}
      </p>
    );
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
      <MembersList
        organizationId={organizationId}
        rows={(members ?? []).map((member) => ({
          userId: member.user_id,
          email: member.email,
          isAdmin: member.is_admin,
          isYou: member.user_id === userId,
        }))}
      />
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Pending invitations</h2>
        <PendingInvitations organizationId={organizationId} rows={rows} />
      </section>
      <Card>
        <CardHeader>
          <CardTitle>New invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm organizationId={organizationId} leagues={leagues ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}

async function TeamTab({ organizationId }: { organizationId: number }) {
  const supabase = await createClient();
  const [{ data: members, error }, { data: team }] = await Promise.all([
    supabase.rpc("organization_members", { org_id: organizationId }),
    supabase
      .from("default_team_member")
      .select("user_id, role")
      .eq("organization_id", organizationId),
  ]);
  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  return (
    <TeamRoles
      title="Default team"
      description={
        <>
          A new league&apos;s team starts as a copy of this one, and can then be
          changed for that league. Changes here don&apos;t reach leagues that
          already exist.
        </>
      }
      rows={teamRows(members ?? [], team ?? [])}
      setRole={setDefaultTeamRole.bind(null, organizationId)}
      remove={removeFromDefaultTeam.bind(null, organizationId)}
    />
  );
}
