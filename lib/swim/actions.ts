"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export interface SwimResultInput {
  athleteNo: number;
  eventNo: number;
  heat: number;
  lane: number;
  distanceM: number | null;
  swimTime: string | null;
  place: number | null;
  status: string;
  sourceLine: string | null;
  needsReview: boolean;
  /** True when an operator changed the athlete or time before confirming. */
  edited: boolean;
}

export interface SaveSwimResultsState {
  saved?: number;
  fatalError?: string;
}

const TIME_PATTERN = /^\d{2}:\d{2}\.\d{2}$/;
const VALID_STATUS = new Set(["ok", "dns", "dnf", "dq"]);

/**
 * Writes a confirmed swim import (§4.6).
 *
 * Upserts on (league_id, athlete_no) — one run, one swim, so a re-import of
 * a corrected export updates in place rather than accumulating rows.
 *
 * Validated server-side rather than trusted from the client: unlike the
 * start list, these rows have been hand-edited in the browser, so a bad
 * time or status can reach here even though the parser never produces one.
 * A malformed time would otherwise hit the check constraint as an opaque
 * database error.
 */
export async function saveSwimResults(
  leagueId: number,
  fileName: string,
  rows: SwimResultInput[],
  counts: {
    created: number;
    updated: number;
    unchanged: number;
    needsReview: number;
  },
): Promise<SaveSwimResultsState> {
  if (rows.length === 0) {
    return { fatalError: "No rows to save." };
  }

  for (const row of rows) {
    if (row.swimTime !== null && !TIME_PATTERN.test(row.swimTime)) {
      return {
        fatalError: `Athlete ${row.athleteNo}: time must be mm:SS.ss (got "${row.swimTime}").`,
      };
    }
    if (!VALID_STATUS.has(row.status)) {
      return {
        fatalError: `Athlete ${row.athleteNo}: unknown status "${row.status}".`,
      };
    }
  }

  const seen = new Set<number>();
  for (const row of rows) {
    if (seen.has(row.athleteNo)) {
      return {
        fatalError: `Athlete ${row.athleteNo} appears on more than one row — one athlete swims once.`,
      };
    }
    seen.add(row.athleteNo);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const actor = user?.email ?? "unknown";

  const { error } = await supabase.from("swim_result").upsert(
    rows.map((row) => ({
      league_id: leagueId,
      athlete_no: row.athleteNo,
      event_no: row.eventNo,
      heat: row.heat,
      lane: row.lane,
      distance_m: row.distanceM,
      swim_time: row.swimTime,
      place: row.place,
      status: row.status,
      // An operator-touched row is 'manual' so a later re-import can flag it
      // rather than silently overwriting the correction.
      source: row.edited ? "manual" : "import",
      overridden_by: row.edited ? actor : null,
      source_line: row.sourceLine,
      needs_review: row.needsReview,
    })),
    { onConflict: "league_id,athlete_no" },
  );

  if (error) {
    return { fatalError: `Failed to save swim results: ${error.message}` };
  }

  // One row for the import event, plus one per operator-modified row —
  // not one per untouched parsed row, which would be noise.
  const auditRows: {
    league_id: number;
    actor: string;
    entity: string;
    action: string;
    after: Json;
    reason: string | null;
  }[] = [
    {
      league_id: leagueId,
      actor,
      entity: `league:${leagueId}`,
      action: "swim_import",
      after: {
        file_name: fileName,
        rows: rows.length,
        created: counts.created,
        updated: counts.updated,
        unchanged: counts.unchanged,
        needs_review: counts.needsReview,
      },
      reason: null,
    },
    ...rows
      .filter((row) => row.edited)
      .map((row) => ({
        league_id: leagueId,
        actor,
        entity: `swim_result:${leagueId}:${row.athleteNo}`,
        action: "swim_manual_edit",
        after: {
          athlete_no: row.athleteNo,
          swim_time: row.swimTime,
          status: row.status,
          heat: row.heat,
          lane: row.lane,
        },
        reason: row.sourceLine,
      })),
  ];

  const { error: auditError } = await supabase
    .from("audit_log")
    .insert(auditRows);
  if (auditError) {
    // The results are already saved; failing the whole action here would
    // tell the operator nothing was written when in fact it was.
    console.error("swim import: audit log write failed", auditError);
  }

  revalidatePath(`/leagues/${leagueId}/swim`);
  return { saved: rows.length };
}
