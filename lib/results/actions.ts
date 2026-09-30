"use server";

import { revalidatePath, updateTag } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  defaultSlug,
  isCustomSlug,
  normaliseSlug,
  randomSlug,
} from "@/lib/results/slug";
import { resultsTag } from "@/lib/results/query";
import type { Database } from "@/lib/supabase/database.types";

type Visibility = Database["public"]["Enums"]["league_visibility"];
type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface ResultsSettingsResult {
  error?: string;
}

const NOT_ADMIN = "Only an Admin of the organization can change this.";
// Enough for a League name that many others share, or bad luck with a
// random slug; a real run of collisions is a bug worth surfacing.
const MAX_ATTEMPTS = 25;

/** Expires the cached results page at each of these slugs. */
function expireResults(...slugs: (string | null | undefined)[]) {
  for (const slug of new Set(slugs)) if (slug) updateTag(resultsTag(slug));
}

/**
 * Writes a League's Visibility and slug. RLS only lets an Admin of its
 * Organization update a League, so a write that changes nothing means the
 * caller isn't one. `nextSlug(attempt)` gives the slug to try, or null for
 * none; a unique violation (23505) means another League has it, so it tries
 * again with the next attempt, unless `retry` is false, which is for a slug
 * an Admin chose and must not be altered.
 */
async function writeResults(
  supabase: Supabase,
  leagueId: number,
  visibility: Visibility,
  nextSlug: (attempt: number) => string | null,
  retry: boolean,
): Promise<ResultsSettingsResult & { slug?: string | null }> {
  for (let attempt = 1; attempt <= (retry ? MAX_ATTEMPTS : 1); attempt++) {
    const slug = nextSlug(attempt);
    const { data, error } = await supabase
      .from("league")
      .update({ visibility, results_slug: slug })
      .eq("id", leagueId)
      .select("id");
    if (error?.code === "23505") continue;
    if (error) return { error: error.message };
    if (data.length === 0) return { error: NOT_ADMIN };
    return { slug };
  }
  return {
    error: retry
      ? "Couldn't find a free address. Try again."
      : "That address is already used by another League.",
  };
}

async function currentSettings(supabase: Supabase, leagueId: number) {
  const { data } = await supabase
    .from("league")
    .select("name, visibility, results_slug, organization(name)")
    .eq("id", leagueId)
    .maybeSingle();
  return data;
}

/**
 * Sets a League's Visibility. Whatever it was, the slug is replaced: Public
 * gets the default readable slug, Protected a fresh random one, Private
 * none. The old address stops working, so the UI warns first.
 */
export async function setVisibility(
  leagueId: number,
  visibility: Visibility,
): Promise<ResultsSettingsResult> {
  const supabase = await createClient();
  const league = await currentSettings(supabase, leagueId);
  if (!league) return { error: NOT_ADMIN };

  const result = await writeResults(
    supabase,
    leagueId,
    visibility,
    (attempt) =>
      visibility === "public"
        ? defaultSlug(league.organization.name, league.name, attempt)
        : visibility === "protected"
          ? randomSlug()
          : null,
    true,
  );
  if (result.error) return { error: result.error };

  expireResults(league.results_slug, result.slug);
  revalidatePath(`/leagues/${leagueId}/settings`);
  return {};
}

/**
 * Changes a Public League's slug. The input is normalised first. A slug
 * another League already has, or one that isn't valid, is an error and
 * nothing is saved; it's never altered to fit.
 */
export async function setResultsSlug(
  leagueId: number,
  input: string,
): Promise<ResultsSettingsResult & { slug?: string }> {
  const slug = normaliseSlug(input);
  if (!isCustomSlug(slug)) {
    return {
      error:
        "Use 3 to 80 letters, digits and single hyphens, such as gnb-league-1.",
    };
  }

  const supabase = await createClient();
  const league = await currentSettings(supabase, leagueId);
  if (!league) return { error: NOT_ADMIN };
  if (league.visibility !== "public") {
    return { error: "Only a Public League has a readable address." };
  }
  if (league.results_slug === slug) return { slug };

  const result = await writeResults(
    supabase,
    leagueId,
    "public",
    () => slug,
    false,
  );
  if (result.error) return { error: result.error };

  expireResults(league.results_slug, slug);
  revalidatePath(`/leagues/${leagueId}/settings`);
  return { slug };
}

/** Replaces a Protected League's Results link; the old one stops working. */
export async function regenerateResultsLink(
  leagueId: number,
): Promise<ResultsSettingsResult> {
  const supabase = await createClient();
  const league = await currentSettings(supabase, leagueId);
  if (!league) return { error: NOT_ADMIN };
  if (league.visibility !== "protected") {
    return { error: "Only a Protected League has a Results link." };
  }

  const result = await writeResults(
    supabase,
    leagueId,
    "protected",
    () => randomSlug(),
    true,
  );
  if (result.error) return { error: result.error };

  expireResults(league.results_slug, result.slug);
  revalidatePath(`/leagues/${leagueId}/settings`);
  return {};
}

/**
 * Refreshes a League's results page after one of its heats is closed or
 * reopened, so it shows the change without waiting for the cache to expire.
 * Anyone on the League's team can call it, and all it does is expire a
 * cache entry.
 */
export async function publishLeagueResults(leagueId: number): Promise<void> {
  const supabase = await createClient();
  const league = await currentSettings(supabase, leagueId);
  expireResults(league?.results_slug);
}
