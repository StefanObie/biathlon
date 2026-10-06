import type { createClient } from "@/lib/supabase/server";
import type { OrganizationAthlete } from "@/lib/leagues/late-entry";

/** An athlete of the Organization as stored, without their latest age group. */
export type StoredAthlete = Omit<OrganizationAthlete, "latestAgeGroupCode">;

// The API returns at most max_rows (1000) rows a request, and an
// Organization's athletes outgrow that over the seasons, so read them a page
// at a time rather than silently treating the rest as unknown.
const ATHLETE_PAGE = 1000;

/** Every athlete of the Organization, by Athlete number. */
export async function loadOrganizationAthletes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: number,
): Promise<{ data: StoredAthlete[]; error: { message: string } | null }> {
  const athletes: StoredAthlete[] = [];
  for (let from = 0; ; from += ATHLETE_PAGE) {
    const { data, error } = await supabase
      .from("athlete")
      .select("athlete_no, full_name, gender")
      .eq("organization_id", organizationId)
      .order("athlete_no")
      .range(from, from + ATHLETE_PAGE - 1);
    if (error) return { data: [], error };
    for (const a of data) {
      athletes.push({
        athleteNo: a.athlete_no,
        fullName: a.full_name,
        gender: a.gender,
      });
    }
    if (data.length < ATHLETE_PAGE) return { data: athletes, error: null };
  }
}
