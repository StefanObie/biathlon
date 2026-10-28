"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LeagueRef } from "@/lib/leagues/address";
import type { MedalGroup, MedalPlace } from "@/lib/medals/board";
import {
  clearMedalsPresented,
  markMedalsPresented,
} from "@/lib/medals/actions";

const MEDAL: Record<MedalPlace, string> = {
  1: "Gold",
  2: "Silver",
  3: "Bronze",
};

const presentedTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Johannesburg",
  });

/**
 * Every group's podium with its Medals presented mark. It doesn't update
 * live: the Official refreshes it to see results that landed since.
 */
export function MedalsBoard({
  league,
  groups,
}: {
  league: LeagueRef;
  groups: MedalGroup[];
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Medals</h1>
        <Button
          variant="outline"
          size="sm"
          disabled={isRefreshing}
          onClick={() => startRefresh(() => router.refresh())}
        >
          <RefreshCwIcon
            className={isRefreshing ? "animate-spin" : undefined}
          />
          Refresh
        </Button>
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No group has results yet.
        </p>
      ) : (
        groups.map((group) => (
          <MedalGroupCard
            key={`${group.gender}/${group.age_group_code}`}
            league={league}
            group={group}
          />
        ))
      )}
    </div>
  );
}

function MedalGroupCard({
  league,
  group,
}: {
  league: LeagueRef;
  group: MedalGroup;
}) {
  const [isPending, startTransition] = useTransition();
  const { presentation } = group;

  const run = (action: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const { error } = await action();
      if (error) toast.error(error);
    });

  const mark = () =>
    run(() =>
      markMedalsPresented(
        league,
        group.gender,
        group.age_group_code,
        group.podium,
      ),
    );
  const clear = () =>
    run(() => clearMedalsPresented(league, group.gender, group.age_group_code));

  return (
    <section className="flex flex-col gap-3 rounded-md border border-input p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{group.title}</h2>
        {presentation.state === "presented" && (
          <Badge variant="secondary">
            Presented {presentedTime(presentation.presented_at)}
          </Badge>
        )}
      </div>

      {group.podium.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No athlete has both a run and a swim time yet.
        </p>
      ) : (
        <ol className="flex flex-col gap-1">
          {group.podium.map((athlete) => (
            <li
              key={athlete.athlete_no}
              className="flex items-baseline justify-between gap-3"
            >
              <span>
                <span className="inline-block w-16 font-medium">
                  {MEDAL[athlete.medal_place]}
                </span>
                {athlete.full_name}{" "}
                <span className="text-sm text-muted-foreground">
                  #{athlete.athlete_no}
                </span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {athlete.total_points.toFixed(2)}
              </span>
            </li>
          ))}
        </ol>
      )}

      {group.missing > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {group.missing} {group.missing === 1 ? "athlete" : "athletes"} still
          missing a time
        </p>
      )}

      {presentation.state === "changed" && (
        <p className="text-sm font-medium text-destructive">
          Podium changed since medals were presented
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {presentation.state !== "presented" && (
          <Button
            size="sm"
            disabled={isPending || group.podium.length === 0}
            onClick={mark}
          >
            {presentation.state === "changed"
              ? "Mark presented again"
              : "Mark medals presented"}
          </Button>
        )}
        {presentation.state !== "not-presented" && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={clear}
          >
            {presentation.state === "changed" ? "Clear mark" : "Undo"}
          </Button>
        )}
      </div>
    </section>
  );
}
