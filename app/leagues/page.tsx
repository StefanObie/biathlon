import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { CreateLeagueForm } from "@/components/leagues/create-league-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LeaguesPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1 className="text-2xl font-bold">Leagues</h1>
          <Button asChild variant="outline" size="sm">
            <Link href="/organizations/new">Create organization</Link>
          </Button>
        </div>
        <Suspense
          fallback={<p className="text-muted-foreground">Loading leagues…</p>}
        >
          <LeaguesList />
        </Suspense>
      </div>

      <Suspense>
        <NewLeague />
      </Suspense>
    </div>
  );
}

// RLS limits both organizations and leagues to the Organizations the
// user is a Member of, so this lists exactly what they can open. A user
// with no Organization never gets here: the layout sends them to create
// one.
async function LeaguesList() {
  const supabase = await createClient();
  const { data: organizations, error } = await supabase
    .from("organization")
    .select("id, name, league(id, name, league_date, season)")
    .order("name")
    .order("league_date", { referencedTable: "league", ascending: false });

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {organizations.map((organization) => (
        <section
          key={organization.id}
          id={`organization-${organization.id}`}
          className="flex flex-col gap-2 scroll-mt-4"
        >
          <h2 className="text-lg font-semibold">{organization.name}</h2>
          {organization.league.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leagues yet.</p>
          ) : (
            organization.league.map((league) => (
              <Link key={league.id} href={`/leagues/${league.id}`}>
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
      ))}
    </div>
  );
}

// Only Admins can create Leagues, so the form is shown only to someone who
// administers at least one Organization, offering just those.
async function NewLeague() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;

  const { data: memberships } = await supabase
    .from("organization_member")
    .select("organization(id, name)")
    .eq("user_id", userId)
    .eq("is_admin", true);

  const organizations = (memberships ?? [])
    .map((membership) => membership.organization)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (organizations.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>New league</CardTitle>
      </CardHeader>
      <CardContent>
        <CreateLeagueForm organizations={organizations} />
      </CardContent>
    </Card>
  );
}
