import Dexie, { type EntityTable } from "dexie";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type TimeCaptureRow = Database["public"]["Tables"]["time_capture"]["Row"];

/** Local mirror of time_capture, plus a sync flag. Never mutate rows other
 * than to flip `synced` or set voided/void_reason — the same never-edit-a-
 * capture invariant that applies server-side (§1) applies here too, since
 * these rows are pushed verbatim. */
export interface LocalTimeCapture extends TimeCaptureRow {
  synced: boolean;
}

// IndexedDB keys can't be booleans, so the indexed sync flag is stored as
// 0/1 on disk (StoredCapture) and converted to/from boolean at the edges.
interface StoredCapture extends Omit<TimeCaptureRow, never> {
  synced: 0 | 1;
}

function toStored(row: LocalTimeCapture): StoredCapture {
  return { ...row, synced: row.synced ? 1 : 0 };
}

function fromStored(row: StoredCapture): LocalTimeCapture {
  return { ...row, synced: row.synced === 1 };
}

class TimeCaptureDB extends Dexie {
  time_captures!: EntityTable<StoredCapture, "id">;

  constructor() {
    super("biathlon-time-capture");
    this.version(1).stores({
      // Compound index for the (league_id, run_heat) scoped queries, plus
      // `synced` for the sync sweep's pending-rows lookup.
      time_captures: "id, [league_id+run_heat], synced",
    });
  }
}

const db = new TimeCaptureDB();

export async function putCapture(row: LocalTimeCapture): Promise<void> {
  await db.time_captures.put(toStored(row));
}

export async function voidCapture(
  id: string,
  voidReason: string,
): Promise<void> {
  await db.time_captures.update(id, {
    voided: true,
    void_reason: voidReason,
    synced: 0,
  });
}

export async function getCapturesForHeat(
  leagueId: number,
  runHeat: number,
): Promise<LocalTimeCapture[]> {
  const rows = await db.time_captures
    .where("[league_id+run_heat]")
    .equals([leagueId, runHeat])
    .toArray();
  return rows.map(fromStored);
}

async function getUnsyncedCaptures(): Promise<LocalTimeCapture[]> {
  const rows = await db.time_captures.where("synced").equals(0).toArray();
  return rows.map(fromStored);
}

let syncing = false;

/**
 * Pushes unsynced rows to Supabase, upserting on `id` (the client-generated
 * ULID) so a retry after a dropped connection can't create a duplicate
 * (§5.8/§6.6). Safe to call repeatedly/concurrently — re-entrant calls are
 * no-ops while a sync is already in flight.
 */
export async function syncPendingCaptures(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const pending = await getUnsyncedCaptures();
    if (pending.length === 0) return;

    const supabase = createClient();
    const rows: TimeCaptureRow[] = pending.map((row) => ({
      id: row.id,
      league_id: row.league_id,
      run_heat: row.run_heat,
      seq: row.seq,
      elapsed_time: row.elapsed_time,
      is_placeholder: row.is_placeholder,
      device_id: row.device_id,
      captured_at: row.captured_at,
      voided: row.voided,
      void_reason: row.void_reason,
    }));
    const { error } = await supabase.from("time_capture").upsert(rows);
    if (error) return;

    await db.time_captures.bulkUpdate(
      pending.map((row) => ({ key: row.id, changes: { synced: 1 } })),
    );
  } finally {
    syncing = false;
  }
}

let sweepStarted = false;

/**
 * Starts the background sync sweep: on an interval, and on reconnect/tab
 * foreground, so multiple pending rows batch naturally instead of firing a
 * network call per write (§6.6). Idempotent — safe to call on every mount.
 */
export function startSyncSweep(): () => void {
  void syncPendingCaptures();
  if (sweepStarted) return () => {};
  sweepStarted = true;

  const interval = setInterval(() => void syncPendingCaptures(), 5000);
  const onOnline = () => void syncPendingCaptures();
  const onVisibility = () => {
    if (document.visibilityState === "visible") void syncPendingCaptures();
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
