"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { closeHeat, reopenHeat } from "@/lib/reconcile/heat-closure";
import { OPEN_HEAT, type HeatClosed } from "@/lib/capture/heat-closed";
import { useHeatClosed } from "@/components/capture/use-heat-closed";
import {
  buildWorkingRows,
  authorOffTeamChecks,
  capturedAfterCloseChecks,
  computeAutomaticChecks,
  mismatchFor,
  type Mismatch,
  type PositionEntry,
  type RunStatus,
  type TimeEntry,
  type WorkingRow,
} from "@/lib/reconcile/join";
import {
  CAPTURE_SCREEN_LABEL,
  describeAnchor,
  parseCaptureScreen,
} from "@/lib/capture/operator-note";
import {
  callRoomHints,
  type CallRoomHint,
} from "@/lib/reconcile/call-room-hints";
import type { CheckInFacts } from "@/lib/call-room/call-room";
import { placeNotes, type OperatorNote } from "@/lib/reconcile/notes";
import {
  fillToastMessage,
  type PositionCaptureChange,
} from "@/lib/reconcile/fill-toast";
import { FILLED } from "@/lib/scan/position";
import {
  AthleteCombobox,
  type AthleteOption,
} from "@/components/capture/athlete-combobox";
import { RowInsertDivider } from "@/components/capture/row-insert-divider";
import { HeatContextBar } from "@/components/leagues/heat-context-bar";
import type { HeatMode } from "@/lib/access/roles";

export interface RemotePositionCapture {
  id: string;
  position: number;
  athlete_no: number | null;
  voided: boolean;
  void_reason: string | null;
  scanned_at: string;
  device_id: string;
  author_id: string | null;
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
  author_id: string | null;
}

export interface RemoteRunResult {
  athlete_no: number;
  run_time: string | null;
  status: string;
  source: string;
  overridden_by: string | null;
  override_reason: string | null;
}

/** An operator note as the reconcile page reads it out of Supabase. */
export interface RemoteOperatorNote {
  id: string;
  anchor: number;
  screen: string;
  body: string;
  created_at: string;
}

export interface RosterAthlete {
  athleteNo: number;
  fullName: string;
  /** The heat they're rostered in. */
  runHeat?: number;
}

const MISMATCH_LABEL: Record<Mismatch, string> = {
  "skip-at-table": "Skipped at table",
  "placeholder-needs-time": "Placeholder — enter time",
  "position-without-time": "No time captured",
  "time-without-position": "No position captured",
  gap: "Gap — needs athlete and time",
};

const TIME_PATTERN = /^\d{2}:\d{2}\.\d{2}$/;

