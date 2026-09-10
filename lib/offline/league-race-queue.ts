import Dexie, { type EntityTable } from "dexie";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type LeagueRaceRow = Database["public"]["Tables"]["league_race"]["Row"];

/** One row per heat (league_id, run_heat) — the clock anchor every
 * time_capture.elapsed_time in that heat is measured against. Not a
 * capture: it's upserted, never voided — a second operator (or the same
 * one after a refresh/dropped phone) reads whichever started_at already
 * exists instead of racing to create their own. */
export interface LocalLeagueRace extends LeagueRaceRow {
  synced: boolean;
}

// IndexedDB keys can't be booleans, so the indexed sync flag is stored as
// 0/1 on disk (StoredLeagueRace) and converted to/from boolean at the
// edges — same convention as the capture queues.
interface StoredLeagueRace extends Omit<LeagueRaceRow, never> {
  id: string;
  synced: 0 | 1;
}

function toId(leagueId: number, runHeat: number): string {
  return `${leagueId}:${runHeat}`;
}

function toStored(row: LocalLeagueRace): StoredLeagueRace {
  return {
    ...row,
    id: toId(row.league_id, row.run_heat),
    synced: row.synced ? 1 : 0,
  };
}

function fromStored(row: StoredLeagueRace): LocalLeagueRace {
  return {
    league_id: row.league_id,
    run_heat: row.run_heat,
    started_at: row.started_at,
    device_id: row.device_id,
    synced: row.synced === 1,
  };
}

class LeagueRaceDB extends Dexie {
  league_races!: EntityTable<StoredLeagueRace, "id">;

  constructor() {
    super("biathlon-league-race");
    this.version(1).stores({
      league_races: "id, synced",
    });
  }
}

const db = new LeagueRaceDB();

export async function putLeagueRace(row: LocalLeagueRace): Promise<void> {
  await db.league_races.put(toStored(row));
}

export async function getLeagueRace(
  leagueId: number,
  runHeat: number,
): Promise<LocalLeagueRace | undefined> {
  const row = await db.league_races.get(toId(leagueId, runHeat));
  return row ? fromStored(row) : undefined;
}

/**
 * Resets a heat's start (operator pressed Start by accident) — this row has
 * no voided concept like the capture tables, so "clear" is a real delete,
 * both locally and on the server. Recorded time_capture rows for the heat
 * are untouched; the confirmation dialog is responsible for warning the
 * operator about those before calling this.
 */
export async function clearLeagueRaceStart(
  leagueId: number,
  runHeat: number,
): Promise<void> {
  await db.league_races.delete(toId(leagueId, runHeat));
  const supabase = createClient();
  await supabase
    .from("league_race")
    .delete()
    .eq("league_id", leagueId)
    .eq("run_heat", runHeat);
}

async function getUnsyncedLeagueRaces(): Promise<LocalLeagueRace[]> {
  const rows = await db.league_races.where("synced").equals(0).toArray();
  return rows.map(fromStored);
}

let syncing = false;

/**
 * Pushes unsynced league_race rows to Supabase, upserting on
 * (league_id, run_heat) so a retry after a dropped connection can't create
 * a duplicate. Safe to call repeatedly/concurrently — re-entrant calls are
 * no-ops while a sync is already in flight (§6.6).
 */
export async function syncPendingLeagueRaces(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const pending = await getUnsyncedLeagueRaces();
    if (pending.length === 0) return;

    const supabase = createClient();
    const rows: LeagueRaceRow[] = pending.map((row) => ({
      league_id: row.league_id,
      run_heat: row.run_heat,
      started_at: row.started_at,
      device_id: row.device_id,
    }));
    const { error } = await supabase.from("league_race").upsert(rows, {
      onConflict: "league_id,run_heat",
      ignoreDuplicates: true,
    });
    if (error) return;

    await db.league_races.bulkUpdate(
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
export function startLeagueRaceSyncSweep(): () => void {
  void syncPendingLeagueRaces();
  if (sweepStarted) return () => {};
  sweepStarted = true;

  const interval = setInterval(() => void syncPendingLeagueRaces(), 5000);
  const onOnline = () => void syncPendingLeagueRaces();
  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      void syncPendingLeagueRaces();
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
