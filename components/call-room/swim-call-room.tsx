"use client";

import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HeatContextBar } from "@/components/leagues/heat-context-bar";
import { QrScanner } from "@/components/capture/qr-scanner";
import { HeatBanner } from "@/components/capture/heat-banner";
import { useCameraSleep } from "@/components/capture/use-camera-sleep";
import { useSwimCheckIns } from "@/components/call-room/use-check-ins";
import type { HeatMode } from "@/lib/access/roles";
import {
  needsSwimConfirm,
  swimCallRoomState,
  swimCheckIn,
  swimCheckInMessage,
  type SwimCallRoomEntry,
  type SwimCheckInFacts,
} from "@/lib/call-room/swim-call-room";
import { createClient } from "@/lib/supabase/client";
import { parseBibPayload } from "@/lib/scan/payload";

/**
 * The Call room screen for a swim heat. Information only: a swim check-in
 * never sets or refuses a swim result, so there is no Late entry, no
 * Closed heat and nothing for reconciliation to read.
 */
export function SwimCallRoom({
  organizationId,
  leagueId,
  swimHeat,
  modes,
  swimHeats,
  entries,
  remoteCheckIns,
}: {
  organizationId: number;
  leagueId: number;
  swimHeat: number;
  /** The heat screens this Member can switch to. */
  modes: HeatMode[];
  swimHeats: number[];
  /** The whole League's entries, so another swim heat's athlete is recognised. */
  entries: SwimCallRoomEntry[];
  remoteCheckIns: SwimCheckInFacts[];
}) {
  const [athleteNoInput, setAthleteNoInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    athlete: SwimCallRoomEntry;
    message: string;
  } | null>(null);
  const { checkIns, apply, remove } = useSwimCheckIns(leagueId, remoteCheckIns);
  const camera = useCameraSleep();

  const { roster, checkedIn, rosterSize, fromOtherHeats } = swimCallRoomState(
    swimHeat,
    entries,
    checkIns,
  );

  // Writes the check-in here: a new row, or a move when the athlete is
  // checked in at another swim heat. Never touches the swim slot.
  async function record(athlete: SwimCallRoomEntry): Promise<string | null> {
    const { athleteNo, fullName } = athlete;
    const supabase = createClient();
    const moving = checkIns.some((c) => c.athleteNo === athleteNo);
    const { error } = moving
      ? await supabase
          .from("swim_call_room_check_in")
          .update({ swim_heat: swimHeat })
          .eq("league_id", leagueId)
          .eq("athlete_no", athleteNo)
      : await supabase.from("swim_call_room_check_in").insert({
          league_id: leagueId,
          athlete_no: athleteNo,
          swim_heat: swimHeat,
        });
    if (error) {
      // Another Caller may have checked them in a moment ago.
      return error.code === "23505"
        ? `#${athleteNo} ${fullName} is already checked in.`
        : error.message;
    }
    apply({ athleteNo, swimHeat });
    toast.success(`Checked in: #${athleteNo} ${fullName}`);
    return null;
  }

  // Shared by manual entry and QR scan. Returns an error message on
  // failure so each caller can surface it its own way.
  async function submit(athleteNo: number): Promise<string | null> {
    const outcome = swimCheckIn(athleteNo, swimHeat, entries, checkIns);
    const message = swimCheckInMessage(outcome, swimHeat);
    if (outcome.kind === "unknown") return message;
    camera.markUsed();
    if (outcome.kind === "already-here") {
      toast(message);
      return null;
    }
    if (needsSwimConfirm(outcome)) {
      // Cancelling the dialog changes nothing.
      setPending({ athlete: outcome.athlete, message });
      return null;
    }
    return record(outcome.athlete);
  }

  async function handleConfirm() {
    if (!pending) return;
    const { athlete } = pending;
    setPending(null);
    const error = await record(athlete);
    if (error) toast.error(error);
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

  async function handleUndo(athlete: SwimCallRoomEntry) {
    const { error } = await createClient()
      .from("swim_call_room_check_in")
      .delete()
      .eq("league_id", leagueId)
      .eq("athlete_no", athlete.athleteNo);
    if (error) {
      toast.error(error.message);
      return;
    }
    remove(athlete.athleteNo);
    toast.success(`Undone: #${athlete.athleteNo} ${athlete.fullName}`);
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <HeatBanner
        runHeat={swimHeat}
        closed={false}
        screen="Call room"
        heatLabel="Swim heat"
      />

      <p className="text-4xl font-bold tabular-nums">
        {checkedIn} / {rosterSize}{" "}
        <span className="text-lg font-medium text-muted-foreground">
          checked in
        </span>
        {fromOtherHeats > 0 && (
          <span className="ml-2 text-lg font-medium text-muted-foreground">
            +{fromOtherHeats} from other heats
          </span>
        )}
      </p>

      <QrScanner
        onDetect={(text) => void handleScanDetect(text)}
        paused={pending !== null}
        awake={camera.awake}
        onWake={camera.wake}
      />

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
          className="h-16 rounded-md border border-input px-4 text-center text-2xl tabular-nums"
        />
        {inputError && <p className="text-sm text-destructive">{inputError}</p>}
        <Button
          size="lg"
          className="h-16 text-xl"
          onClick={() => void handleManualSubmit()}
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
              <span className="w-14 text-muted-foreground">
                Lane {athlete.swimLane}
              </span>
              <span className={athlete.checkedIn ? "" : "font-medium"}>
                #{athlete.athleteNo} {athlete.fullName}
              </span>
            </span>
            {athlete.checkedIn && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleUndo(athlete)}
              >
                Undo
              </Button>
            )}
          </li>
        ))}
      </ul>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Check in at swim heat {swimHeat}?
            </AlertDialogTitle>
            <AlertDialogDescription>{pending?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirm()}>
              Check in here
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <HeatContextBar
        organizationId={organizationId}
        leagueId={leagueId}
        mode="call-room"
        modes={modes}
        runHeat={swimHeat}
        heats={swimHeats}
        swim
      />
    </div>
  );
}
