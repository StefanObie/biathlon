import { cn } from "@/lib/utils";

/**
 * The Call room's count on the Capture screens, e.g. "Checked in 14 / 20",
 * set beside the finished count. Advice only: it never limits a capture.
 */
export function CheckedInCount({
  checkedIn,
  rosterSize,
  className,
}: {
  checkedIn: number;
  rosterSize: number;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-sm font-medium tabular-nums text-muted-foreground",
        className,
      )}
    >
      Checked in {checkedIn} / {rosterSize}
    </p>
  );
}
