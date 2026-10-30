"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FootprintsIcon,
  SettingsIcon,
  WavesIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { HeatMode } from "@/lib/access/roles";
import { leagueAddress } from "@/lib/leagues/address";
import { counterpartHeat, SCREEN_LABEL } from "@/lib/navigation/navigation";

const MODE_LABEL: Record<HeatMode, string> = {
  timer: "Timer",
  position: "Position",
  "call-room": "Call room",
  reconcile: "Reconcile",
};

/**
 * Thumb-zone bar for the heat-scoped capture screens (timer, position,
 * reconcile). Center pill opens a bottom sheet to switch heat or
 * mode — operators normally stay in one mode all day (§ single-task
 * enforcement), so mode-switching lives inside the sheet rather than as its
 * own persistent control. Corner arrows jump directly to the adjacent heat.
 */
export function HeatContextBar({
  organizationId,
  leagueId,
  mode,
  modes,
  runHeat,
  heats,
  otherCallRoomHeats = [],
  swim = false,
}: {
  organizationId: number;
  leagueId: number;
  mode: HeatMode;
  /** The modes this Member can use; the others aren't offered. */
  modes: HeatMode[];
  runHeat: number;
  heats: number[];
  /** On a Call room screen: the other side's heats, to switch between run and
   * swim. Empty when the other side has none. */
  otherCallRoomHeats?: number[];
  /** The swim Call room: `runHeat` and `heats` are swim heats, and there
   * is no other mode for a swim heat to switch to. */
  swim?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const league = { organizationId, leagueId };
  const otherSideHeat = counterpartHeat(runHeat, otherCallRoomHeats);
  // Reconcile and League settings are both from Official up, and modes is
  // what every heat screen already knows about the Member.
  const canOpenSettings = modes.includes("reconcile");

  const sortedHeats = [...heats].sort((a, b) => a - b);
  const index = sortedHeats.indexOf(runHeat);
  const prevHeat = index > 0 ? sortedHeats[index - 1] : null;
  const nextHeat =
    index >= 0 && index < sortedHeats.length - 1
      ? sortedHeats[index + 1]
      : null;

  function heatHref(heat: number) {
    return leagueAddress(league, swim ? "call-room-swim" : mode, heat);
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 lg:left-60 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <ArrowButton
          direction="prev"
          heat={prevHeat}
          href={prevHeat !== null ? heatHref(prevHeat) : undefined}
        />

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 max-w-xs flex-col items-center rounded-md border border-input bg-background px-4 py-2 text-center shadow-sm active:scale-[0.98]"
        >
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {swim ? "Swim heat" : "Heat"} {runHeat}
          </span>
          <span className="text-xs text-muted-foreground">
            {mode === "call-room"
              ? SCREEN_LABEL[swim ? "call-room-swim" : "call-room"]
              : MODE_LABEL[mode]}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className="top-auto bottom-0 left-0 right-0 max-h-[90dvh] overflow-y-auto max-w-none translate-x-0 translate-y-0 rounded-t-xl rounded-b-none border-b-0 sm:max-w-lg sm:mx-auto data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
        >
          <DialogHeader>
            <DialogTitle>Switch heat</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {otherSideHeat !== null && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  asChild
                  variant={swim ? "outline" : "default"}
                  className="h-11"
                >
                  <Link
                    href={leagueAddress(
                      league,
                      "call-room",
                      swim ? otherSideHeat : runHeat,
                    )}
                    aria-current={swim ? undefined : "page"}
                    onClick={() => setOpen(false)}
                  >
                    <FootprintsIcon aria-hidden />
                    {SCREEN_LABEL["call-room"]}
                  </Link>
                </Button>
                <Button
                  asChild
                  variant={swim ? "default" : "outline"}
                  className="h-11"
                >
                  <Link
                    href={leagueAddress(
                      league,
                      "call-room-swim",
                      swim ? runHeat : otherSideHeat,
                    )}
                    aria-current={swim ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <WavesIcon aria-hidden />
                    {SCREEN_LABEL["call-room-swim"]}
                  </Link>
                </Button>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                {swim ? "Swim heat" : "Heat"}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {sortedHeats.map((heat) => (
                  <Link
                    key={heat}
                    href={heatHref(heat)}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex h-11 items-center justify-center rounded-md border border-input text-base font-semibold tabular-nums hover:bg-accent",
                      heat === runHeat && "border-heat bg-heat/10 text-heat",
                    )}
                  >
                    {heat}
                  </Link>
                ))}
              </div>
            </div>

            {!swim && modes.length > 1 && (
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">
                  Mode
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {modes.map((m) => (
                    <Button
                      key={m}
                      variant={m === mode ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setOpen(false);
                        router.push(leagueAddress(league, m, runHeat));
                      }}
                    >
                      {MODE_LABEL[m]}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid auto-cols-fr grid-flow-col gap-2 border-t pt-4">
              <Button asChild variant="ghost" className="h-11">
                <Link
                  href={`/organizations/${organizationId}`}
                  onClick={() => setOpen(false)}
                >
                  <Building2Icon aria-hidden />
                  Organization
                </Link>
              </Button>
              {canOpenSettings && (
                <Button asChild variant="ghost" className="h-11">
                  <Link
                    href={leagueAddress(league, "settings")}
                    onClick={() => setOpen(false)}
                  >
                    <SettingsIcon aria-hidden />
                    League settings
                  </Link>
                </Button>
              )}
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
      className="h-12 w-12 shrink-0 rounded-full bg-foreground text-background shadow-sm hover:bg-foreground/90"
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