function NoteList({ notes }: { notes: OperatorNote[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {notes.map((note) => (
        <li key={note.id} className="text-sm">
          <span className="text-muted-foreground">
            {CAPTURE_SCREEN_LABEL[note.screen]} ·{" "}
            {describeAnchor(note.screen, note.anchor)} —{" "}
          </span>
          {note.body}
        </li>
      ))}
    </ul>
  );
}

export function Reconcile({
  leagueId,
  leagueName,
  runHeat,
  modes,
  heats,
  roster,
  leagueRoster,
  checkIns,
  remotePositionCaptures,
  remoteTimeCaptures,
  remoteRunResults,
  remoteNotes,
  remoteHeatClosed,
  duplicateRunResults,
  onTeam,
}: {
  leagueId: number;
  leagueName: string;
  runHeat: number;
  /** The heat screens this Member can switch to. */
  modes: HeatMode[];
  heats: number[];
  roster: RosterAthlete[];
  leagueRoster: RosterAthlete[];
  /** Who is Checked in, and at which heat, across the League. */
  checkIns: CheckInFacts[];
  remotePositionCaptures: RemotePositionCapture[];
  remoteTimeCaptures: RemoteTimeCapture[];
  remoteRunResults: RemoteRunResult[];
  remoteNotes: RemoteOperatorNote[];
  /** Undefined when the page couldn't read it; the phone's copy is used. */
  remoteHeatClosed: HeatClosed | undefined;
  duplicateRunResults: { athlete_no: number; run_heat: number }[];
  /** Members still on the League team, by user id, Admins included. Undefined when
   * the page couldn't read them, and then nothing is flagged. */
  onTeam: string[] | undefined;
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
  // Names across the whole league, so a Fill with an athlete from another
  // heat is still named in its toast.
  const leagueNames = useMemo(
    () => new Map(leagueRoster.map((a) => [a.athleteNo, a.fullName])),
    [leagueRoster],
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
  const { closed, setClosed } = useHeatClosed(
    leagueId,
    runHeat,
    remoteHeatClosed,
  );
  const [reopening, setReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenBusy, setReopenBusy] = useState(false);

  // Notes sit on the row holding the capture they were written after, so
  // they move with it when a gap is inserted or a row removed.
  const notes = useMemo(
    () =>
      placeNotes(
        remoteNotes.map((n): OperatorNote => ({
          id: n.id,
          anchor: n.anchor,
          screen: parseCaptureScreen(n.screen),
          body: n.body,
          createdAt: n.created_at,
        })),
        rows,
      ),
    [remoteNotes, rows],
  );

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
          (payload) => {
            const row = payload.new as PositionCaptureChange;
            // A Fill arrives as the Skip's void and the athlete's capture;
            // the capture carries the toast, so the void stays quiet.
            if (payload.eventType === "UPDATE" && row.void_reason === FILLED) {
              return;
            }
            const fill =
              payload.eventType === "INSERT"
                ? fillToastMessage(row, {
                    runHeat,
                    known: remotePositionCaptures,
                    names: leagueNames,
                  })
                : null;
            toast.info(
              fill ?? "New position captures arrived — refresh to load them.",
            );
          },
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
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "operator_note",
            filter: `league_id=eq.${leagueId}`,
          },
          () =>
            toast.info("New operator notes arrived — refresh to read them."),
        )
        .subscribe();
    }

    void subscribe();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [leagueId, runHeat, remotePositionCaptures, leagueNames]);

  const duplicateAthletes = useMemo(
    () =>
      duplicateRunResults
        .filter((r) => rosterAthleteNos.has(r.athlete_no))
        .map((r) => ({ athleteNo: r.athlete_no, otherHeat: r.run_heat })),
    [duplicateRunResults, rosterAthleteNos],
  );

  const checks = useMemo(
    () => [
      ...computeAutomaticChecks({
        rosterCount: roster.length,
        rows,
        rosterAthleteNos,
        duplicateAthletes,
      }),
      // A capture from a phone that was offline when the heat closed is
      // kept, and flagged here for the official to decide on (ADR 0001).
      ...capturedAfterCloseChecks({
        closedAt: closed.closedAt,
        positions: remotePositionCaptures.map((c) => ({
          position: c.position,
          athleteNo: c.athlete_no,
          capturedAt: c.scanned_at,
          voided: c.voided,
        })),
        times: remoteTimeCaptures.map((c) => ({
          seq: c.seq,
          capturedAt: c.captured_at,
          voided: c.voided,
        })),
      }),
      // A capture its author made before leaving the League team is kept,
      // and flagged here like one made after the heat closed (#36).
      ...(onTeam
        ? authorOffTeamChecks({
            onTeam: new Set(onTeam),
            positions: remotePositionCaptures.map((c) => ({
              position: c.position,
              athleteNo: c.athlete_no,
              authorId: c.author_id,
              voided: c.voided,
            })),
            times: remoteTimeCaptures.map((c) => ({
              seq: c.seq,
              authorId: c.author_id,
              voided: c.voided,
            })),
          })
        : []),
    ],
    [
      roster.length,
      rows,
      rosterAthleteNos,
      duplicateAthletes,
      closed.closedAt,
      remotePositionCaptures,
      remoteTimeCaptures,
      onTeam,
    ],
  );

  // Advice from the Call room; it never sets a status (#44).
  const hints = useMemo(
    () =>
      callRoomHints(
        runHeat,
        leagueRoster.flatMap((a) =>
          a.runHeat === undefined
            ? []
            : [{ athleteNo: a.athleteNo, runHeat: a.runHeat }],
        ),
        checkIns,
        rows,
      ),
    [runHeat, leagueRoster, checkIns, rows],
  );
  const hintsByAthlete = useMemo(() => {
    const map = new Map<number, CallRoomHint[]>();
    for (const h of hints)
      map.set(h.athleteNo, [...(map.get(h.athleteNo) ?? []), h]);
    return map;
  }, [hints]);
  const tabledAthletes = new Set(
    rows.flatMap((r) => (r.athleteNo === null ? [] : [r.athleteNo])),
  );
  const untabledHints = hints.filter((h) => !tabledAthletes.has(h.athleteNo));

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
  }

  function removeRowAt(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRow(localId: string, patch: Partial<WorkingRow>) {
    setRows((prev) =>
      prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)),
    );
  }

  async function currentActor(): Promise<string> {
    const {
      data: { user },
    } = await createClient().auth.getUser();
    return user?.email ?? "unknown";
  }

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = createClient();
      const actor = await currentActor();

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
        leagueId,
        actor,
        entity: "run_result",
        action: "reconcile-save",
        after: payload,
        reason: `Reconciled run heat ${runHeat}`,
      });

      // Saving closes the heat (ADR 0001). Saving an already-closed heat
      // again leaves its original close alone.
      const { closed: newlyClosed, error } = await closeHeat({
        leagueId,
        runHeat,
        actor,
      });
      if (error) {
        toast.error(`Results saved, but the heat didn't close: ${error}`);
        return;
      }
      if (newlyClosed) setClosed(newlyClosed);

      toast.success(
        newlyClosed
          ? "Reconciliation saved. Heat closed."
          : "Reconciliation saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleReopen() {
    const reason = reopenReason.trim();
    if (!reason) return;
    setReopenBusy(true);
    try {
      const { error } = await reopenHeat({
        leagueId,
        runHeat,
        actor: await currentActor(),
        reason,
        before: closed,
      });
      if (error) {
        toast.error(error);
        return;
      }
      setClosed(OPEN_HEAT);
      setReopening(false);
      setReopenReason("");
      toast.success("Heat reopened. Its capture screens take captures again.");
    } finally {
      setReopenBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Run heat {runHeat} ·{" "}
          {closed.closedAt ? (
            <span suppressHydrationWarning>
              Closed{closed.closedBy ? ` by ${closed.closedBy}` : ""} at{" "}
              {new Date(closed.closedAt).toLocaleTimeString()}
            </span>
          ) : (
            "Open — saving closes the heat"
          )}
        </p>
        {closed.closedAt && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReopening(true)}
          >
            Reopen heat
          </Button>
        )}
      </div>

      {checks.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          {checks.map((c, i) => (
            <p key={i}>⚠ {c.message}</p>
          ))}
        </div>
      )}

      {notes.heatLevel.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-input p-3">
          <p className="text-sm font-medium">Notes on this heat</p>
          <NoteList notes={notes.heatLevel} />
        </div>
      )}

      {untabledHints.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-input p-3 text-sm">
          <p className="font-medium">Call room hints</p>
          {untabledHints.map((h, i) => (
            <p key={i}>
              <span className="text-muted-foreground">
                #{h.athleteNo} {leagueNames.get(h.athleteNo)} —{" "}
              </span>
              {h.message}
            </p>
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
            const rowNotes = notes.byRow.get(row.localId);
            const rowHints =
              row.athleteNo === null
                ? undefined
                : hintsByAthlete.get(row.athleteNo);
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
                {rowHints && (
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableCell />
                    <TableCell colSpan={4} className="pt-0 text-sm">
                      {rowHints.map((h, i) => (
                        <p key={i}>Call room: {h.message}</p>
                      ))}
                    </TableCell>
                  </TableRow>
                )}
                {rowNotes && (
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableCell />
                    <TableCell colSpan={4} className="pt-0">
                      <NoteList notes={rowNotes} />
                    </TableCell>
                  </TableRow>
                )}
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
          disabled={saving || rows.every((r) => r.athleteNo === null)}
        >
          {saving
            ? "Saving…"
            : closed.closedAt
              ? "Save"
              : "Save and close heat"}
        </Button>
      </div>

      <Dialog
        open={reopening}
        onOpenChange={(open) => {
          setReopening(open);
          if (!open) setReopenReason("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen heat {runHeat}?</DialogTitle>
            <DialogDescription>
              Its results stop being official and its capture screens take
              captures until it is saved again. The reason is kept in the audit
              log.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="Reason for reopening"
            aria-label="Reason for reopening"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopening(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleReopen()}
              disabled={reopenBusy || reopenReason.trim() === ""}
            >
              {reopenBusy ? "Reopening…" : "Reopen heat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HeatContextBar
        leagueId={leagueId}
        leagueName={leagueName}
        mode="reconcile"
        modes={modes}
        runHeat={runHeat}
        heats={heats}
      />
    </div>
  );
}
