"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The thin strip between two reconciliation rows (and above the first/below
 * the last) that inserts a gap at that exact position. Hover reveals it on
 * mouse devices; tapping the strip reveals it on touch (no hover state
 * there) — same control, two ways to open it, per the touch-parity
 * requirement operators on tablets need.
 */
export function RowInsertDivider({ onInsert }: { onInsert: () => void }) {
  const [tapped, setTapped] = useState(false);

  return (
    <tr className="group/divider" onClick={() => setTapped((prev) => !prev)}>
      <td colSpan={5} className="p-0">
        <div className="relative h-2">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-transparent group-hover/divider:bg-border" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setTapped(false);
              onInsert();
            }}
            className={cn(
              "absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-input bg-background px-2 py-0.5 text-xs text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-accent hover:text-accent-foreground group-hover/divider:opacity-100 focus-visible:opacity-100",
              tapped && "opacity-100",
            )}
          >
            <PlusIcon className="size-3" />
            Insert gap
          </button>
        </div>
      </td>
    </tr>
  );
}
