import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export default function RosterPage({
  params,
}: {
  params: Promise<{ meetId: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground">Loading roster…</p>}
    >
      <RosterTable params={params} />
    </Suspense>
  );
}

async function RosterTable({
  params,
}: {
  params: Promise<{ meetId: string }>;
}) {
  const { meetId } = await params;
  const meetIdNum = Number(meetId);
  if (!Number.isInteger(meetIdNum)) notFound();

  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("entry")
    .select(
      "athlete_no, run_heat, swim_heat, swim_lane, age_group_code, athlete(full_name, gender)",
    )
    .eq("meet_id", meetIdNum)
    .order("run_heat")
    .order("athlete_no");

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  if (!entries || entries.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No entries yet</EmptyTitle>
          <EmptyDescription>
            Import the entry list to get started.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href={`/meets/${meetIdNum}/import`}>Import entries</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{entries.length} athletes</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>No.</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Age group</TableHead>
            <TableHead>Run heat</TableHead>
            <TableHead>Swim heat</TableHead>
            <TableHead>Swim lane</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.athlete_no}>
              <TableCell className="font-mono tabular-nums">
                {entry.athlete_no}
              </TableCell>
              <TableCell>{entry.athlete?.full_name}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {entry.age_group_code} {entry.athlete?.gender}
                </Badge>
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {entry.run_heat}
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {entry.swim_heat}
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {entry.swim_lane}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
