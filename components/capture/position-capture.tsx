"use client";

import { useEffect, useMemo, useState } from "react";
import { ulid } from "ulid";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HeatContextBar } from "@/components/leagues/heat-context-bar";
import type { HeatMode } from "@/lib/access/roles";
import { captureScreenState, heatRosterSize } from "@/lib/capture/screen-state";
import { getDeviceId } from "@/lib/offline/device-id";
import { parseBibPayload } from "@/lib/scan/payload";
import {
  FILLED,
  needsConfirm,
  nextPosition,
  positionRowAction,
  scanOutcome,
  scanOutcomeMessage,
  type LeagueRosterAthlete,
  type OrganizationAthlete,
  type ConfirmScanOutcome,
  type PositionRowAction,
} from "@/lib/scan/position";
import { QrScanner } from "@/components/capture/qr-scanner";
import { FinishedCount } from "@/components/capture/finished-count";
import { OperatorNotes } from "@/components/capture/operator-notes";
import { HeatBanner } from "@/components/capture/heat-banner";
import { HeatClosedNotice } from "@/components/capture/heat-closed-notice";
import { useHeatClosed } from "@/components/capture/use-heat-closed";
import { useCameraSleep } from "@/components/capture/use-camera-sleep";
import type { HeatClosed } from "@/lib/capture/heat-closed";
import { noteAnchor } from "@/lib/capture/operator-note";
import {
  getCapturesForHeat,
  putCapture,
  startSyncSweep,
  syncPendingCaptures,
  voidCapture,
  type LocalPositionCapture,
} from "@/lib/offline/position-capture-queue";

export interface RemoteCapture {
  id: string;
  position: number;
  athlete_no: number | null;
  voided: boolean;
  void_reason: string | null;
  scanned_at: string;
  device_id: string;
}

