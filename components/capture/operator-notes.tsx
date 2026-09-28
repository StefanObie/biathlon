"use client";

import { useEffect, useState } from "react";
import { StickyNote } from "lucide-react";
import { toast } from "sonner";
import { ulid } from "ulid";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  describeAnchor,
  type CaptureScreen,
} from "@/lib/capture/operator-note";
import { getDeviceId } from "@/lib/offline/device-id";
import {
  putNote,
  startNoteSyncSweep,
  syncPendingNotes,
  type LocalOperatorNote,
} from "@/lib/offline/operator-note-queue";

/**
 * The notes control both capture screens carry: a button that opens a
 * free-text note, tied to the screen's current `anchor` — the seq or
 * position of its latest active capture, 0 before the first one.
 *
 * Notes are add-only. There is no edit or delete affordance here because
 * there is no edit or delete at all — an operator who got a note wrong
 * writes another one, and reconciliation reads both in order.
 */
export function OperatorNotes({
  leagueId,
  runHeat,
  screen,
  anchor,
}: {
  leagueId: number;
  runHeat: number;
  screen: CaptureScreen;
  anchor: number;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => startNoteSyncSweep(), []);

  async function handleSave() {
    const text = body.trim();
    if (text === "") return;
    setSaving(true);
    try {
      const row: LocalOperatorNote = {
        id: ulid(),
        league_id: leagueId,
        run_heat: runHeat,
        anchor,
        screen,
        body: text,
        device_id: getDeviceId(),
        created_at: new Date().toISOString(),
        synced: false,
      };
      // Dexie first, then the network — a note written with no signal is
      // already safe by the time the dialog closes (§6.6).
      await putNote(row);
      void syncPendingNotes();
      setBody("");
      setOpen(false);
      toast.success(`Note saved at ${describeAnchor(screen, anchor)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        className="h-12 w-full max-w-sm text-base"
        onClick={() => setOpen(true)}
        suppressHydrationWarning
      >
        <StickyNote className="mr-2 size-4" />
        Add note
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setBody("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a note</DialogTitle>
            <DialogDescription>
              This note will be tied to {describeAnchor(screen, anchor)}. Notes
              can&rsquo;t be edited or deleted; to correct one, add another.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            autoFocus
            placeholder="What happened?"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={saving || body.trim() === ""}
            >
              {saving ? "Saving…" : "Save note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
