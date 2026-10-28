"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { leagueAddress, type LeagueRef } from "@/lib/leagues/address";
import type { Json } from "@/lib/supabase/database.types";
import type { PoolLength } from "@/lib/results/points";
import { publishLeagueResults } from "@/lib/results/actions";

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

/** Where a fetched Swim results file came from (#71). */
export interface DriveOrigin {
  fileId: string;
  modifiedTime: string;
  leagueFolder: string;
}

export interface SaveSwimResultsState {
  saved?: number;
  /** Auto-save only: rows not saved because their result is now manual. */
  held?: number;
  fatalError?: string;
}

const TIME_PATTERN = /^\d{2}:\d{2}\.\d{2}$/;
const VALID_STATUS = new Set(["ok", "dns", "dnf", "dq"]);

/**
 * Writes a confirmed swim import (§4.6).
 *
 * Validated server-side rather than trusted from the client: unlike the
 * start list, these rows have been hand-edited in the browser, so a bad
 * time or status can reach here even though the parser never produces one.
 * A malformed time would otherwise hit the check constraint as an opaque
 * database error.
 */
export async function saveSwimResults(
  league: LeagueRef,
  fileName: string,
  rows: SwimResultInput[],
  counts: {
    created: number;
    updated: number;
    unchanged: number;
    needsReview: number;
  },
  /** Set when the file was fetched from Drive rather than uploaded. */
  drive?: DriveOrigin,
): Promise<SaveSwimResultsState> {
  const { leagueId } = league;
  if (rows.length === 0) {
    return { fatalError: "No rows to save." };
  }
  const invalid = invalidRows(rows);
  if (invalid) return { fatalError: invalid };

  const supabase = await createClient();
  const actor = await currentActor(supabase);

  const error = await upsertSwimResults(supabase, leagueId, rows, actor);
  if (error) {
    return { fatalError: `Failed to save swim results: ${error}` };
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
        ...(drive ? driveAudit(drive) : { source: "upload" }),
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

  revalidatePath(leagueAddress(league, "swim"));
  return { saved: rows.length };
}

/**
 * Saves a poll's clean rows (#77) without an Official confirming them:
 * every row is from the file as it is, so it's recorded as an import under
 * the Official whose tab polled, who approved polling by saving the first
 * import from Drive.
 *
 * A row whose saved result is 'manual' is never overwritten, even when the
 * browser's view of the saved results is older than the manual edit.
 */
export async function autoSaveSwimResults(
  league: LeagueRef,
  fileName: string,
  rows: SwimResultInput[],
  drive: DriveOrigin,
): Promise<SaveSwimResultsState> {
  const { leagueId } = league;
  if (rows.some((row) => row.edited || row.needsReview)) {
    return {
      fatalError: "Only clean rows from Drive are saved automatically.",
    };
  }
  const invalid = invalidRows(rows);
  if (invalid) return { fatalError: invalid };

  const supabase = await createClient();
  const { data: manual, error: manualError } = await supabase
    .from("swim_result")
    .select("athlete_no")
    .eq("league_id", leagueId)
    .eq("source", "manual")
    .in(
      "athlete_no",
      rows.map((row) => row.athleteNo),
    );
  if (manualError) {
    return {
      fatalError: `Failed to save swim results: ${manualError.message}`,
    };
  }
  const manualNos = new Set((manual ?? []).map((row) => row.athlete_no));
  const toSave = rows.filter((row) => !manualNos.has(row.athleteNo));
  const held = rows.length - toSave.length;
  if (toSave.length === 0) return { saved: 0, held };

  const actor = await currentActor(supabase);
  const error = await upsertSwimResults(supabase, leagueId, toSave, actor);
  if (error) {
    return { fatalError: `Failed to save swim results: ${error}` };
  }

  const { error: auditError } = await supabase.from("audit_log").insert({
    league_id: leagueId,
    actor,
    entity: `league:${leagueId}`,
    action: "swim_auto_save",
    after: {
      file_name: fileName,
      ...driveAudit(drive),
      rows: toSave.length,
    },
    reason: `auto-saved ${toSave.length} ${toSave.length === 1 ? "row" : "rows"} from Drive`,
  });
  if (auditError) {
    console.error("swim auto-save: audit log write failed", auditError);
  }

  revalidatePath(leagueAddress(league, "swim"));
  return { saved: toSave.length, held };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Where an import's file came from, for its audit entry. */
function driveAudit(drive: DriveOrigin) {
  return {
    source: "drive",
    drive_file_id: drive.fileId,
    drive_modified_time: drive.modifiedTime,
    league_folder: drive.leagueFolder,
  };
}

async function currentActor(supabase: Supabase): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? "unknown";
}

/**
 * Why the rows can't be saved, or null. Checked server-side rather than
 * trusted from the client (see saveSwimResults).
 */
function invalidRows(rows: SwimResultInput[]): string | null {
  for (const row of rows) {
    if (row.swimTime !== null && !TIME_PATTERN.test(row.swimTime)) {
      return `Athlete ${row.athleteNo}: time must be mm:SS.ss (got "${row.swimTime}").`;
    }
    if (!VALID_STATUS.has(row.status)) {
      return `Athlete ${row.athleteNo}: unknown status "${row.status}".`;
    }
  }

  const seen = new Set<number>();
  for (const row of rows) {
    if (seen.has(row.athleteNo)) {
      return `Athlete ${row.athleteNo} appears on more than one row — one athlete swims once.`;
    }
    seen.add(row.athleteNo);
  }
  return null;
}

/**
 * Upserts on (league_id, athlete_no) — one run, one swim, so a re-import of
 * a corrected export updates in place rather than accumulating rows.
 * Returns the database's error message, if any.
 */
async function upsertSwimResults(
  supabase: Supabase,
  leagueId: number,
  rows: SwimResultInput[],
  actor: string,
): Promise<string | null> {
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
  return error?.message ?? null;
}

/**
 * Sets the Pool length the League's swim session was held in (#70). It
 * decides the Short course adjustment, so the results page is refreshed to
 * rescore the swim points.
 */
export async function setPoolLength(
  league: LeagueRef,
  poolLength: PoolLength,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_pool_length", {
    target_league_id: league.leagueId,
    length_m: poolLength,
  });
  if (error) return { error: error.message };

  await publishLeagueResults(league.leagueId);
  revalidatePath(leagueAddress(league, "swim"));
  return {};
}
