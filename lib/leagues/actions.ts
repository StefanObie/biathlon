"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { leagueAddress, type LeagueRef } from "@/lib/leagues/address";
import type { ParsedEntryRow } from "@/lib/import/entry-row";
import { parseAgeGroup } from "@/lib/import/age-group";
import {
  alreadyOnStartListMessage,
  decideLateEntry,
  type LateEntryDecision,
} from "@/lib/leagues/late-entry";
import { resultsTag } from "@/lib/results/query";
import { defaultSlug } from "@/lib/results/slug";

export interface CreateLeagueState {
  error?: string;
}

export async function createLeague(
  _prevState: CreateLeagueState,
  formData: FormData,
): Promise<CreateLeagueState> {
  const name = String(formData.get("name") ?? "").trim();
  const leagueDate = String(formData.get("leagueDate") ?? "").trim();
  const season = Number(formData.get("season"));
  const organizationId = Number(formData.get("organizationId"));

  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    return { error: "Choose an organization." };
  }
  if (!name || !leagueDate || !Number.isInteger(season)) {
    return { error: "Name, date, and season are all required." };
  }

  const supabase = await createClient();
  const { data: organization } = await supabase
    .from("organization")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle();
  if (!organization) return { error: "Choose an organization." };

  // New Leagues are Public, with the Organization and League names as their
  // slug. If another League has it, the unique constraint refuses the
  // insert and the next attempt adds a counter.
  let data: { id: number } | null = null;
  let slug = "";
  let lastError: string | undefined;
  for (let attempt = 1; attempt <= 25 && !data; attempt++) {
    slug = defaultSlug(organization.name, name, attempt);
    const result = await supabase
      .from("league")
      // RLS only lets an Admin of the organization insert this.
      .insert({
        name,
        league_date: leagueDate,
        season,
        organization_id: organizationId,
        visibility: "public",
        results_slug: slug,
      })
      .select("id")
      .single();
    if (result.error?.code === "23505") continue;
    if (result.error) {
      lastError = result.error.message;
      break;
    }
    data = result.data;
  }

  if (!data) {
    return { error: lastError ?? "Failed to create league." };
  }

  // A guess at this slug may have been cached as not-found.
  updateTag(resultsTag(slug));
  revalidatePath(`/organizations/${organizationId}`);
  redirect(leagueAddress({ organizationId, leagueId: data.id }, "start-list"));
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Athletes belong to the league's organization (ADR 0002), so athlete
 * writes and lookups need it. Null when the league isn't visible to the
 * user.
 */
async function leagueOrganizationId(
  supabase: ServerClient,
  leagueId: number,
): Promise<number | null> {
  const { data } = await supabase
    .from("league")
    .select("organization_id")
    .eq("id", leagueId)
    .maybeSingle();
  return data?.organization_id ?? null;
}

export interface SaveStartListState {
  saved?: number;
  fatalError?: string;
}

/**
 * Saves rows already parsed client-side (see components/leagues/start-list.tsx)
 * to the league's start list — the source file is finalized data from a third
 * party, so there's no server-side re-validation step, just
 * upsert-by-athlete-number. Nothing is deleted, so Late entries that aren't in
 * the file stay in place.
 */
export async function saveStartList(
  league: LeagueRef,
  parsed: ParsedEntryRow[],
): Promise<SaveStartListState> {
  const { leagueId } = league;
  if (parsed.length === 0) {
    return { fatalError: "No rows to save." };
  }

  const supabase = await createClient();
  const organizationId = await leagueOrganizationId(supabase, leagueId);
  if (organizationId === null) {
    return { fatalError: "League not found." };
  }

  const athletes = parsed.map((p) => ({
    organization_id: organizationId,
    athlete_no: p.row.athleteNo,
    full_name: p.row.fullName,
    gender: p.gender,
  }));
  const { error: athleteError } = await supabase
    .from("athlete")
    .upsert(athletes);
  if (athleteError) {
    return { fatalError: `Failed to save athletes: ${athleteError.message}` };
  }

  const entries = parsed.map((p) => ({
    league_id: leagueId,
    athlete_no: p.row.athleteNo,
    run_heat: p.row.runHeat,
    swim_heat: p.row.swimHeat,
    swim_lane: p.row.swimLane,
    age_group_code: p.ageGroupCode,
  }));
  const { error: entryError } = await supabase
    .from("entry")
    .upsert(entries, { onConflict: "league_id,athlete_no" });
  if (entryError) {
    return { fatalError: `Failed to save entries: ${entryError.message}` };
  }

  revalidatePath(leagueAddress(league, "start-list"));
  return { saved: parsed.length };
}

export type LateEntryLookup =
  { decision: LateEntryDecision } | { error: string };

/**
 * What adding this Athlete number as a Late entry means, read fresh from the
 * database: the athlete, their latest age group in the Organization, and
 * whether they are already on this League's Start list.
 */
