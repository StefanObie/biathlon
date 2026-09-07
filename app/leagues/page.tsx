import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { CreateLeagueForm } from "@/components/leagues/create-league-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export default function LeaguesPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold mb-4">Leagues</h1>
        <Suspense
          fallback={<p className="text-muted-foreground">Loading leagues…</p>}
        >
          <LeaguesList />
        </Suspense>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New league</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateLeagueForm />
        </CardContent>
      </Card>
    </div>
  );
}

async function LeaguesList() {
  const supabase = await createClient();
  const { data: leagues, error } = await supabase
    .from("league")
    .select("id, name, league_date, season")
    .order("league_date", { ascending: false });

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  if (!leagues || leagues.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No leagues yet</EmptyTitle>
          <EmptyDescription>Create one below to get started.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {leagues.map((league) => (
        <Link key={league.id} href={`/leagues/${league.id}/start-list`}>
          <Card className="hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle>{league.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {league.league_date} · Season {league.season}
              </p>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
