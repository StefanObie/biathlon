export type Gender = "M" | "F";

export interface ParsedAgeGroup {
  code: string;
  gender: Gender;
}

/**
 * The finite set of age-group labels the club's import files use (§6.1) —
 * every one of these must parse via parseAgeGroup below (enforced in
 * age-group.test.ts). Exported so UI that needs a closed list to pick from
 * (rather than free-text entry, e.g. a walk-up athlete form) can reuse the
 * same vocabulary instead of guessing at it separately.
 */
export const AGE_GROUP_LABELS = [
  "U/08 GIRLS",
  "U/08 BOYS",
  "U/09 GIRLS",
  "U/09 BOYS",
  "U/11 GIRLS",
  "U/11 BOYS",
  "U/13 GIRLS",
  "U/13 BOYS",
  "U/15 GIRLS",
  "U/15 BOYS",
  "U/17 GIRLS",
  "U/17 BOYS",
  "U/19 GIRLS",
  "U/19 BOYS",
  "JNR WOMEN",
  "JNR MEN",
  "MASTERS 40+ WOMEN",
  "MASTERS 40+ MEN",
  "MASTERS 50+ WOMEN",
  "MASTERS 50+ MEN",
  "MASTERS 60+ WOMEN",
  "MASTERS 60+ MEN",
  "MASTERS 70+ WOMEN",
  "MASTERS 70+ MEN",
] as const;

/**
 * Normalizes an SA Biathlon age-group label into a stable code + gender.
 *
 * Confirmed label shapes (full set as supplied by the club, see
 * biathlon-technical-spec.md §6.1):
 *   "U/09 GIRLS"        -> { code: "U09", gender: "F" }
 *   "U/19 BOYS"         -> { code: "U19", gender: "M" }
 *   "MASTERS 60+ WOMEN" -> { code: "M60", gender: "F" }
 *   "MASTERS 40+ MEN"   -> { code: "M40", gender: "M" }
 *   "JNR WOMEN"         -> { code: "JNR", gender: "F" }
 *   "JNR MEN"           -> { code: "JNR", gender: "M" }
 *
 * Returns null for anything that doesn't match a known shape — callers
 * must route unrecognised labels to the import exception queue (§6.1's
 * "validated at import time" trade-off) rather than guessing.
 */
export function parseAgeGroup(label: string): ParsedAgeGroup | null {
  const normalized = label.trim().toUpperCase();

  const genderWord = normalized.match(/\b(GIRLS|BOYS|WOMEN|MEN)\b/);
  if (!genderWord) return null;
  const gender: Gender =
    genderWord[1] === "GIRLS" || genderWord[1] === "WOMEN" ? "F" : "M";

  const under = normalized.match(/^U\/(\d{1,2})\s+(GIRLS|BOYS)$/);
  if (under) {
    return { code: `U${under[1].padStart(2, "0")}`, gender };
  }

  const masters = normalized.match(/^MASTERS\s+(\d{1,2})\+\s+(WOMEN|MEN)$/);
  if (masters) {
    return { code: `M${masters[1].padStart(2, "0")}`, gender };
  }

  const junior = normalized.match(/^JNR\s+(WOMEN|MEN)$/);
  if (junior) {
    return { code: "JNR", gender };
  }

  return null;
}
