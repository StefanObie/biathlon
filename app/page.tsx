import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import {
  ORGANIZATION_COOKIE,
  rememberedOrganizationId,
  resolveLanding,
} from "@/lib/organizations/landing";
import { getFeaturedLeague } from "@/lib/results/featured";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center">
      <div className="flex flex-col gap-8 w-full max-w-2xl p-5 items-center text-center">
        <h1 className="text-3xl font-bold">Crossland Biathlon</h1>
        <Suspense>
          <FeaturedLeagueCard />
        </Suspense>
        <Suspense fallback={<div className="h-9" />}>
          <CallToAction />
        </Suspense>
      </div>
    </main>
  );
}

async function FeaturedLeagueCard() {
  const league = await getFeaturedLeague();
  if (!league) return null;

  const date = new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${league.league_date}T00:00:00Z`));

  return (
    <Link
      href={`/results/${league.results_slug}`}
      className="w-full rounded-lg border p-5 text-left transition-colors hover:bg-accent"
    >
      <p className="text-sm text-muted-foreground">Latest results</p>
      <p className="text-sm text-muted-foreground">
        {league.organization_name}
      </p>
      <p className="text-xl font-semibold">{league.name}</p>
      <p className="text-sm text-muted-foreground">{date}</p>
    </Link>
  );
}

// Sign in for visitors; for a Member, open their Organization through the
// Organization landing.
async function CallToAction() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) {
    return (
      <Button asChild>
        <Link href="/auth/login">Sign in</Link>
      </Button>
    );
  }

  const { data: memberships } = await supabase
    .from("organization_member")
    .select("organization(id, name)")
    .eq("user_id", userId);
  const organizations = (memberships ?? []).map(
    (membership) => membership.organization,
  );
  const cookieStore = await cookies();
  const landing = resolveLanding(
    organizations.map((organization) => organization.id),
    rememberedOrganizationId(cookieStore.get(ORGANIZATION_COOKIE)?.value),
  );
  const organization = organizations.find((o) => o.id === landing);

  return (
    <Button asChild>
      <Link href="/organizations">
        {organization ? `Open ${organization.name}` : "Open my Organizations"}
      </Link>
    </Button>
  );
}
