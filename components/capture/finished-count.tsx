import { cn } from "@/lib/utils";

/**
 * The finished count both capture screens show, e.g. "Finished 12 / 20",
 * highlighted as a warning once it goes over the heat roster size.
 */
export function FinishedCount({
  finished,
  rosterSize,
  overRoster,
  className,
}: {
  finished: number;
  rosterSize: number;
  overRoster: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-sm font-medium tabular-nums",
        overRoster
          ? "text-amber-600 dark:text-amber-500"
          : "text-muted-foreground",
        className,
      )}
    >
      Finished {finished} / {rosterSize}
    </p>
  );
}
