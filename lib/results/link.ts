import { leagueAddress } from "@/lib/leagues/address";

export type ResultsLink =
  { kind: "results"; href: string } | { kind: "private"; href: string | null };

/**
 * What the reconcile pages show for a League's public results: the results
 * address when it is Public or Protected, otherwise "Results are private",
 * linked to Setup → Visibility for Admins only.
 */
export function resultsLink(input: {
  visibility: "public" | "protected" | "private";
  slug: string | null;
  isAdmin: boolean;
  organizationId: number;
  leagueId: number;
}): ResultsLink {
  if (input.visibility !== "private" && input.slug) {
    return { kind: "results", href: `/results/${input.slug}` };
  }
  return {
    kind: "private",
    href: input.isAdmin
      ? leagueAddress(
          { organizationId: input.organizationId, leagueId: input.leagueId },
          "results",
        )
      : null,
  };
}
