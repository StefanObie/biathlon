"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { getHeatClosed, putHeatClosed } from "@/lib/offline/heat-closed-store";
import {
  OPEN_HEAT,
  toHeatClosed,
  type HeatClosed,
} from "@/lib/capture/heat-closed";

/**
 * Whether a heat is closed, kept live on every phone (ADR 0001).
 *
 * `remote` is the page's server snapshot of league_race, or undefined when
 * the page couldn't read it — then the last state this phone saw is used.
 * After that, realtime pushes every close and reopen, and each state seen
 * is kept on the phone so a refresh still shows it. `setClosed` lets the screen
 * that closed or reopened the heat show it before the round trip.
 */
export function useHeatClosed(
  leagueId: number,
  runHeat: number,
  remote: HeatClosed | undefined,
): { closed: HeatClosed; setClosed: (closed: HeatClosed) => void } {
  const [closed, setState] = useState<HeatClosed>(remote ?? OPEN_HEAT);
  // Set once anything fresher than the phone's cached copy has arrived, so
  // a slow cache read can't overwrite it.
  const seenFresh = useRef(remote !== undefined);

  const setClosed = useCallback(
    (next: HeatClosed) => {
      seenFresh.current = true;
      setState(next);
      void putHeatClosed(leagueId, runHeat, next);
    },
    [leagueId, runHeat],
  );

  useEffect(() => {
    let cancelled = false;
    if (remote) {
      void putHeatClosed(leagueId, runHeat, remote);
    } else {
      void getHeatClosed(leagueId, runHeat).then((local) => {
        if (!cancelled && local && !seenFresh.current) setState(local);
      });
    }
    return () => {
      cancelled = true;
    };
    // The server snapshot only seeds the state; realtime keeps it current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, runHeat]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Re-read the row whenever the subscription (re)connects, so a close or
    // reopen missed while the phone was offline still lands.
    async function refetch() {
      const { data, error } = await supabase
        .from("league_race")
        .select("closed_at, closed_by")
        .eq("league_id", leagueId)
        .eq("run_heat", runHeat)
        .maybeSingle();
      if (cancelled || error) return;
      setClosed(toHeatClosed(data));
    }

    async function subscribe() {
      // league_race is authenticated-only under RLS; the realtime socket
      // defaults to the anon key and would silently drop every change.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`heat-closed-${leagueId}-${runHeat}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "league_race",
            // Realtime filters take one column, so the heat is checked below.
            filter: `league_id=eq.${leagueId}`,
          },
          (payload) => {
            if (payload.eventType === "DELETE") {
              // Only a Reset of an unclosed heat deletes the row, and a
              // deleted row has no close — the heat is open either way.
              if (payload.old.run_heat === runHeat) setClosed(OPEN_HEAT);
              return;
            }
            if (payload.new.run_heat !== runHeat) return;
            setClosed(
              toHeatClosed({
                closed_at: payload.new.closed_at ?? null,
                closed_by: payload.new.closed_by ?? null,
              }),
            );
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void refetch();
        });
    }

    void subscribe();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [leagueId, runHeat, setClosed]);

  return { closed, setClosed };
}
