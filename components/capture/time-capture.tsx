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

export function TimeCapture({
  leagueId,
  runHeat,
  nextHeat,
  remoteCaptures,
}: {
  leagueId: number;
  runHeat: number;
  nextHeat: number | null;
  remoteCaptures: RemoteTimeCapture[];
}) {
  const [captures, setCaptures] = useState<LocalTimeCapture[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  // Load Dexie rows first (unsynced local state wins on conflict with the
  // server snapshot passed down from the page — same id, local is either
  // identical or a not-yet-synced edit), merging in any remote-only rows.
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

  // Clock tick, only while a heat is running — drives the live elapsed
  // display. Not used for the captured time itself (that's computed fresh
  // from performance.now() at press time, see recordCapture).
  useEffect(() => {
    if (startedAt === null) {
      setNow(null);
      return;
    }
    setNow(performance.now());
    const interval = setInterval(() => setNow(performance.now()), 47);
    return () => clearInterval(interval);
  }, [startedAt]);

  const activeSeqs = captures.filter((c) => !c.voided).map((c) => c.seq);
  const seq = nextSeq(activeSeqs);
  const allCaptures = [...captures]
    .filter((c) => !c.voided)
    .sort((a, b) => b.seq - a.seq);
  const lastThree = allCaptures.slice(0, 3);
  const mostRecent = allCaptures[0];

  const liveElapsed = useMemo(() => {
    if (startedAt === null || now === null) return null;
    return formatElapsed(now - startedAt);
  }, [startedAt, now]);

  function handleStart() {
    const start = performance.now();
    startedAtRef.current = start;
    setStartedAt(start);
  }

  async function recordCapture(isPlaceholder: boolean) {
    if (startedAtRef.current === null) return;
    const elapsedMs = performance.now() - startedAtRef.current;
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
          {startedAt === null ? "Not started" : "Elapsed"}
        </p>
        <p className="text-6xl font-bold tabular-nums">
          {liveElapsed ?? "00:00.00"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {allCaptures.length} recorded
        </p>
      </div>

      {startedAt === null ? (
        <Button
          size="lg"
          className="h-24 w-full max-w-sm text-2xl"
          onClick={handleStart}
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
