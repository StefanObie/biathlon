"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { CheckInFacts } from "@/lib/call-room/call-room";
import type { SwimCheckInFacts } from "@/lib/call-room/swim-call-room";

type Tables = Database["public"]["Tables"];
type RunRow = Tables["call_room_check_in"]["Row"];
type SwimRow = Tables["swim_call_room_check_in"]["Row"];

// Module-level, so the hook's effect sees one stable mapper per table.
const runFacts = (row: RunRow): CheckInFacts => ({
  athleteNo: row.athlete_no,
  runHeat: row.run_heat,
});
const swimFacts = (row: SwimRow): SwimCheckInFacts => ({
  athleteNo: row.athlete_no,
  swimHeat: row.swim_heat,
});

/**
 * A League's run check-ins, kept live so two Callers can work one call
 * room, and so the Capture screens show check-ins as they happen.
 */
export function useCheckIns(leagueId: number, remote: CheckInFacts[]) {
  return useLiveCheckIns(leagueId, remote, "call_room_check_in", runFacts);
}

/** A League's swim check-ins, kept live like the run ones. */
export function useSwimCheckIns(leagueId: number, remote: SwimCheckInFacts[]) {
  return useLiveCheckIns(
    leagueId,
    remote,
    "swim_call_room_check_in",
    swimFacts,
  );
}

/**
 * `remote` is the page's server snapshot. Realtime then pushes every
 * check-in, move and undo, and the list is re-read whenever the
 * subscription (re)connects, so nothing missed while offline is lost.
 * `apply` and `remove` let the screen show its own change before the round
 * trip.
 */
function useLiveCheckIns<
  Row extends RunRow | SwimRow,
  F extends { athleteNo: number },
>(
  leagueId: number,
  remote: F[],
  table: "call_room_check_in" | "swim_call_room_check_in",
  toFacts: (row: Row) => F,
) {
  const [checkIns, setCheckIns] = useState<F[]>(remote);

  const apply = useCallback((next: F) => {
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
        .from(table)
        .select("*")
        .eq("league_id", leagueId);
      if (cancelled || error) return;
      setCheckIns((data as Row[]).map(toFacts));
    }

    async function subscribe() {
      // Check-ins are authenticated-only under RLS; the realtime socket
      // defaults to the anon key and would silently drop every change.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`${table}-${leagueId}`)
        .on<Row>(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `league_id=eq.${leagueId}`,
          },
          (payload) => {
            if (payload.eventType === "DELETE") {
              if (payload.old.athlete_no !== undefined) {
                remove(payload.old.athlete_no);
              }
              return;
            }
            apply(toFacts(payload.new));
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
  }, [leagueId, table, toFacts, apply, remove]);

  return { checkIns, apply, remove };
}
