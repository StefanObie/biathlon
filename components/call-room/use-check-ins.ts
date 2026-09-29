"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { CheckInFacts } from "@/lib/call-room/call-room";

/**
 * A League's check-ins, kept live so two Callers can work one call room.
 *
 * `remote` is the page's server snapshot. Realtime then pushes every
 * check-in, move and undo, and the list is re-read whenever the
 * subscription (re)connects, so nothing missed while offline is lost.
 * `apply` and `remove` let the screen show its own change before the round
 * trip.
 */
export function useCheckIns(leagueId: number, remote: CheckInFacts[]) {
  const [checkIns, setCheckIns] = useState<CheckInFacts[]>(remote);

  const apply = useCallback((next: CheckInFacts) => {
    setCheckIns((prev) => [
      ...prev.filter((c) => c.athleteNo !== next.athleteNo),
      next,
    ]);
  }, []);

  const remove = useCallback((athleteNo: number) => {
    setCheckIns((prev) => prev.filter((c) => c.athleteNo !== athleteNo));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function refetch() {
      const { data, error } = await supabase
        .from("call_room_check_in")
        .select("athlete_no, run_heat")
        .eq("league_id", leagueId);
      if (cancelled || error) return;
      setCheckIns(
        data.map((c) => ({ athleteNo: c.athlete_no, runHeat: c.run_heat })),
      );
    }

    async function subscribe() {
      // call_room_check_in is authenticated-only under RLS; the realtime
      // socket defaults to the anon key and would silently drop every change.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`call-room-check-ins-${leagueId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "call_room_check_in",
            filter: `league_id=eq.${leagueId}`,
          },
          (payload) => {
            if (payload.eventType === "DELETE") {
              remove(payload.old.athlete_no);
              return;
            }
            apply({
              athleteNo: payload.new.athlete_no,
              runHeat: payload.new.run_heat,
            });
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
  }, [leagueId, apply, remove]);

  return { checkIns, apply, remove };
}
