import { cn } from "@/lib/utils";

/**
 * Names the heat at the top of a capture screen, so operators don't record
 * against the wrong one (#15). Coloured and boxed, so it reads as a label and
 * not as the Position screen's position number; muted once the heat is
 * closed.
 */
export function HeatBanner({
  runHeat,
  closed,
  screen,
}: {
  runHeat: number;
  closed: boolean;
  /** Names the screen ahead of the heat ("CALL ROOM · Heat 3"), for
   * screens that could be mistaken for one another. */
  screen?: string;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-md px-4 py-3 text-center text-4xl font-bold uppercase tracking-wide tabular-nums",
        closed
          ? "bg-muted text-muted-foreground"
          : "bg-blue-700 text-white dark:bg-blue-600",
      )}
    >
      {/* Unbroken halves, so a narrow phone wraps between them rather than
          splitting "Heat" from its number. */}
      {screen && (
        <>
          <span className="whitespace-nowrap">{screen} ·</span>{" "}
        </>
      )}
      <span className="whitespace-nowrap">Heat {runHeat}</span>
      {closed && (
        <>
          {" "}
          <span className="whitespace-nowrap">· Closed</span>
        </>
      )}
    </div>
  );
}
