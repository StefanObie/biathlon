import { ageGroupLabel, type Gender } from "@/lib/import/age-group";

/**
 * An athlete of the Organization, with the age group of their latest entry
 * (public.latest_age_groups).
 */
export interface OrganizationAthlete {
  athleteNo: number;
  fullName: string;
  gender: Gender;
  /** Null when the athlete has never been entered in a League. */
  latestAgeGroupCode: string | null;
}

/** Where an athlete already on this League's Start list runs. */
export interface StartListPlace {
  athleteNo: number;
  runHeat: number;
}

export type LateEntryDecision =
  | { kind: "new-athlete" }
  | {
      kind: "existing-athlete";
      fullName: string;
      gender: Gender;
      /** A label from AGE_GROUP_LABELS, or null when there is none to suggest. */
      suggestedAgeGroupLabel: string | null;
    }
  | { kind: "already-on-start-list"; runHeat: number };

/**
 * What adding a Late entry with this Athlete number means: a new athlete to
 * the Organization, one who has raced for it before, or one who is already on
 * this League's Start list and must not be added (or moved) again.
 */
export function decideLateEntry(
  athleteNo: number,
  athletes: OrganizationAthlete[],
  startList: StartListPlace[],
): LateEntryDecision {
  const place = startList.find((p) => p.athleteNo === athleteNo);
  if (place) return { kind: "already-on-start-list", runHeat: place.runHeat };

  const athlete = athletes.find((a) => a.athleteNo === athleteNo);
  if (!athlete) return { kind: "new-athlete" };

  return {
    kind: "existing-athlete",
    fullName: athlete.fullName,
    gender: athlete.gender,
    suggestedAgeGroupLabel:
      athlete.latestAgeGroupCode === null
        ? null
        : ageGroupLabel(athlete.latestAgeGroupCode, athlete.gender),
  };
}

/** Why a Late entry for an athlete already on the Start list is refused. */
export function alreadyOnStartListMessage(
  athleteNo: number,
  runHeat: number,
): string {
  return `#${athleteNo} is already on the Start list in heat ${runHeat}`;
}
