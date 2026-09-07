import { Suspense } from "react";
import { redirect } from "next/navigation";

export default function LeagueIndexPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <RedirectToStartList params={params} />
    </Suspense>
  );
}

async function RedirectToStartList({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}): Promise<never> {
  const { leagueId } = await params;
  redirect(`/leagues/${leagueId}/start-list`);
}
