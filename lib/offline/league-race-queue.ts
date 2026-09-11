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
  pendingDelete: boolean;
}

// IndexedDB keys can't be booleans, so the indexed sync flag is stored as
// 0/1 on disk (StoredLeagueRace) and converted to/from boolean at the
// edges — same convention as the capture queues.
interface StoredLeagueRace extends Omit<LeagueRaceRow, never> {
  id: string;
  synced: 0 | 1;
  pendingDelete: 0 | 1;
}

function toId(leagueId: number, runHeat: number): string {
  return `${leagueId}:${runHeat}`;
}

function toStored(row: LocalLeagueRace): StoredLeagueRace {
  return {
    ...row,
    id: toId(row.league_id, row.run_heat),
    synced: row.synced ? 1 : 0,
    pendingDelete: row.pendingDelete ? 1 : 0,
  };
}

function fromStored(row: StoredLeagueRace): LocalLeagueRace {
  return {
    league_id: row.league_id,
    run_heat: row.run_heat,
    started_at: row.started_at,
    device_id: row.device_id,
    synced: row.synced === 1,
    pendingDelete: row.pendingDelete === 1,
  };
}

class LeagueRaceDB extends Dexie {
  league_races!: EntityTable<StoredLeagueRace, "id">;

  constructor() {
    super("biathlon-league-race");
    this.version(1).stores({
      league_races: "id, synced",
    });
    this.version(2).stores({
      league_races: "id, synced, pendingDelete",
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
  if (!row || row.pendingDelete === 1) return undefined;
  return fromStored(row);
}

/**
 * Resets a heat's start (operator pressed Start by accident) — this row has
 * no voided concept like the capture tables. The local row is marked
 * pendingDelete (so getLeagueRace treats it as absent immediately) rather
 * than removed outright, and the sync sweep retries the Supabase delete
 * until it's confirmed — mirroring how every other write in this app
 * survives a dropped connection instead of being lost. Recorded
 * time_capture rows for the heat are untouched; the confirmation dialog is
 * responsible for warning the operator about those before calling this.
 */
export async function clearLeagueRaceStart(
  leagueId: number,
  runHeat: number,
): Promise<void> {
  const id = toId(leagueId, runHeat);
  const existing = await db.league_races.get(id);
  await db.league_races.put({
    ...(existing ?? {
      id,
      league_id: leagueId,
      run_heat: runHeat,
      started_at: new Date().toISOString(),
      device_id: null,
    }),
    id,
    synced: 0,
    pendingDelete: 1,
  });
  void syncPendingLeagueRaces();
}

async function getUnsyncedLeagueRaces(): Promise<StoredLeagueRace[]> {
  return db.league_races.where("synced").equals(0).toArray();
}

let syncing = false;

/**
 * Pushes unsynced league_race rows to Supabase — pendingDelete rows are
 * retried as deletes (and dropped locally only once the delete succeeds, so
 * a reset made offline isn't lost the way an un-queued delete would be),
 * everything else is upserted on (league_id, run_heat) so a retry after a
 * dropped connection can't create a duplicate. Safe to call
 * repeatedly/concurrently — re-entrant calls are no-ops while a sync is
 * already in flight (§6.6).
 */
export async function syncPendingLeagueRaces(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const pending = await getUnsyncedLeagueRaces();
    if (pending.length === 0) return;

    const supabase = createClient();
    const toDelete = pending.filter((row) => row.pendingDelete === 1);
    const toUpsert = pending.filter((row) => row.pendingDelete === 0);

    for (const row of toDelete) {
      const { error } = await supabase
        .from("league_race")
        .delete()
        .eq("league_id", row.league_id)
        .eq("run_heat", row.run_heat);
      if (!error) {
        await db.league_races.delete(row.id);
      }
    }

    if (toUpsert.length > 0) {
      const rows: LeagueRaceRow[] = toUpsert.map((row) => ({
        league_id: row.league_id,
        run_heat: row.run_heat,
        started_at: row.started_at,
        device_id: row.device_id,
      }));
      const { error } = await supabase.from("league_race").upsert(rows, {
        onConflict: "league_id,run_heat",
        ignoreDuplicates: true,
      });
      if (!error) {
        await db.league_races.bulkUpdate(
          toUpsert.map((row) => ({
            key: row.id,
            changes: { synced: 1 },
          })),
        );
      }
    }
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
