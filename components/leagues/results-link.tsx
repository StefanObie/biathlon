import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { resultsLink } from "@/lib/results/link";

export async function ResultsLink({
  organizationId,
  leagueId,
  isAdmin,
}: {
  organizationId: number;
  leagueId: number;
  isAdmin: boolean;
}) {
  const supabase = await createClient();
  const { data: league } = await supabase
    .from("league")
    .select("visibility, results_slug")
    .eq("id", leagueId)
    .maybeSingle();
  if (!league) return null;

  const link = resultsLink({
    visibility: league.visibility,
    slug: league.results_slug,
    isAdmin,
    organizationId,
    leagueId,
  });

  const className = "text-sm text-muted-foreground";
  if (link.kind === "results") {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} underline underline-offset-4`}
      >
        View public results ↗
      </a>
    );
  }
  return link.href ? (
    <Link
      href={link.href}
      className={`${className} underline underline-offset-4`}
    >
      Results are private
    </Link>
  ) : (
    <span className={className}>Results are private</span>
  );
}