export function PositionCapture({
  organizationId,
  leagueId,
  runHeat,
  modes,
  heats,
  leagueRoster,
  athletes,
  remoteCaptures,
  remoteHeatClosed,
}: {
  organizationId: number;
  leagueId: number;
  runHeat: number;
  /** The heat screens this Member can switch to. */
  modes: HeatMode[];
  heats: number[];
  leagueRoster: LeagueRosterAthlete[];
  /** Every athlete of the Organization, so any of them can be captured. */
  athletes: OrganizationAthlete[];
  remoteCaptures: RemoteCapture[];
  /** Undefined when the page couldn't read it; the phone's copy is used. */
  remoteHeatClosed: HeatClosed | undefined;
}) {
  const [captures, setCaptures] = useState<LocalPositionCapture[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [athleteNoInput, setAthleteNoInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] =
    useState<ConfirmScanOutcome | null>(null);
  const [pendingUndo, setPendingUndo] = useState<{
    capture: LocalPositionCapture;
    fill: boolean;
  } | null>(null);
  // The Skip being filled: the next athlete is captured at its position
  // instead of the next one.
  const [armedSkip, setArmedSkip] = useState<LocalPositionCapture | null>(null);
  const { closed } = useHeatClosed(leagueId, runHeat, remoteHeatClosed);
  const camera = useCameraSleep();

  // Names for the captured list, including athletes not on the Start list.
  const nameByNo = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of athletes) map.set(a.athleteNo, a.fullName);
    for (const a of leagueRoster) map.set(a.athleteNo, a.fullName);
    return map;
  }, [athletes, leagueRoster]);

  // Load Dexie rows first (unsynced local state wins on conflict with the
  // server snapshot passed down from the page — same id, local is either
  // identical or a not-yet-synced edit), merging in any remote-only rows.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const local = await getCapturesForHeat(leagueId, runHeat);
      const localIds = new Set(local.map((c) => c.id));
      const remoteOnly: LocalPositionCapture[] = remoteCaptures
        .filter((c) => !localIds.has(c.id))
        .map((c) => ({
          ...c,
          league_id: leagueId,
          run_heat: runHeat,
          synced: true,
        }));

      for (const row of remoteOnly) {
        await putCapture(row);
      }

      if (cancelled) return;
      setCaptures([...local, ...remoteOnly]);
      setLoaded(true);
    }

    void load();
    const stopSweep = startSyncSweep();
    return () => {
      cancelled = true;
      stopSweep();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, runHeat]);

  const activePositions = captures
    .filter((c) => !c.voided)
    .map((c) => c.position);
  const position = nextPosition(activePositions);
  const allCaptures = [...captures]
    .filter((c) => !c.voided)
    .sort((a, b) => b.position - a.position);
  // The roster is this heat's slice of the league roster; athletes scanned
  // from another heat count as finishers but not towards the total.
  const rosterSize = heatRosterSize(
    leagueRoster.map((a) => a.runHeat),
    runHeat,
  );
  const { finished, overRoster, locked } = captureScreenState({
    captures,
    rosterSize,
    closedAt: closed.closedAt,
    startedAtMs: null,
  });

  // A heat closing disarms a Fill, so a later reopen can't silently send
  // the next scan to an old position.
  if (locked && armedSkip) setArmedSkip(null);
  const filling = locked ? null : armedSkip;

  function newCapture(
    atPosition: number,
    athleteNo: number | null,
  ): LocalPositionCapture {
    return {
      id: ulid(),
      league_id: leagueId,
      run_heat: runHeat,
      position: atPosition,
      athlete_no: athleteNo,
      device_id: getDeviceId(),
      scanned_at: new Date().toISOString(),
      voided: false,
      void_reason: null,
      synced: false,
    };
  }

  // Voids one capture and records another at the same position, as a Fill
  // or an Undo fill does. Captures are never edited (§1).
  async function replaceCapture(
    old: LocalPositionCapture,
    voidReason: string,
    athleteNo: number | null,
  ) {
    const row = newCapture(old.position, athleteNo);
    await voidCapture(old.id, voidReason);
    await putCapture(row);
    setCaptures((prev) => [
      ...prev.map((c) =>
        c.id === old.id
          ? { ...c, voided: true, void_reason: voidReason, synced: false }
          : c,
      ),
      row,
    ]);
    void syncPendingCaptures();
  }

  async function recordCapture(athleteNo: number | null) {
    if (locked) return;
    if (filling && athleteNo !== null) {
      setArmedSkip(null);
      await replaceCapture(filling, FILLED, athleteNo);
      toast.success(`Position #${filling.position} filled`);
      return;
    }
    const row = newCapture(position, athleteNo);
    await putCapture(row);
    setCaptures((prev) => [...prev, row]);
    void syncPendingCaptures();
  }

  // Shared by manual entry and QR scan: records the capture, routes it
  // through a confirmation, or refuses it. Returns an error message on
  // refusal so each caller can surface it its own way (inline field error
  // vs. toast).
  async function resolveAndRecord(athleteNo: number): Promise<string | null> {
    const outcome = scanOutcome(
      athleteNo,
      runHeat,
      leagueRoster,
      athletes,
      captures,
    );
    const error = scanOutcomeMessage(outcome);
    if (error) return error;
    // Only an accepted athlete keeps the camera awake: a rejected bib left
    // in frame is re-read every couple of seconds and would never let it
    // sleep.
    camera.markUsed();
    if (needsConfirm(outcome)) {
      // Confirm before logging — the mismatch itself is resolved later in
      // reconciliation, this screen just shouldn't lose the capture.
      setPendingConfirm(outcome);
    } else {
      await recordCapture(athleteNo);
    }
    return null;
  }

  async function handleManualSubmit() {
    setInputError(null);
    const athleteNo = Number(athleteNoInput.trim());
    if (!Number.isInteger(athleteNo)) {
      setInputError("Enter a valid athlete number.");
      return;
    }
    const error = await resolveAndRecord(athleteNo);
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
    const error = await resolveAndRecord(athleteNo);
    if (error) toast.error(error);
  }

  async function confirmCapture() {
    if (!pendingConfirm) return;
    await recordCapture(pendingConfirm.athlete.athleteNo);
    setPendingConfirm(null);
    setAthleteNoInput("");
  }

  async function handleSkip() {
    await recordCapture(null);
  }

  // Only the highest active position can be undone at a time — voiding a
  // middle position while later ones stay active would break the
  // contiguous counter. Undoing the top one makes the next-highest
  // available, one at a time (deliberate friction against careless undo).
  async function handleUndoTop(capture: LocalPositionCapture) {
    if (locked) return;
    await voidCapture(capture.id, "operator undo");
    setCaptures((prev) =>
      prev.map((c) =>
        c.id === capture.id
          ? { ...c, voided: true, void_reason: "operator undo", synced: false }
          : c,
      ),
    );
    void syncPendingCaptures();
    setPendingUndo(null);
    toast.success("Capture undone");
  }

  // Turns a Fill back into a Skip, so a wrongly filled athlete can be
  // scanned where they belong.
  async function handleUndoFill(capture: LocalPositionCapture) {
    if (locked) return;
    await replaceCapture(capture, "fill undone", null);
    setPendingUndo(null);
    toast.success(`Position #${capture.position} is a Skip again`);
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <HeatBanner runHeat={runHeat} closed={locked} screen="Position" />

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {filling ? "Filling position" : "Position"}
        </p>
        <p
          className={`text-8xl font-bold tabular-nums ${filling ? "text-amber-600" : ""}`}
        >
          {!loaded ? "—" : filling ? `#${filling.position}` : position}
        </p>
      </div>

      {filling && (
        <div className="flex w-full max-w-sm items-center justify-between gap-3 rounded-md border-2 border-amber-500 bg-amber-50 px-4 py-3 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-semibold">
            Filling #{filling.position}: the next athlete goes here
          </p>
          <Button variant="outline" onClick={() => setArmedSkip(null)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Unmounted, not paused, so the camera turns off on a closed heat. */}
      {locked ? (
        <HeatClosedNotice />
      ) : (
        <QrScanner
          onDetect={(text) => void handleScanDetect(text)}
          paused={pendingConfirm !== null}
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
          disabled={!loaded || locked}
          suppressHydrationWarning
        >
          Record
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14 text-lg"
          onClick={() => void handleSkip()}
          disabled={!loaded || locked || filling !== null}
          suppressHydrationWarning
        >
          Skip
        </Button>
      </div>

      <div className="w-full max-w-sm">
        <FinishedCount
          finished={finished}
          rosterSize={rosterSize}
          overRoster={overRoster}
          className="mb-2"
        />
        <ul className="flex flex-col gap-1">
          {allCaptures.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm"
            >
              <span className="tabular-nums">
                #{c.position}{" "}
                {c.athlete_no
                  ? `${c.athlete_no} ${nameByNo.get(c.athlete_no) ?? ""}`
                  : "skip"}
              </span>
              <RowActionButton
                action={positionRowAction(captures, c)}
                armed={filling?.id === c.id}
                disabled={locked}
                onUndo={() => setPendingUndo({ capture: c, fill: false })}
                onFill={() => setArmedSkip(c)}
                onUndoFill={() => setPendingUndo({ capture: c, fill: true })}
              />
            </li>
          ))}
          {allCaptures.length === 0 && (
            <li className="text-sm text-muted-foreground">No captures yet.</li>
          )}
        </ul>
      </div>

      <OperatorNotes
        leagueId={leagueId}
        runHeat={runHeat}
        screen="position"
        anchor={noteAnchor(activePositions)}
      />

      <Dialog
        open={pendingConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setPendingConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingConfirm?.kind === "not-on-start-list"
                ? "Athlete not on the Start list"
                : "Athlete not in this heat"}
            </DialogTitle>
            <DialogDescription>
              {pendingConfirm?.kind === "other-heat" && (
                <>
                  {pendingConfirm.athlete.athleteNo}{" "}
                  {pendingConfirm.athlete.fullName} is assigned to run heat{" "}
                  {pendingConfirm.athlete.runHeat}, not heat {runHeat}. Log the
                  capture anyway? The mismatch will need to be resolved during
                  reconciliation.
                </>
              )}
              {pendingConfirm?.kind === "not-on-start-list" && (
                <>
                  {pendingConfirm.athlete.athleteNo}{" "}
                  {pendingConfirm.athlete.fullName} is not on this league&apos;s
                  Start list. Log the capture anyway? An Official will add them
                  as a Late entry during reconciliation.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingConfirm(null)}>
              Cancel
            </Button>
            <Button onClick={() => void confirmCapture()} disabled={locked}>
              Log capture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingUndo !== null}
        onOpenChange={(open) => {
          if (!open) setPendingUndo(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingUndo?.fill ? "Undo this Fill?" : "Undo this capture?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingUndo && (
                <>
                  Position #{pendingUndo.capture.position}
                  {pendingUndo.capture.athlete_no
                    ? ` — ${pendingUndo.capture.athlete_no} ${nameByNo.get(pendingUndo.capture.athlete_no) ?? ""}`
                    : " — skip"}{" "}
                  {pendingUndo.fill
                    ? "will become a Skip again."
                    : "will be voided."}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingUndo) return;
                if (pendingUndo.fill) void handleUndoFill(pendingUndo.capture);
                else void handleUndoTop(pendingUndo.capture);
              }}
              disabled={locked}
            >
              Undo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <HeatContextBar
        organizationId={organizationId}
        leagueId={leagueId}
        mode="position"
        modes={modes}
        runHeat={runHeat}
        heats={heats}
      />
    </div>
  );
}

function RowActionButton({
  action,
  armed,
  disabled,
  onUndo,
  onFill,
  onUndoFill,
}: {
  action: PositionRowAction | null;
  armed: boolean;
  disabled: boolean;
  onUndo: () => void;
  onFill: () => void;
  onUndoFill: () => void;
}) {
  if (action === null) return null;
  const { label, onClick } = {
    undo: { label: "Undo", onClick: onUndo },
    fill: { label: armed ? "Filling…" : "Fill", onClick: onFill },
    "undo-fill": { label: "Undo fill", onClick: onUndoFill },
  }[action];
  return (
    <Button
      variant={action === "fill" ? "outline" : "ghost"}
      size="sm"
      onClick={onClick}
      disabled={disabled || armed}
    >
      {label}
    </Button>
  );
}
