import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRightIcon } from "lucide-react";

import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import {
  ORGANIZATION_COOKIE,
  rememberedOrganizationId,
  resolveLanding,
} from "@/lib/organizations/landing";
import { getFeaturedLeague } from "@/lib/results/featured";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center px-6 pb-8 pt-16 text-center">
      <Logo size={72} preload />
      <h1 className="mt-4 text-[28px] font-medium leading-tight tracking-tight">
        Crossland Biathlon
      </h1>
      <Suspense>
        <FeaturedLeagueCard />
      </Suspense>
      <Suspense fallback={<div className="mt-6 h-5" />}>
        <HostingLine />
      </Suspense>
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
      className="mt-8 flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent active:bg-accent"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-medium">
          {league.is_today ? "Today" : "Latest results"}
        </span>
        <span className="text-xl font-medium leading-snug">{league.name}</span>
        <span className="text-sm text-muted-foreground">
          {league.organization_name}
        </span>
        <span className="text-sm text-muted-foreground">{date}</span>
      </span>
      <ArrowRightIcon className="size-5 shrink-0" aria-hidden />
    </Link>
  );
}

// Signing in is only for someone hosting a race, so it stays out of the way of
// people here for results; a Member opens their Organization through the
// Organization landing.
async function HostingLine() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        Hosting your own race?{" "}
        <Link
          href="/auth/login"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
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
    <p className="mt-6 text-sm">
      <Link
        href="/organizations"
        className="font-medium underline underline-offset-4"
      >
        {organization ? `Open ${organization.name}` : "Open my Organizations"}
      </Link>
    </p>
  );
}
