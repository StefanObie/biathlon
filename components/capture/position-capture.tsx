"use client";

import { useEffect, useMemo, useState } from "react";
import { ulid } from "ulid";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HeatContextBar } from "@/components/leagues/heat-context-bar";
import { captureScreenState, heatRosterSize } from "@/lib/capture/screen-state";
import { getDeviceId } from "@/lib/offline/device-id";
import { parseBibPayload } from "@/lib/scan/payload";
import { nextPosition } from "@/lib/scan/position";
import { QrScanner } from "@/components/capture/qr-scanner";
import { FinishedCount } from "@/components/capture/finished-count";
import { OperatorNotes } from "@/components/capture/operator-notes";
import { HeatClosedNotice } from "@/components/capture/heat-closed-notice";
import { useHeatClosed } from "@/components/capture/use-heat-closed";
import type { HeatClosed } from "@/lib/capture/heat-closed";
import { noteAnchor } from "@/lib/capture/operator-note";
import {
  getCapturesForHeat,
  putCapture,
  startSyncSweep,
  syncPendingCaptures,
  voidCapture,
  type LocalPositionCapture,
} from "@/lib/offline/position-capture-queue";

export interface LeagueRosterAthlete {
  athleteNo: number;
  fullName: string;
  runHeat: number;
}

export interface RemoteCapture {
  id: string;
  position: number;
  athlete_no: number | null;
  voided: boolean;
  void_reason: string | null;
  scanned_at: string;
  device_id: string;
}

