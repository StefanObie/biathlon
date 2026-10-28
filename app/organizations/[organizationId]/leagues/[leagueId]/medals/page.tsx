import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { canUse } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { getMedalBoard } from "@/lib/medals/query";
import { NoAccess } from "@/components/leagues/no-access";
import { MedalsBoard } from "@/components/medals/medals-board";

export default function MedalsPage({
  params,
}: {
  params: Promise<{ organizationId: string; leagueId: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground">Loading medals…</p>}
    >
      <Medals params={params} />
    </Suspense>
  );
}

async function Medals({
  params,
}: {
  params: Promise<{ organizationId: string; leagueId: string }>;
}) {
  const { organizationId, leagueId } = await params;
  const organizationIdNum = Number(organizationId);
  const leagueIdNum = Number(leagueId);
  if (!Number.isInteger(organizationIdNum) || !Number.isInteger(leagueIdNum)) {
    notFound();
  }

  const access = await getLeagueAccess(organizationIdNum, leagueIdNum);
  if (!access || !canUse(access, "medals")) return <NoAccess />;

  const supabase = await createClient();
  const groups = await getMedalBoard(supabase, leagueIdNum);

  return (
    <MedalsBoard
      league={{ organizationId: organizationIdNum, leagueId: leagueIdNum }}
      groups={groups}
    />
  );
}
