"use client";

import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { HeatContextBar } from "@/components/leagues/heat-context-bar";
import { QrScanner } from "@/components/capture/qr-scanner";
import { HeatBanner } from "@/components/capture/heat-banner";
import { HeatClosedNotice } from "@/components/capture/heat-closed-notice";
import { useHeatClosed } from "@/components/capture/use-heat-closed";
import { useCameraSleep } from "@/components/capture/use-camera-sleep";
import { useCheckIns } from "@/components/call-room/use-check-ins";
import type { HeatMode } from "@/lib/access/roles";
import {
  callRoomState,
  checkIn,
  checkInMessage,
  type CallRoomEntry,
  type CheckInFacts,
} from "@/lib/call-room/call-room";
import type { HeatClosed } from "@/lib/capture/heat-closed";
import { createClient } from "@/lib/supabase/client";
import { parseBibPayload } from "@/lib/scan/payload";

const CLOSED_MESSAGE = "This heat is closed. Check-ins can't be changed.";

export function CallRoom({
  leagueId,
  leagueName,
  runHeat,
  modes,
  heats,
  entries,
  remoteCheckIns,
  remoteHeatClosed,
}: {
  leagueId: number;
  leagueName: string;
  runHeat: number;
  /** The heat screens this Member can switch to. */
  modes: HeatMode[];
  heats: number[];
  /** The whole League's entries, so another heat's athlete is recognised. */
  entries: CallRoomEntry[];
  remoteCheckIns: CheckInFacts[];
  /** Undefined when the page couldn't read it; the phone's copy is used. */
  remoteHeatClosed: HeatClosed | undefined;
}) {
  const [athleteNoInput, setAthleteNoInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const { closed } = useHeatClosed(leagueId, runHeat, remoteHeatClosed);
  const { checkIns, apply, remove } = useCheckIns(leagueId, remoteCheckIns);
  const camera = useCameraSleep();
  const locked = closed.closedAt !== null;

  const { roster, checkedIn, rosterSize } = callRoomState(
    runHeat,
    entries,
    checkIns,
  );

  // Shared by manual entry and QR scan. Returns an error message on
  // failure so each caller can surface it its own way (inline field error
  // vs. toast).
  async function submit(athleteNo: number): Promise<string | null> {
    if (locked) return CLOSED_MESSAGE;
    const outcome = checkIn(athleteNo, runHeat, entries, checkIns);
    const message = checkInMessage(outcome, runHeat);
    if (outcome.kind === "already-here") {
      camera.markUsed();
      toast(message);
      return null;
    }
    if (outcome.kind !== "checked-in") return message;

    camera.markUsed();
    const { error } = await createClient().from("call_room_check_in").insert({
      league_id: leagueId,
      athlete_no: athleteNo,
      run_heat: runHeat,
    });
    if (error) {
      // Another Caller may have checked them in a moment ago.
      return error.code === "23505"
        ? `#${athleteNo} ${outcome.athlete.fullName} is already checked in.`
        : error.message;
    }
    apply({ athleteNo, runHeat });
    toast.success(message);
    return null;
  }

  async function handleManualSubmit() {
    setInputError(null);
    const athleteNo = Number(athleteNoInput.trim());
    if (!athleteNoInput.trim() || !Number.isInteger(athleteNo)) {
      setInputError("Enter a valid athlete number.");
      return;
    }
    const error = await submit(athleteNo);
    if (error) {
      setInputError(error);
      return;
    }
    setAthleteNoInput("");
  }

  async function handleScanDetect(text: string) {
    const athleteNo = parseBibPayload(text);
    if (athleteNo === null) {
      toast.error("Not a bib QR code");
      return;
    }
    const error = await submit(athleteNo);
    if (error) toast.error(error);
  }

  async function handleUndo(athlete: CallRoomEntry) {
    if (locked) return;
    const { data, error } = await createClient()
      .from("call_room_check_in")
      .delete()
      .eq("league_id", leagueId)
      .eq("athlete_no", athlete.athleteNo)
      .select("athlete_no");
    if (error) {
      toast.error(error.message);
      return;
    }
    // A closed heat's rows are hidden from delete rather than refused.
    if (data.length === 0) {
      toast.error(CLOSED_MESSAGE);
      return;
    }
    remove(athlete.athleteNo);
    toast.success(`Undone: #${athlete.athleteNo} ${athlete.fullName}`);
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <HeatBanner runHeat={runHeat} closed={locked} screen="Call room" />

      <p className="text-4xl font-bold tabular-nums">
        {checkedIn} / {rosterSize}{" "}
        <span className="text-lg font-medium text-muted-foreground">
          checked in
        </span>
      </p>

      {/* Unmounted, not paused, so the camera turns off on a closed heat. */}
      {locked ? (
        <HeatClosedNotice>
          Check-ins are read-only until an official reopens it on the reconcile
          screen.
        </HeatClosedNotice>
      ) : (
        <QrScanner
          onDetect={(text) => void handleScanDetect(text)}
          paused={false}
          awake={camera.awake}
          onWake={camera.wake}
        />
      )}

      <div className="flex w-full max-w-sm flex-col gap-2">
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={athleteNoInput}
          onChange={(e) => setAthleteNoInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleManualSubmit();
          }}
          placeholder="Athlete number"
          disabled={locked}
          className="h-16 rounded-md border border-input px-4 text-center text-2xl tabular-nums"
        />
        {inputError && <p className="text-sm text-destructive">{inputError}</p>}
        <Button
          size="lg"
          className="h-16 text-xl"
          onClick={() => void handleManualSubmit()}
          disabled={locked}
          suppressHydrationWarning
        >
          Check in
        </Button>
      </div>

      <ul className="flex w-full max-w-sm flex-col gap-1">
        {roster.map((athlete) => (
          <li
            key={athlete.athleteNo}
            className="flex items-center justify-between gap-2 rounded-md border border-input px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-2 tabular-nums">
              {athlete.checkedIn ? (
                <CheckIcon
                  className="h-4 w-4 text-green-600"
                  aria-label="Checked in"
                />
              ) : (
                <span className="h-4 w-4" aria-hidden />
              )}
              <span className={athlete.checkedIn ? "" : "font-medium"}>
                #{athlete.athleteNo} {athlete.fullName}
              </span>
            </span>
            {athlete.checkedIn && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleUndo(athlete)}
                disabled={locked}
              >
                Undo
              </Button>
            )}
          </li>
        ))}
      </ul>

      <HeatContextBar
        leagueId={leagueId}
        leagueName={leagueName}
        mode="call-room"
        modes={modes}
        runHeat={runHeat}
        heats={heats}
      />
    </div>
  );
}
