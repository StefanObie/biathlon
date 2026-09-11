"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/reconcile/audit";
import {
  buildWorkingRows,
  computeAutomaticChecks,
  mismatchFor,
  type Mismatch,
  type PositionEntry,
  type RunStatus,
  type TimeEntry,
  type WorkingRow,
} from "@/lib/reconcile/join";
import {
  AthleteCombobox,
  type AthleteOption,
} from "@/components/capture/athlete-combobox";
import { RowInsertDivider } from "@/components/capture/row-insert-divider";
import { HeatContextBar } from "@/components/leagues/heat-context-bar";

export interface RemotePositionCapture {
  id: string;
  position: number;
  athlete_no: number | null;
  voided: boolean;
  void_reason: string | null;
  scanned_at: string;
  device_id: string;
}

export interface RemoteTimeCapture {
  id: string;
  seq: number;
  elapsed_time: string;
  is_placeholder: boolean;
  voided: boolean;
  void_reason: string | null;
  captured_at: string;
  device_id: string;
}

export interface RemoteRunResult {
  athlete_no: number;
  run_time: string | null;
  status: string;
  source: string;
  overridden_by: string | null;
  override_reason: string | null;
}

export interface RosterAthlete {
  athleteNo: number;
  fullName: string;
}

const MISMATCH_LABEL: Record<Mismatch, string> = {
  "skip-at-table": "Skipped at table",
  "placeholder-needs-time": "Placeholder — enter time",
  "position-without-time": "No time captured",
  "time-without-position": "No position captured",
  gap: "Gap — needs athlete and time",
};

const TIME_PATTERN = /^\d{2}:\d{2}\.\d{2}$/;

