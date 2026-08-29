import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { CreateMeetForm } from "@/components/meets/create-meet-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MeetsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold mb-4">Meets</h1>
        <Suspense
          fallback={<p className="text-muted-foreground">Loading meets…</p>}
        >
          <MeetsList />
        </Suspense>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New meet</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateMeetForm />
        </CardContent>
      </Card>
    </div>
  );
}

async function MeetsList() {
  const supabase = await createClient();
  const { data: meets, error } = await supabase
    .from("meet")
    .select("id, name, meet_date, season")
    .order("meet_date", { ascending: false });

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  if (!meets || meets.length === 0) {
    return (
      <p className="text-muted-foreground">No meets yet — create one below.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {meets.map((meet) => (
        <Link key={meet.id} href={`/meets/${meet.id}/roster`}>
          <Card className="hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle>{meet.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {meet.meet_date} · Season {meet.season}
              </p>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
