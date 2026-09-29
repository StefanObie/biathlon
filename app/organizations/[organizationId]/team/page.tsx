import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { NoAccess } from "@/components/leagues/no-access";
import { TeamRoles } from "@/components/organizations/team-roles";
import { teamRows } from "@/lib/organizations/team-rows";
import {
  removeFromDefaultTeam,
  setDefaultTeamRole,
} from "@/lib/organizations/default-team-actions";

export default function DefaultTeamPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading team…</p>}>
      <DefaultTeamSection params={params} />
    </Suspense>
  );
}

// Only an Admin of the Organization manages its Default team; RLS enforces
// that, and this shows everyone else "no access" rather than an empty
// table.
async function DefaultTeamSection({
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
        Only the organization&apos;s Admins can manage its Default team.
      </NoAccess>
    );
  }

  const [{ data: members, error }, { data: team }] = await Promise.all([
    supabase.rpc("organization_members", { org_id: organizationIdNum }),
    supabase
      .from("default_team_member")
      .select("user_id, role")
      .eq("organization_id", organizationIdNum),
  ]);

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href={`/leagues#organization-${organizationIdNum}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Leagues
        </Link>
        <h1 className="text-2xl font-bold">{membership.organization.name}</h1>
      </div>
      <TeamRoles
        title="Default team"
        description={
          <>
            A new league&apos;s team starts as a copy of this one, and can then
            be changed for that league. Changes here don&apos;t reach leagues
            that already exist.
          </>
        }
        rows={teamRows(members ?? [], team ?? [])}
        setRole={setDefaultTeamRole.bind(null, organizationIdNum)}
        remove={removeFromDefaultTeam.bind(null, organizationIdNum)}
      />
    </div>
  );
}
