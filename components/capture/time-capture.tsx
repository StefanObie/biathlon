"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ulid } from "ulid";

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
import { formatElapsed, nextSeq } from "@/lib/scan/time";
import {
  getCapturesForHeat,
  putCapture,
  startSyncSweep,
  syncPendingCaptures,
  voidCapture,
  type LocalTimeCapture,
} from "@/lib/offline/time-capture-queue";
import {
  clearLeagueRaceStart,
  getLeagueRace,
  putLeagueRace,
  startLeagueRaceSyncSweep,
  syncPendingLeagueRaces,
} from "@/lib/offline/league-race-queue";

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

export interface RemoteLeagueRace {
  started_at: string | null;
  device_id: string | null;
}

export function TimeCapture({
  leagueId,
  runHeat,
  nextHeat,
  remoteCaptures,
  remoteLeagueRace,
}: {
  leagueId: number;
  runHeat: number;
  nextHeat: number | null;
  remoteCaptures: RemoteTimeCapture[];
  remoteLeagueRace: RemoteLeagueRace | null;
}) {
  const [captures, setCaptures] = useState<LocalTimeCapture[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Wall-clock ms (Date.now() epoch), not performance.now() — this value
  // has to outlive the tab (refresh, dropped phone handed to someone else),
  // so it's read from the synced league_race row rather than kept only
  // in memory.
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const startedAtMsRef = useRef<number | null>(null);

  // Load Dexie rows first (unsynced local state wins on conflict with the
  // server snapshot passed down from the page — same id, local is either
  // identical or a not-yet-synced edit), merging in any remote-only rows.
  // Same pattern for the heat's start time: Dexie first, then the server
  // snapshot if Dexie has nothing yet — whichever phone started the clock
  // first, every phone converges on that same value.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const local = await getCapturesForHeat(leagueId, runHeat);
      const localIds = new Set(local.map((c) => c.id));
      const remoteOnly: LocalTimeCapture[] = remoteCaptures
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

      let race = await getLeagueRace(leagueId, runHeat);
      if (!race && remoteLeagueRace) {
        race = {
          league_id: leagueId,
          run_heat: runHeat,
          started_at: remoteLeagueRace.started_at,
          device_id: remoteLeagueRace.device_id,
          synced: true,
          pendingDelete: false,
        };
        await putLeagueRace(race);
      }

      if (cancelled) return;
      setCaptures([...local, ...remoteOnly]);
      if (race?.started_at) {
        const startMs = new Date(race.started_at).getTime();
        startedAtMsRef.current = startMs;
        setStartedAtMs(startMs);
      }
      setLoaded(true);
    }

    void load();
    const stopCaptureSweep = startSyncSweep();
    const stopStartSweep = startLeagueRaceSyncSweep();
    return () => {
      cancelled = true;
      stopCaptureSweep();
      stopStartSweep();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, runHeat]);

  // Clock tick, only while a heat is running — drives the live elapsed
  // display via Date.now(), the same wall clock the anchor is stored in.
  // Not used for the captured time itself (that's computed fresh at press
  // time, see recordCapture), just the on-screen ticker.
  useEffect(() => {
    if (startedAtMs === null) {
      setNow(null);
      return;
    }
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 47);
    return () => clearInterval(interval);
  }, [startedAtMs]);

  const activeSeqs = captures.filter((c) => !c.voided).map((c) => c.seq);
  const seq = nextSeq(activeSeqs);
  const allCaptures = [...captures]
    .filter((c) => !c.voided)
    .sort((a, b) => b.seq - a.seq);
  const lastThree = allCaptures.slice(0, 3);
  const mostRecent = allCaptures[0];

  const liveElapsed = useMemo(() => {
    if (startedAtMs === null || now === null) return null;
    return formatElapsed(now - startedAtMs);
  }, [startedAtMs, now]);

  async function handleStart() {
    const startMs = Date.now();
    startedAtMsRef.current = startMs;
    setStartedAtMs(startMs);
    await putLeagueRace({
      league_id: leagueId,
      run_heat: runHeat,
      started_at: new Date(startMs).toISOString(),
      device_id: getDeviceId(),
      synced: false,
      pendingDelete: false,
    });
    void syncPendingLeagueRaces();
  }

  async function handleResetStart() {
    // Belt-and-braces alongside the disabled Reset button: never clear a
    // clock that recorded finishes are still measured against — bad data
    // otherwise (§ operator must undo captures first, this isn't a
    // reachable UI path but the invariant should hold regardless).
    if (allCaptures.length > 0) return;
    startedAtMsRef.current = null;
    setStartedAtMs(null);
    setConfirmingReset(false);
    await clearLeagueRaceStart(leagueId, runHeat);
  }

  async function recordCapture(isPlaceholder: boolean) {
    if (startedAtMsRef.current === null) return;
    const elapsedMs = Date.now() - startedAtMsRef.current;
    const row: LocalTimeCapture = {
      id: ulid(),
      league_id: leagueId,
      run_heat: runHeat,
      seq,
      elapsed_time: formatElapsed(elapsedMs),
      is_placeholder: isPlaceholder,
      device_id: getDeviceId(),
      captured_at: new Date().toISOString(),
      voided: false,
      void_reason: null,
      synced: false,
    };
    navigator.vibrate?.(30);
    await putCapture(row);
    setCaptures((prev) => [...prev, row]);
    void syncPendingCaptures();
  }

  async function handleFinish() {
    await recordCapture(false);
  }

  async function handleMissedOne() {
    await recordCapture(true);
  }

  // Only the highest active seq can be undone at a time — voiding a middle
  // press while later ones stay active would break the contiguous counter.
  // Mirrors position-capture's single-step undo.
  async function handleUndoTop(capture: LocalTimeCapture) {
    await voidCapture(capture.id, "operator undo");
    setCaptures((prev) =>
      prev.map((c) =>
        c.id === capture.id
          ? { ...c, voided: true, void_reason: "operator undo", synced: false }
          : c,
      ),
    );
    void syncPendingCaptures();
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex w-full max-w-sm items-center justify-between">
        <p className="text-sm text-muted-foreground">Run heat {runHeat}</p>
        {nextHeat !== null && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/leagues/${leagueId}/timer/${nextHeat}`}>
              Next heat ({nextHeat}) →
            </Link>
          </Button>
        )}
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {startedAtMs === null ? "Not started" : "Elapsed"}
        </p>
        <p className="text-6xl font-bold tabular-nums">
          {liveElapsed ?? "00:00.00"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {allCaptures.length} recorded
        </p>
      </div>

      {startedAtMs === null ? (
        <Button
          size="lg"
          className="h-24 w-full max-w-sm text-2xl"
          onClick={() => void handleStart()}
          disabled={!loaded}
          suppressHydrationWarning
        >
          Start heat
        </Button>
      ) : (
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Button
            size="lg"
            className="h-32 text-3xl"
            onClick={() => void handleFinish()}
            suppressHydrationWarning
          >
            Record finish
          </Button>
          <div className="flex gap-2">
            <Button
              size="lg"
              variant="outline"
              className="h-12 flex-1 text-base"
              onClick={() => void handleMissedOne()}
              suppressHydrationWarning
            >
              Missed finish
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="h-12 w-12 shrink-0 p-0 text-sm"
              onClick={() => setConfirmingReset(true)}
              disabled={allCaptures.length > 0}
              title={
                allCaptures.length > 0
                  ? "Undo all recorded finishes before resetting the clock"
                  : undefined
              }
              suppressHydrationWarning
            >
              Reset
            </Button>
          </div>
          {allCaptures.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Undo all recorded finishes before resetting the clock.
            </p>
          )}
        </div>
      )}

      <div className="w-full max-w-sm">
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          Last three
        </p>
        <ul className="flex flex-col gap-1">
          {lastThree.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm"
            >
              <span className="tabular-nums">
                #{c.seq} {c.elapsed_time}
                {c.is_placeholder && " (missed finish)"}
              </span>
              {c.id === mostRecent?.id && (
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
          {lastThree.length === 0 && (
            <li className="text-sm text-muted-foreground">
              No times recorded yet.
            </li>
          )}
        </ul>
      </div>

      <Dialog open={confirmingReset} onOpenChange={setConfirmingReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset heat start?</DialogTitle>
            <DialogDescription>
              This clears the heat&rsquo;s start time. Use this if Start heat
              was pressed by accident.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingReset(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleResetStart()}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
