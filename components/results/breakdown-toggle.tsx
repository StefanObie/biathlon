"use client";

import { useEffect, useState } from "react";

const KEY = "results-breakdown";

// localStorage can throw or be empty (private windows, blocked site data), so
// the page renders correctly, with the breakdown off, without it.
function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function write(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
}

/**
 * Wraps the server-rendered results and shows or hides each row's breakdown
 * line with a data attribute, so the rows themselves stay server components.
 */
export function BreakdownToggle({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    // Read after mount so the server and first client render agree.
    setOn(read());
  }, []);

  return (
    <div data-breakdown={on} className="group/breakdown flex flex-col gap-4">
      <label className="flex items-center gap-2 self-end text-sm">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked);
            write(e.target.checked);
          }}
        />
        Show breakdown
      </label>
      {children}
    </div>
  );
}
