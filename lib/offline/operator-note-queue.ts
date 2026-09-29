import Dexie, { type EntityTable } from "dexie";

import { pushRows } from "@/lib/offline/push-rows";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

// author_id is left out: the database always sets it from the session.
type OperatorNoteRow = Omit<
  Database["public"]["Tables"]["operator_note"]["Row"],
  "author_id"
>;

/** Local mirror of operator_note, plus a sync flag. Notes are append-only —
 * unlike the capture queues there is no void path, so `synced` is the only
 * field that ever changes after a row is written. */
export interface LocalOperatorNote extends OperatorNoteRow {
  synced: boolean;
}

// IndexedDB keys can't be booleans, so the indexed sync flag is stored as
// 0/1 on disk (StoredNote) and converted to/from boolean at the edges.
interface StoredNote extends Omit<OperatorNoteRow, never> {
  synced: 0 | 1;
}

function toStored(row: LocalOperatorNote): StoredNote {
  return { ...row, synced: row.synced ? 1 : 0 };
}

function fromStored(row: StoredNote): LocalOperatorNote {
  return { ...row, synced: row.synced === 1 };
}

class OperatorNoteDB extends Dexie {
  operator_notes!: EntityTable<StoredNote, "id">;

  constructor() {
    super("biathlon-operator-note");
    this.version(1).stores({
      // `synced` for the sync sweep's pending-rows lookup. Nothing reads
      // notes back per heat on a capture screen — reconciliation reads them
      // from Supabase, where every phone's notes are gathered.
      operator_notes: "id, synced",
    });
  }
}

const db = new OperatorNoteDB();

export async function putNote(row: LocalOperatorNote): Promise<void> {
  await db.operator_notes.put(toStored(row));
}

async function getUnsyncedNotes(): Promise<LocalOperatorNote[]> {
  const rows = await db.operator_notes.where("synced").equals(0).toArray();
  return rows.map(fromStored);
}

let syncing = false;

/**
 * Pushes unsynced notes to Supabase, upserting on `id` (the client-generated
 * ULID) so a retry after a dropped connection can't create a duplicate
 * (§5.8/§6.6). Safe to call repeatedly/concurrently — re-entrant calls are
 * no-ops while a sync is already in flight.
 */
export async function syncPendingNotes(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const pending = await getUnsyncedNotes();
    if (pending.length === 0) return;

    const supabase = createClient();
    const rows: OperatorNoteRow[] = pending.map((row) => ({
      id: row.id,
      league_id: row.league_id,
      run_heat: row.run_heat,
      anchor: row.anchor,
      screen: row.screen,
      body: row.body,
      device_id: row.device_id,
      created_at: row.created_at,
    }));
    // ignoreDuplicates, not a merge: a note already on the server is the
    // same note (same ULID) and is never edited, so there is nothing to
    // overwrite — and the table grants no UPDATE to an operator anyway.
    const landed = await pushRows(rows, (batch) =>
      supabase.from("operator_note").upsert(batch, { ignoreDuplicates: true }),
    );

    await db.operator_notes.bulkUpdate(
      [...landed].map((id) => ({ key: id, changes: { synced: 1 } })),
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
export function startNoteSyncSweep(): () => void {
  void syncPendingNotes();
  if (sweepStarted) return () => {};
  sweepStarted = true;

  const interval = setInterval(() => void syncPendingNotes(), 5000);
  const onOnline = () => void syncPendingNotes();
  const onVisibility = () => {
    if (document.visibilityState === "visible") void syncPendingNotes();
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
