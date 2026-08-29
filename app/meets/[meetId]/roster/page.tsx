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
      <p className="text-muted-foreground">
        No entries yet.{" "}
        <Link href={`/meets/${meetIdNum}/import`} className="underline">
          Import the entry list
        </Link>{" "}
        to get started.
      </p>
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
              <TableCell>{entry.athlete_no}</TableCell>
              <TableCell>{entry.athlete?.full_name}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {entry.age_group_code} {entry.athlete?.gender}
                </Badge>
              </TableCell>
              <TableCell>{entry.run_heat}</TableCell>
              <TableCell>{entry.swim_heat}</TableCell>
              <TableCell>{entry.swim_lane}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
