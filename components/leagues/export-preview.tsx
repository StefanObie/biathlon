"use client";

import { DownloadIcon } from "lucide-react";

import type { ExportPreviewRow } from "@/lib/export/query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export function ExportPreview({
  leagueId,
  leagueName,
  rows,
  excludedCount,
}: {
  leagueId: number;
  leagueName: string;
  rows: ExportPreviewRow[];
  excludedCount: number;
}) {
  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No results to export yet</EmptyTitle>
          <EmptyDescription>
            {excludedCount > 0
              ? `${excludedCount} ${excludedCount === 1 ? "athlete is" : "athletes are"} entered, but none have a swim or run time recorded.`
              : "Import a start list and capture some results first."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const missingSwim = rows.filter((row) => row.swimTime === null).length;
  const missingRun = rows.filter((row) => row.runTime === null).length;
  const nonOk = rows.filter(
    (row) => isFlagged(row.swimStatus) || isFlagged(row.runStatus),
  ).length;
  const strayHeats = rows.filter((row) => row.strayRunHeats.length > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{leagueName}</span>
          <Badge variant="secondary">{rows.length} athletes</Badge>
          {missingSwim > 0 && (
            <Badge variant="outline">{missingSwim} missing swim</Badge>
          )}
          {missingRun > 0 && (
            <Badge variant="outline">{missingRun} missing run</Badge>
          )}
          {nonOk > 0 && <Badge variant="outline">{nonOk} dns/dnf/dq</Badge>}
          {strayHeats > 0 && (
            <Badge variant="destructive">{strayHeats} in other heats</Badge>
          )}
          {excludedCount > 0 && (
            <Badge variant="outline">{excludedCount} with no times</Badge>
          )}
        </div>

        <Button asChild>
          <a href={`/leagues/${leagueId}/export/xml`}>
            <DownloadIcon />
            Download XML
          </a>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Every recorded time is exported as recorded, including dns, dnf and dq.
        Remove anything that should not reach SA Biathlon from the file by hand.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Athlete no</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Swim</TableHead>
            <TableHead>Run</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.athleteNo}>
              <TableCell className="font-mono">{row.athleteNo}</TableCell>
              <TableCell>{row.fullName}</TableCell>
              <TableCell className="font-mono">
                {row.swimTime ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="font-mono">
                {row.runTime ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="flex flex-wrap gap-1">
                {isFlagged(row.swimStatus) && (
                  <Badge variant="outline">swim {row.swimStatus}</Badge>
                )}
                {isFlagged(row.runStatus) && (
                  <Badge variant="outline">run {row.runStatus}</Badge>
                )}
                {row.strayRunHeats.length > 0 && (
                  <Badge variant="destructive">
                    also heat {row.strayRunHeats.join(", ")}
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function isFlagged(status: string | null) {
  return status !== null && status !== "ok";
}