async function loadLateEntryDecision(
  supabase: ServerClient,
  organizationId: number,
  leagueId: number,
  athleteNo: number,
): Promise<LateEntryLookup> {
  const [
    { data: athletes, error: athleteError },
    { data: ageGroups, error: ageGroupError },
    { data: places, error: placeError },
  ] = await Promise.all([
    supabase
      .from("athlete")
      .select("athlete_no, full_name, gender")
      .eq("organization_id", organizationId)
      .eq("athlete_no", athleteNo),
    supabase.rpc("latest_age_groups", {
      org_id: organizationId,
      athlete_nos: [athleteNo],
    }),
    supabase
      .from("entry")
      .select("athlete_no, run_heat")
      .eq("league_id", leagueId)
      .eq("athlete_no", athleteNo),
  ]);
  const error = athleteError ?? ageGroupError ?? placeError;
  if (error) {
    return { error: `Failed to check athlete number: ${error.message}` };
  }

  const latest = new Map(
    (ageGroups ?? []).map((g) => [g.athlete_no, g.age_group_code]),
  );
  return {
    decision: decideLateEntry(
      athleteNo,
      (athletes ?? []).map((a) => ({
        athleteNo: a.athlete_no,
        fullName: a.full_name,
        gender: a.gender,
        latestAgeGroupCode: latest.get(a.athlete_no) ?? null,
      })),
      (places ?? []).map((p) => ({
        athleteNo: p.athlete_no,
        runHeat: p.run_heat,
      })),
    ),
  };
}

/**
 * Looks up an Athlete number while the Official types it into the Late entry
 * dialog, so a known athlete's name, gender and age group can be filled in.
 */
export async function lookUpLateEntry(
  league: LeagueRef,
  athleteNo: number,
): Promise<LateEntryLookup> {
  if (!Number.isInteger(athleteNo) || athleteNo <= 0) {
    return { error: "Athlete number must be a positive whole number." };
  }
  const supabase = await createClient();
  const organizationId = await leagueOrganizationId(supabase, league.leagueId);
  if (organizationId === null) return { error: "League not found." };
  return loadLateEntryDecision(
    supabase,
    organizationId,
    league.leagueId,
    athleteNo,
  );
}

export interface AddLateEntryState {
  error?: string;
  saved?: boolean;
}

/** A positive whole number, null for an empty field, or NaN for anything else. */
function optionalPositiveInt(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (text === "") return null;
  const n = Number(text);
  return Number.isInteger(n) && n > 0 ? n : NaN;
}

/**
 * Adds a Late entry: an athlete of the Organization added to this League's
 * Start list after the import, whether new or one who has raced for it
 * before. A known athlete keeps their stored name and gender. The swim slot
 * may stay empty. The entry is inserted, never upserted, so an athlete
 * already on the Start list is refused rather than moved between heats.
 */
export async function addLateEntry(
  league: LeagueRef,
  _prevState: AddLateEntryState,
  formData: FormData,
): Promise<AddLateEntryState> {
  const { leagueId } = league;
  const athleteNo = Number(formData.get("athleteNo"));
  const fullName = String(formData.get("fullName") ?? "").trim();
  const ageGroupLabel = String(formData.get("ageGroupLabel") ?? "").trim();
  const runHeat = Number(formData.get("runHeat"));
  const swimHeat = optionalPositiveInt(formData.get("swimHeat"));
  const swimLane = optionalPositiveInt(formData.get("swimLane"));

  if (!Number.isInteger(athleteNo) || athleteNo <= 0) {
    return { error: "Athlete number must be a positive whole number." };
  }
  const ageGroup = parseAgeGroup(ageGroupLabel);
  if (!ageGroup) {
    return { error: "Choose an age group." };
  }
  if (!Number.isInteger(runHeat) || runHeat <= 0) {
    return { error: "Run heat must be a positive whole number." };
  }
  if (Number.isNaN(swimHeat) || Number.isNaN(swimLane)) {
    return { error: "Swim heat and lane must be positive whole numbers." };
  }
  if ((swimHeat === null) !== (swimLane === null)) {
    return { error: "Give both a swim heat and a swim lane, or neither." };
  }

  const supabase = await createClient();
  const organizationId = await leagueOrganizationId(supabase, leagueId);
  if (organizationId === null) {
    return { error: "League not found." };
  }

  const lookup = await loadLateEntryDecision(
    supabase,
    organizationId,
    leagueId,
    athleteNo,
  );
  if ("error" in lookup) return lookup;
  const { decision } = lookup;

  if (decision.kind === "already-on-start-list") {
    return { error: alreadyOnStartListMessage(athleteNo, decision.runHeat) };
  }
  if (decision.kind === "existing-athlete") {
    if (decision.gender !== ageGroup.gender) {
      return {
        error: `${decision.fullName} is stored as ${decision.gender === "F" ? "female" : "male"}. Choose a matching age group.`,
      };
    }
  } else {
    if (!fullName) {
      return { error: "Athlete name is required." };
    }
    const { error: athleteError } = await supabase.from("athlete").insert({
      organization_id: organizationId,
      athlete_no: athleteNo,
      full_name: fullName,
      gender: ageGroup.gender,
    });
    if (athleteError) {
      return { error: `Failed to save athlete: ${athleteError.message}` };
    }
  }

  const { error: entryError } = await supabase.from("entry").insert({
    league_id: leagueId,
    athlete_no: athleteNo,
    run_heat: runHeat,
    swim_heat: swimHeat,
    swim_lane: swimLane,
    age_group_code: ageGroup.code,
  });
  if (entryError?.code === "23505") {
    // Someone else added them in the meantime.
    const { data } = await supabase
      .from("entry")
      .select("run_heat")
      .eq("league_id", leagueId)
      .eq("athlete_no", athleteNo)
      .maybeSingle();
    if (data)
      return { error: alreadyOnStartListMessage(athleteNo, data.run_heat) };
  }
  if (entryError) {
    return { error: `Failed to save entry: ${entryError.message}` };
  }

  revalidatePath(leagueAddress(league, "start-list"));
  return { saved: true };
}
