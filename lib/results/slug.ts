/**
 * The Results slug (CONTEXT.md): normalising, validating and generating the
 * part of a League's results address that identifies it. The database
 * enforces the same formats with check constraints (league_results_slug_format),
 * so a slug that passes here is one it will accept.
 */

const CUSTOM_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RANDOM_SLUG = /^[A-Za-z0-9_-]{22,}$/;
const MAX_LENGTH = 80;
const MIN_LENGTH = 3;
const FALLBACK = "league";

/**
 * Lowercase letters and digits (anything else, accents included, becomes a hyphen, exactly as the database's private.normalise_slug does) with single hyphens between them: `GNB
 * League 1` becomes `gnb-league-1`. May return something too short to be a
 * valid slug; check it with isCustomSlug.
 */
export function normaliseSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Whether a Public League's slug is well formed. */
export function isCustomSlug(slug: string): boolean {
  return (
    slug.length >= MIN_LENGTH &&
    slug.length <= MAX_LENGTH &&
    CUSTOM_SLUG.test(slug)
  );
}

/** Whether a Protected League's slug is well formed. */
export function isRandomSlug(slug: string): boolean {
  return RANDOM_SLUG.test(slug) && /[A-Z]/.test(slug);
}

/**
 * The default Public slug: the Organization and League names, hyphenated.
 * `attempt` is 1 for the first try; from 2 a counter is appended
 * (`-2`, `-3`, …), so a caller that hits a collision asks again with the
 * next attempt.
 */
export function defaultSlug(
  organizationName: string,
  leagueName: string,
  attempt: number,
): string {
  let base = normaliseSlug(`${organizationName} ${leagueName}`)
    .slice(0, MAX_LENGTH)
    .replace(/-+$/, "");
  if (base.length < MIN_LENGTH) base = FALLBACK;
  if (attempt <= 1) return base;
  const suffix = `-${attempt}`;
  return `${base.slice(0, MAX_LENGTH - suffix.length).replace(/-+$/, "")}${suffix}`;
}

/**
 * A fresh random slug for a Protected League: 22 URL-safe characters (132
 * bits) from a cryptographically secure source. It always has an uppercase
 * letter, so it can never be a valid custom slug.
 */
export function randomSlug(): string {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(22));
    const slug = Array.from(
      bytes,
      (byte) =>
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"[
          byte & 63
        ],
    ).join("");
    if (isRandomSlug(slug)) return slug;
  }
}
