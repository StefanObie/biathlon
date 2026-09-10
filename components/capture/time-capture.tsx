"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ulid } from "ulid";

import { Button } from "@/components/ui/button";
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
  getHeatTimerStart,
  putHeatTimerStart,
  startHeatTimerStartSyncSweep,
  syncPendingHeatTimerStarts,
} from "@/lib/offline/heat-timer-start-queue";

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

export interface RemoteHeatTimerStart {
  started_at: string;
  device_id: string;
}

export function TimeCapture({
  leagueId,
  runHeat,
  nextHeat,
  remoteCaptures,
  remoteHeatTimerStart,
}: {
  leagueId: number;
  runHeat: number;
  nextHeat: number | null;
  remoteCaptures: RemoteTimeCapture[];
  remoteHeatTimerStart: RemoteHeatTimerStart | null;
}) {
  const [captures, setCaptures] = useState<LocalTimeCapture[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Wall-clock ms (Date.now() epoch), not performance.now() — this value
  // has to outlive the tab (refresh, dropped phone handed to someone else),
  // so it's read from the synced heat_timer_start row rather than kept only
  // in memory.
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
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

      let start = await getHeatTimerStart(leagueId, runHeat);
      if (!start && remoteHeatTimerStart) {
        start = {
          league_id: leagueId,
          run_heat: runHeat,
          started_at: remoteHeatTimerStart.started_at,
          device_id: remoteHeatTimerStart.device_id,
          synced: true,
        };
        await putHeatTimerStart(start);
      }

      if (cancelled) return;
      setCaptures([...local, ...remoteOnly]);
      if (start) {
        const startMs = new Date(start.started_at).getTime();
        startedAtMsRef.current = startMs;
        setStartedAtMs(startMs);
      }
      setLoaded(true);
    }

    void load();
    const stopCaptureSweep = startSyncSweep();
    const stopStartSweep = startHeatTimerStartSyncSweep();
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
    await putHeatTimerStart({
      league_id: leagueId,
      run_heat: runHeat,
      started_at: new Date(startMs).toISOString(),
      device_id: getDeviceId(),
      synced: false,
    });
    void syncPendingHeatTimerStarts();
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
            Finish
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-14 text-lg"
            onClick={() => void handleMissedOne()}
            suppressHydrationWarning
          >
            Missed one
          </Button>
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
                {c.is_placeholder && " (missed one)"}
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
    </div>
  );
}