export function PositionCapture({
  leagueId,
  leagueName,
  runHeat,
  heats,
  leagueRoster,
  remoteCaptures,
  remoteHeatClosed,
}: {
  leagueId: number;
  leagueName: string;
  runHeat: number;
  heats: number[];
  leagueRoster: LeagueRosterAthlete[];
  remoteCaptures: RemoteCapture[];
  /** Undefined when the page couldn't read it; the phone's copy is used. */
  remoteHeatClosed: HeatClosed | undefined;
}) {
  const [captures, setCaptures] = useState<LocalPositionCapture[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [athleteNoInput, setAthleteNoInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [pendingOutOfHeat, setPendingOutOfHeat] =
    useState<LeagueRosterAthlete | null>(null);
  const [pendingUndo, setPendingUndo] = useState<LocalPositionCapture | null>(
    null,
  );
  const { closed } = useHeatClosed(leagueId, runHeat, remoteHeatClosed);

  const rosterByNo = useMemo(() => {
    const map = new Map<number, LeagueRosterAthlete>();
    for (const a of leagueRoster) map.set(a.athleteNo, a);
    return map;
  }, [leagueRoster]);

  // Load Dexie rows first (unsynced local state wins on conflict with the
  // server snapshot passed down from the page — same id, local is either
  // identical or a not-yet-synced edit), merging in any remote-only rows.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const local = await getCapturesForHeat(leagueId, runHeat);
      const localIds = new Set(local.map((c) => c.id));
      const remoteOnly: LocalPositionCapture[] = remoteCaptures
        .filter((c) => !localIds.has(c.id))
        .map((c) => ({
          ...c,
          league_id: leagueId,
          run_heat: runHeat,
          synced: true,
        }));

      for (const row of remoteOnly) {
        await putCapture(row);
      }

      if (cancelled) return;
      setCaptures([...local, ...remoteOnly]);
      setLoaded(true);
    }

    void load();
    const stopSweep = startSyncSweep();
    return () => {
      cancelled = true;
      stopSweep();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, runHeat]);

  const activePositions = captures
    .filter((c) => !c.voided)
    .map((c) => c.position);
  const position = nextPosition(activePositions);
  const allCaptures = [...captures]
    .filter((c) => !c.voided)
    .sort((a, b) => b.scanned_at.localeCompare(a.scanned_at));
  // The roster is this heat's slice of the league roster; athletes scanned
  // from another heat count as finishers but not towards the total.
  const rosterSize = heatRosterSize(
    leagueRoster.map((a) => a.runHeat),
    runHeat,
  );
  const { finished, overRoster, locked } = captureScreenState({
    captures,
    rosterSize,
    closedAt: closed.closedAt,
  });

  async function recordCapture(athleteNo: number | null) {
    if (locked) return;
    const row: LocalPositionCapture = {
      id: ulid(),
      league_id: leagueId,
      run_heat: runHeat,
      position,
      athlete_no: athleteNo,
      device_id: getDeviceId(),
      scanned_at: new Date().toISOString(),
      voided: false,
      void_reason: null,
      synced: false,
    };
    await putCapture(row);
    setCaptures((prev) => [...prev, row]);
    void syncPendingCaptures();
  }

  // Shared by manual entry and QR scan: resolves an athlete number against
  // the roster and either records the capture directly or, for an
  // out-of-heat athlete, routes through the confirmation dialog. Returns an
  // error message on failure so each caller can surface it its own way
  // (inline field error vs. toast).
  async function resolveAndRecord(athleteNo: number): Promise<string | null> {
    const athlete = rosterByNo.get(athleteNo);
    if (!athlete) {
      return `Athlete ${athleteNo} is not entered in this league.`;
    }
    if (captures.some((c) => !c.voided && c.athlete_no === athleteNo)) {
      return `Athlete ${athleteNo} ${athlete.fullName} is already captured in this heat.`;
    }
    if (athlete.runHeat !== runHeat) {
      // Confirm before logging — the mismatch itself is resolved later in
      // reconciliation, this screen just shouldn't lose the capture.
      setPendingOutOfHeat(athlete);
      return null;
    }
    await recordCapture(athleteNo);
    return null;
  }

  async function handleManualSubmit() {
    setInputError(null);
    const athleteNo = Number(athleteNoInput.trim());
    if (!Number.isInteger(athleteNo)) {
      setInputError("Enter a valid athlete number.");
      return;
    }
    const error = await resolveAndRecord(athleteNo);
    if (error) {
      setInputError(error);
      return;
    }
    setAthleteNoInput("");
  }

  async function handleScanDetect(text: string) {
    const athleteNo = parseBibPayload(text);
    if (athleteNo === null) {
      toast.error("Not a bib QR code");
      return;
    }
    const error = await resolveAndRecord(athleteNo);
    if (error) toast.error(error);
  }

  async function confirmOutOfHeatCapture() {
    if (!pendingOutOfHeat) return;
    await recordCapture(pendingOutOfHeat.athleteNo);
    setPendingOutOfHeat(null);
    setAthleteNoInput("");
  }

  async function handleSkip() {
    await recordCapture(null);
  }

  // Only the highest active position can be undone at a time — voiding a
  // middle position while later ones stay active would break the
  // contiguous counter. Undoing the top one makes the next-highest
  // available, one at a time (deliberate friction against careless undo).
  async function handleUndoTop(capture: LocalPositionCapture) {
    if (locked) return;
    await voidCapture(capture.id, "operator undo");
    setCaptures((prev) =>
      prev.map((c) =>
        c.id === capture.id
          ? { ...c, voided: true, void_reason: "operator undo", synced: false }
          : c,
      ),
    );
    void syncPendingCaptures();
    setPendingUndo(null);
    toast.success("Capture undone");
  }

  const mostRecentActive = allCaptures[0];

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Position</p>
        <p className="text-8xl font-bold tabular-nums">
          {loaded ? position : "—"}
        </p>
      </div>

      {/* Unmounted, not paused, so the camera turns off on a closed heat. */}
      {locked ? (
        <HeatClosedNotice />
      ) : (
        <QrScanner
          onDetect={(text) => void handleScanDetect(text)}
          paused={pendingOutOfHeat !== null}
        />
      )}

      <div className="flex w-full max-w-sm flex-col gap-2">
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={athleteNoInput}
          onChange={(e) => setAthleteNoInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleManualSubmit();
          }}
          placeholder="Athlete number"
          disabled={locked}
          className="h-16 rounded-md border border-input px-4 text-center text-2xl tabular-nums"
        />
        {inputError && <p className="text-sm text-destructive">{inputError}</p>}
        <Button
          size="lg"
          className="h-16 text-xl"
          onClick={() => void handleManualSubmit()}
          disabled={!loaded || locked}
          suppressHydrationWarning
        >
          Record
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14 text-lg"
          onClick={() => void handleSkip()}
          disabled={!loaded || locked}
          suppressHydrationWarning
        >
          Skip
        </Button>
      </div>

      <div className="w-full max-w-sm">
        <FinishedCount
          finished={finished}
          rosterSize={rosterSize}
          overRoster={overRoster}
          className="mb-2"
        />
        <ul className="flex flex-col gap-1">
          {allCaptures.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm"
            >
              <span className="tabular-nums">
                #{c.position}{" "}
                {c.athlete_no
                  ? `${c.athlete_no} ${rosterByNo.get(c.athlete_no)?.fullName ?? ""}`
                  : "skip"}
              </span>
              {c.id === mostRecentActive?.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingUndo(c)}
                  disabled={locked}
                >
                  Undo
                </Button>
              )}
            </li>
          ))}
          {allCaptures.length === 0 && (
            <li className="text-sm text-muted-foreground">No captures yet.</li>
          )}
        </ul>
      </div>

      <OperatorNotes
        leagueId={leagueId}
        runHeat={runHeat}
        screen="position"
        anchor={noteAnchor(activePositions)}
      />

      <Dialog
        open={pendingOutOfHeat !== null}
        onOpenChange={(open) => {
          if (!open) setPendingOutOfHeat(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Athlete not in this heat</DialogTitle>
            <DialogDescription>
              {pendingOutOfHeat && (
                <>
                  {pendingOutOfHeat.athleteNo} {pendingOutOfHeat.fullName} is
                  assigned to run heat {pendingOutOfHeat.runHeat}, not heat{" "}
                  {runHeat}. Log the capture anyway? The mismatch will need to
                  be resolved during reconciliation.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingOutOfHeat(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void confirmOutOfHeatCapture()}
              disabled={locked}
            >
              Log capture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingUndo !== null}
        onOpenChange={(open) => {
          if (!open) setPendingUndo(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this capture?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingUndo && (
                <>
                  Position #{pendingUndo.position}
                  {pendingUndo.athlete_no
                    ? ` — ${pendingUndo.athlete_no} ${rosterByNo.get(pendingUndo.athlete_no)?.fullName ?? ""}`
                    : " — skip"}{" "}
                  will be voided.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingUndo && void handleUndoTop(pendingUndo)}
              disabled={locked}
            >
              Undo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <HeatContextBar
        leagueId={leagueId}
        leagueName={leagueName}
        mode="position"
        runHeat={runHeat}
        heats={heats}
      />
    </div>
  );
}
