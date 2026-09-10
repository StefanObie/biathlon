import Dexie, { type EntityTable } from "dexie";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type HeatTimerStartRow =
  Database["public"]["Tables"]["heat_timer_start"]["Row"];

/** One row per heat (league_id, run_heat) — the clock anchor every
 * time_capture.elapsed_time in that heat is measured against. Not a
 * capture: it's upserted, never voided — a second operator (or the same
 * one after a refresh/dropped phone) reads whichever started_at already
 * exists instead of racing to create their own. */
export interface LocalHeatTimerStart extends HeatTimerStartRow {
  synced: boolean;
}

// IndexedDB keys can't be booleans, so the indexed sync flag is stored as
// 0/1 on disk (StoredHeatTimerStart) and converted to/from boolean at the
// edges — same convention as the capture queues.
interface StoredHeatTimerStart extends Omit<HeatTimerStartRow, never> {
  id: string;
  synced: 0 | 1;
}

function toId(leagueId: number, runHeat: number): string {
  return `${leagueId}:${runHeat}`;
}

function toStored(row: LocalHeatTimerStart): StoredHeatTimerStart {
  return {
    ...row,
    id: toId(row.league_id, row.run_heat),
    synced: row.synced ? 1 : 0,
  };
}

function fromStored(row: StoredHeatTimerStart): LocalHeatTimerStart {
  return {
    league_id: row.league_id,
    run_heat: row.run_heat,
    started_at: row.started_at,
    device_id: row.device_id,
    synced: row.synced === 1,
  };
}

class HeatTimerStartDB extends Dexie {
  heat_timer_starts!: EntityTable<StoredHeatTimerStart, "id">;

  constructor() {
    super("biathlon-heat-timer-start");
    this.version(1).stores({
      heat_timer_starts: "id, synced",
    });
  }
}

const db = new HeatTimerStartDB();

export async function putHeatTimerStart(
  row: LocalHeatTimerStart,
): Promise<void> {
  await db.heat_timer_starts.put(toStored(row));
}

export async function getHeatTimerStart(
  leagueId: number,
  runHeat: number,
): Promise<LocalHeatTimerStart | undefined> {
  const row = await db.heat_timer_starts.get(toId(leagueId, runHeat));
  return row ? fromStored(row) : undefined;
}

/**
 * Resets a heat's start (operator pressed Start by accident) — this row has
 * no voided concept like the capture tables, so "clear" is a real delete,
 * both locally and on the server. Recorded time_capture rows for the heat
 * are untouched; the confirmation dialog is responsible for warning the
 * operator about those before calling this.
 */
export async function clearHeatTimerStart(
  leagueId: number,
  runHeat: number,
): Promise<void> {
  await db.heat_timer_starts.delete(toId(leagueId, runHeat));
  const supabase = createClient();
  await supabase
    .from("heat_timer_start")
    .delete()
    .eq("league_id", leagueId)
    .eq("run_heat", runHeat);
}

async function getUnsyncedHeatTimerStarts(): Promise<LocalHeatTimerStart[]> {
  const rows = await db.heat_timer_starts.where("synced").equals(0).toArray();
  return rows.map(fromStored);
}

let syncing = false;

/**
 * Pushes unsynced heat-start rows to Supabase, upserting on
 * (league_id, run_heat) so a retry after a dropped connection can't create
 * a duplicate. Safe to call repeatedly/concurrently — re-entrant calls are
 * no-ops while a sync is already in flight (§6.6).
 */
export async function syncPendingHeatTimerStarts(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const pending = await getUnsyncedHeatTimerStarts();
    if (pending.length === 0) return;

    const supabase = createClient();
    const rows: HeatTimerStartRow[] = pending.map((row) => ({
      league_id: row.league_id,
      run_heat: row.run_heat,
      started_at: row.started_at,
      device_id: row.device_id,
    }));
    const { error } = await supabase.from("heat_timer_start").upsert(rows, {
      onConflict: "league_id,run_heat",
      ignoreDuplicates: true,
    });
    if (error) return;

    await db.heat_timer_starts.bulkUpdate(
      pending.map((row) => ({
        key: toId(row.league_id, row.run_heat),
        changes: { synced: 1 },
      })),
    );
  } finally {
    syncing = false;
  }
}

let sweepStarted = false;

/**
 * Starts the background sync sweep: on an interval, and on reconnect/tab
 * foreground, so a heat start made offline reaches other phones as soon as
 * connectivity returns. Idempotent — safe to call on every mount.
 */
export function startHeatTimerStartSyncSweep(): () => void {
  void syncPendingHeatTimerStarts();
  if (sweepStarted) return () => {};
  sweepStarted = true;

  const interval = setInterval(() => void syncPendingHeatTimerStarts(), 5000);
  const onOnline = () => void syncPendingHeatTimerStarts();
  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      void syncPendingHeatTimerStarts();
    }
  };

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    clearInterval(interval);
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibility);
    sweepStarted = false;
  };
}