export function Reconcile({
  leagueId,
  leagueName,
  runHeat,
  heats,
  roster,
  leagueRoster,
  remotePositionCaptures,
  remoteTimeCaptures,
  remoteRunResults,
  duplicateRunResults,
}: {
  leagueId: number;
  leagueName: string;
  runHeat: number;
  heats: number[];
  roster: RosterAthlete[];
  leagueRoster: RosterAthlete[];
  remotePositionCaptures: RemotePositionCapture[];
  remoteTimeCaptures: RemoteTimeCapture[];
  remoteRunResults: RemoteRunResult[];
  duplicateRunResults: { athlete_no: number; run_heat: number }[];
}) {
  const rosterByNo = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of roster) map.set(a.athleteNo, a.fullName);
    return map;
  }, [roster]);
  const rosterAthleteNos = useMemo(
    () => new Set(roster.map((a) => a.athleteNo)),
    [roster],
  );
  const athleteOptions: AthleteOption[] = useMemo(
    () =>
      leagueRoster.map((a) => ({
        athleteNo: a.athleteNo,
        fullName: a.fullName,
      })),
    [leagueRoster],
  );

  const initialRows = useMemo(() => {
    const positions: PositionEntry[] = remotePositionCaptures
      .filter((c) => !c.voided)
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        position: c.position,
        athleteNo: c.athlete_no,
      }));
    const times: TimeEntry[] = remoteTimeCaptures
      .filter((c) => !c.voided)
      .sort((a, b) => a.seq - b.seq)
      .map((c) => ({
        id: c.id,
        seq: c.seq,
        elapsedTime: c.elapsed_time,
        isPlaceholder: c.is_placeholder,
      }));

    const rows = buildWorkingRows(positions, times, rosterByNo);

    // Overlay any already-saved run_result rows (a previous reconciliation
    // pass) onto the athlete they belong to, so re-opening a partly-worked
    // heat doesn't discard prior edits.
    const resultByAthlete = new Map(
      remoteRunResults.map((r) => [r.athlete_no, r]),
    );
    return rows.map((row) => {
      if (row.athleteNo === null) return row;
      const saved = resultByAthlete.get(row.athleteNo);
      if (!saved) return row;
      return {
        ...row,
        runTime: saved.run_time ?? row.runTime,
        status: (saved.status as RunStatus) ?? row.status,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [rows, setRows] = useState<WorkingRow[]>(initialRows);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Live updates as captures sync in from the field phones (§5.3). Any
  // insert/update on either capture table for this heat re-fetches the
  // page's server data on next navigation; here we just nudge the operator
  // that new captures have arrived rather than silently rewriting their
  // in-progress edits out from under them.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribe() {
      // postgres_changes authorizes against RLS using the realtime socket's
      // own auth, which defaults to the anon key — without this,
      // position_capture/time_capture's authenticated-only policies (§6.5)
      // make every change invisible to the subscription (silently, no
      // error: the row insert succeeds, the broadcast is just dropped).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`reconcile-${leagueId}-${runHeat}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "position_capture",
            filter: `league_id=eq.${leagueId}`,
          },
          () =>
            toast.info("New position captures arrived — refresh to load them."),
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "time_capture",
            filter: `league_id=eq.${leagueId}`,
          },
          () => toast.info("New time captures arrived — refresh to load them."),
        )
        .subscribe();
    }

    void subscribe();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [leagueId, runHeat]);

  const duplicateAthletes = useMemo(
    () =>
      duplicateRunResults
        .filter((r) => rosterAthleteNos.has(r.athlete_no))
        .map((r) => ({ athleteNo: r.athlete_no, otherHeat: r.run_heat })),
    [duplicateRunResults, rosterAthleteNos],
  );

  const checks = useMemo(
    () =>
      computeAutomaticChecks({
        rosterCount: roster.length,
        rows,
        rosterAthleteNos,
        duplicateAthletes,
      }),
    [roster.length, rows, rosterAthleteNos, duplicateAthletes],
  );

  function markDirty() {
    setDirty(true);
  }

  function insertGapAt(index: number) {
    setRows((prev) => {
      const gap: WorkingRow = {
        localId: `gap-${Date.now()}-${Math.random()}`,
        position: null,
        time: null,
        athleteNo: null,
        athleteName: null,
        runTime: null,
        status: "ok",
      };
      const next = [...prev];
      next.splice(index, 0, gap);
      return next;
    });
    markDirty();
  }

  function removeRowAt(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    markDirty();
  }

  function updateRow(localId: string, patch: Partial<WorkingRow>) {
    setRows((prev) =>
      prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)),
    );
    markDirty();
  }

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const actor = user?.email ?? "unknown";

      const toSave = rows.filter((r) => r.athleteNo !== null);
      const invalidTime = toSave.find(
        (r) => r.runTime !== null && !TIME_PATTERN.test(r.runTime),
      );
      if (invalidTime) {
        toast.error(
          `${invalidTime.athleteName ?? invalidTime.athleteNo}: time must be mm:SS.ss`,
        );
        return;
      }

      const payload = toSave.map((r) => ({
        league_id: leagueId,
        athlete_no: r.athleteNo as number,
        run_heat: runHeat,
        run_time: r.status === "ok" ? r.runTime : null,
        status: r.status,
        source: "manual",
        overridden_by: actor,
        override_reason: "reconciliation save",
      }));

      if (payload.length > 0) {
        const { error } = await supabase.from("run_result").upsert(payload, {
          onConflict: "league_id,athlete_no,run_heat",
        });
        if (error) {
          toast.error(error.message);
          return;
        }
      }

      await logAudit({
        actor,
        entity: "run_result",
        action: "reconcile-save",
        after: payload,
        reason: `Reconciled run heat ${runHeat}`,
      });

      setDirty(false);
      toast.success("Reconciliation saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">Run heat {runHeat}</p>

      {checks.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          {checks.map((c, i) => (
            <p key={i}>⚠ {c.message}</p>
          ))}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pos</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Athlete</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <RowInsertDivider onInsert={() => insertGapAt(0)} />
          {rows.map((row, index) => {
            const mismatch = mismatchFor(row);
            return (
              <Fragment key={row.localId}>
                <TableRow>
                  <TableCell className="tabular-nums">{index + 1}</TableCell>
                  <TableCell>
                    <Input
                      value={row.runTime ?? ""}
                      onChange={(e) =>
                        updateRow(row.localId, { runTime: e.target.value })
                      }
                      placeholder="mm:SS.ss"
                      className="h-8 w-28 tabular-nums"
                    />
                  </TableCell>
                  <TableCell>
                    <AthleteCombobox
                      options={athleteOptions}
                      value={
                        row.athleteNo !== null
                          ? {
                              athleteNo: row.athleteNo,
                              fullName: row.athleteName ?? "",
                            }
                          : null
                      }
                      onSelect={(athlete) =>
                        updateRow(row.localId, {
                          athleteNo: athlete.athleteNo,
                          athleteName: athlete.fullName,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {mismatch ? (
                      <Badge variant="destructive">
                        {MISMATCH_LABEL[mismatch]}
                      </Badge>
                    ) : (
                      <Badge variant="outline">OK</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRowAt(index)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
                <RowInsertDivider onInsert={() => insertGapAt(index + 1)} />
              </Fragment>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No captures for this heat yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => void handleSave()}
          disabled={saving || !dirty}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <HeatContextBar
        leagueId={leagueId}
        leagueName={leagueName}
        mode="reconcile"
        runHeat={runHeat}
        heats={heats}
      />
    </div>
  );
}
