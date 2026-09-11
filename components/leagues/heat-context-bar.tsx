"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export type HeatMode = "timer" | "position" | "reconcile";

const MODE_LABEL: Record<HeatMode, string> = {
  timer: "Timer",
  position: "Position",
  reconcile: "Reconcile",
};

interface LeagueOption {
  id: number;
  name: string;
}

/**
 * Thumb-zone bar for the heat-scoped capture screens (timer, position,
 * reconcile). Center pill opens a bottom sheet to switch league, heat, or
 * mode — operators normally stay in one mode all day (§ single-task
 * enforcement), so mode-switching lives inside the sheet rather than as its
 * own persistent control. Corner arrows jump directly to the adjacent heat.
 */
export function HeatContextBar({
  leagueId,
  leagueName,
  mode,
  runHeat,
  heats,
}: {
  leagueId: number;
  leagueName: string;
  mode: HeatMode;
  runHeat: number;
  heats: number[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leagues, setLeagues] = useState<LeagueOption[] | null>(null);
  const [loadingLeagues, setLoadingLeagues] = useState(false);

  const sortedHeats = [...heats].sort((a, b) => a - b);
  const index = sortedHeats.indexOf(runHeat);
  const prevHeat = index > 0 ? sortedHeats[index - 1] : null;
  const nextHeat =
    index >= 0 && index < sortedHeats.length - 1
      ? sortedHeats[index + 1]
      : null;

  function heatHref(heat: number) {
    return `/leagues/${leagueId}/${mode}/${heat}`;
  }

  async function handleOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && leagues === null) {
      setLoadingLeagues(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("league")
        .select("id, name")
        .order("league_date", { ascending: false });
      setLeagues(data ?? []);
      setLoadingLeagues(false);
    }
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <ArrowButton
          direction="prev"
          heat={prevHeat}
          href={prevHeat !== null ? heatHref(prevHeat) : undefined}
        />

        <button
          type="button"
          onClick={() => void handleOpen(true)}
          className="flex min-w-0 flex-1 max-w-xs flex-col items-center rounded-full border border-input bg-background px-4 py-2 text-center shadow-sm active:scale-[0.98]"
        >
          <span className="truncate text-sm font-semibold">{leagueName}</span>
          <span className="text-xs text-muted-foreground">
            Heat {runHeat} · {MODE_LABEL[mode]}
          </span>
        </button>

        <ArrowButton
          direction="next"
          heat={nextHeat}
          href={nextHeat !== null ? heatHref(nextHeat) : undefined}
        />
      </div>

      {/* Spacer so page content isn't hidden behind the fixed bar. */}
      <div className="h-20" aria-hidden />

      <Dialog open={open} onOpenChange={(next) => void handleOpen(next)}>
        <DialogContent
          showCloseButton
          className="top-auto bottom-0 left-0 right-0 translate-x-0 translate-y-0 rounded-t-xl rounded-b-none border-b-0 sm:max-w-lg sm:mx-auto data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
        >
          <DialogHeader>
            <DialogTitle>Switch league or heat</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                League
              </p>
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                {loadingLeagues && (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                )}
                {leagues?.map((league) => (
                  <Link
                    key={league.id}
                    href={`/leagues/${league.id}/${mode}`}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm hover:bg-accent",
                      league.id === leagueId && "bg-accent font-semibold",
                    )}
                  >
                    {league.name}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Heat
              </p>
              <div className="grid grid-cols-4 gap-2">
                {sortedHeats.map((heat) => (
                  <Link
                    key={heat}
                    href={heatHref(heat)}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex h-11 items-center justify-center rounded-md border border-input text-base font-semibold tabular-nums hover:bg-accent",
                      heat === runHeat && "border-primary bg-accent",
                    )}
                  >
                    {heat}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Mode
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(MODE_LABEL) as HeatMode[]).map((m) => (
                  <Button
                    key={m}
                    variant={m === mode ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      router.push(`/leagues/${leagueId}/${m}/${runHeat}`);
                    }}
                  >
                    {MODE_LABEL[m]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ArrowButton({
  direction,
  heat,
  href,
}: {
  direction: "prev" | "next";
  heat: number | null;
  href: string | undefined;
}) {
  const Icon = direction === "prev" ? ChevronLeftIcon : ChevronRightIcon;
  const label = direction === "prev" ? "Previous heat" : "Next heat";

  if (heat === null || !href) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-muted-foreground/30">
        <Icon className="h-6 w-6" />
      </div>
    );
  }

  return (
    <Button
      asChild
      size="icon"
      className="h-12 w-12 shrink-0 rounded-full bg-green-600 text-white shadow-sm hover:bg-green-700"
      title={`${label} (${heat})`}
    >
      <Link href={href}>
        <Icon className="h-6 w-6" />
        <span className="sr-only">
          {label} ({heat})
        </span>
      </Link>
    </Button>
  );
}
