"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ulid } from "ulid";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getDeviceId } from "@/lib/offline/device-id";
import { nextPosition } from "@/lib/scan/position";
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
  runHeat,
  nextHeat,
  leagueRoster,
  remoteCaptures,
}: {
  leagueId: number;
  runHeat: number;
  nextHeat: number | null;
  leagueRoster: LeagueRosterAthlete[];
  remoteCaptures: RemoteCapture[];
}) {
  const [captures, setCaptures] = useState<LocalPositionCapture[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [athleteNoInput, setAthleteNoInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [pendingOutOfHeat, setPendingOutOfHeat] =
    useState<LeagueRosterAthlete | null>(null);

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
  const allCaptures = [...captures].sort((a, b) =>
    b.scanned_at.localeCompare(a.scanned_at),
  );

  async function recordCapture(athleteNo: number | null) {
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

  async function handleManualSubmit() {
    setInputError(null);
    const athleteNo = Number(athleteNoInput.trim());
    if (!Number.isInteger(athleteNo)) {
      setInputError("Enter a valid athlete number.");
      return;
    }
    const athlete = rosterByNo.get(athleteNo);
    if (!athlete) {
      setInputError(`Athlete ${athleteNo} is not entered in this league.`);
      return;
    }
    if (athlete.runHeat !== runHeat) {
      // Confirm before logging — the mismatch itself is resolved later in
      // reconciliation, this screen just shouldn't lose the capture.
      setPendingOutOfHeat(athlete);
      return;
    }
    await recordCapture(athleteNo);
    setAthleteNoInput("");
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
    await voidCapture(capture.id, "operator undo");
    setCaptures((prev) =>
      prev.map((c) =>
        c.id === capture.id
          ? { ...c, voided: true, void_reason: "operator undo", synced: false }
          : c,
      ),
    );
    void syncPendingCaptures();
    toast("Capture undone");
  }

  const activeCapturesDesc = allCaptures.filter((c) => !c.voided);
  const mostRecentActive = activeCapturesDesc[0];

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex w-full max-w-sm items-center justify-between">
        <p className="text-sm text-muted-foreground">Run heat {runHeat}</p>
        {nextHeat !== null && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/leagues/${leagueId}/position/${nextHeat}`}>
              Next heat ({nextHeat}) →
            </Link>
          </Button>
        )}
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">Position</p>
        <p className="text-8xl font-bold tabular-nums">
          {loaded ? position : "—"}
        </p>
      </div>

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
          className="h-16 rounded-md border border-input px-4 text-center text-2xl tabular-nums"
        />
        {inputError && <p className="text-sm text-destructive">{inputError}</p>}
        <Button
          size="lg"
          className="h-16 text-xl"
          onClick={() => void handleManualSubmit()}
          disabled={!loaded}
          suppressHydrationWarning
        >
          Record
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14 text-lg"
          onClick={() => void handleSkip()}
          disabled={!loaded}
          suppressHydrationWarning
        >
          Skip
        </Button>
      </div>

      <div className="w-full max-w-sm">
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          Captures ({activeCapturesDesc.length})
        </p>
        <ul className="flex flex-col gap-1">
          {allCaptures.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm"
            >
              <span className="tabular-nums">
                #{c.position}{" "}
                {c.voided
                  ? "voided"
                  : c.athlete_no
                    ? `${c.athlete_no} ${rosterByNo.get(c.athlete_no)?.fullName ?? ""}`
                    : "skip"}
              </span>
              {!c.voided && c.id === mostRecentActive?.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleUndoTop(c)}
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
            <Button onClick={() => void confirmOutOfHeatCapture()}>
              Log capture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
