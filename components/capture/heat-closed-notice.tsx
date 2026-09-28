/**
 * Shown on a capture screen while its heat is closed, so the operator knows
 * why the capture controls stopped working.
 */
export function HeatClosedNotice() {
  return (
    <div className="w-full max-w-sm rounded-md border border-input bg-muted p-3 text-center text-sm">
      <p className="font-medium">Heat closed</p>
      <p className="text-muted-foreground">
        Its results are saved. No new captures until an official reopens it on
        the reconcile screen. You can still add notes.
      </p>
    </div>
  );
}
