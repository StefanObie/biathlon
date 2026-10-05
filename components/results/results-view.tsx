"use client";

import { useEffect, useState } from "react";

import {
  filterGroups,
  type Gender,
  type ResultsGroup,
  type ShapedAthlete,
} from "@/lib/results/shape";
import { cn } from "@/lib/utils";

const KEY = "results-breakdown";

// localStorage can throw or be empty (private windows, blocked site data), so
// the page renders correctly, with the breakdown off, without it.
function readBreakdown(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function writeBreakdown(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
}

const points = (value: number | null) =>
  value === null ? "—" : value.toFixed(2);

const GENDERS: { value: Gender; label: string }[] = [
  { value: "F", label: "Girls/Ladies" },
  { value: "M", label: "Boys/Men" },
];

const chip = "shrink-0 rounded-full border px-3 py-1 text-sm whitespace-nowrap";
const chipActive = "border-primary bg-primary text-primary-foreground";

/**
 * The gender and age group switches and the results under them. All the
 * shaped groups arrive once, so switching is a local state change with no
 * server round trip, and the page itself stays the same for every viewer.
 */
export function ResultsView({ groups: all }: { groups: ResultsGroup[] }) {
  const [gender, setGender] = useState<Gender>("F");
  const [age, setAge] = useState<string | undefined>();
  const [breakdown, setBreakdown] = useState(false);

  useEffect(() => {
    // Read after mount so the server and first client render agree.
    setBreakdown(readBreakdown());
  }, []);

  const ageGroups = filterGroups(all, { gender }).filter(
    (g) => g.age_group_code !== null,
  );
  // An age group this gender has no results for falls back to All.
  const ageGroup = ageGroups.some((g) => g.age_group_code === age)
    ? age
    : undefined;
  const groups = filterGroups(all, { gender, ageGroup });

  return (
    <>
      <div
        role="group"
        aria-label="Gender"
        className="grid grid-cols-2 rounded-md border border-input p-1"
      >
        {GENDERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setGender(option.value)}
            aria-pressed={option.value === gender}
            className={cn(
              "rounded px-3 py-1.5 text-center text-sm font-medium",
              option.value === gender && chipActive,
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {ageGroups.length > 0 && (
        <div
          role="group"
          aria-label="Age group"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
        >
          <button
            type="button"
            onClick={() => setAge(undefined)}
            aria-pressed={!ageGroup}
            className={cn(chip, !ageGroup && chipActive)}
          >
            All
          </button>
          {ageGroups.map((g) => (
            <button
              key={g.age_group_code}
              type="button"
              onClick={() => setAge(g.age_group_code ?? undefined)}
              aria-pressed={g.age_group_code === ageGroup}
              className={cn(chip, g.age_group_code === ageGroup && chipActive)}
            >
              {g.age_group_label}
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <p className="text-muted-foreground">
          No results yet. Times appear here as heats are closed.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={breakdown}
              onChange={(e) => {
                setBreakdown(e.target.checked);
                writeBreakdown(e.target.checked);
              }}
            />
            Show breakdown
          </label>
          {groups.map((group) => (
            <GroupSection
              key={group.title}
              group={group}
              showHeader={!ageGroup}
              breakdown={breakdown}
            />
          ))}
        </div>
      )}
    </>
  );
}

function GroupSection({
  group,
  showHeader,
  breakdown,
}: {
  group: ResultsGroup;
  showHeader: boolean;
  breakdown: boolean;
}) {
  const athletes = [...group.ranked, ...group.unranked];
  return (
    <section>
      {showHeader && (
        <h2 className="sticky top-0 z-10 flex items-baseline justify-between bg-background px-1 py-1.5 text-sm font-semibold">
          <span>{group.age_group_label ?? "Unclassified"}</span>
          <span className="font-normal text-muted-foreground">
            {athletes.length}
          </span>
        </h2>
      )}
      <ul className="divide-y rounded-md border border-input">
        {athletes.map((athlete, i) => (
          <AthleteRow key={i} athlete={athlete} breakdown={breakdown} />
        ))}
      </ul>
    </section>
  );
}

function AthleteRow({
  athlete,
  breakdown,
}: {
  athlete: ShapedAthlete;
  breakdown: boolean;
}) {
  return (
    <li className="px-3 py-2">
      <div className="flex items-baseline gap-3">
        <span className="w-6 shrink-0 text-sm text-muted-foreground tabular-nums">
          {athlete.rank ?? ""}
        </span>
        <span className="min-w-0 flex-1 truncate">{athlete.full_name}</span>
        <span className="font-medium tabular-nums">
          {points(athlete.total_points)}
        </span>
      </div>
      {breakdown && (
        <p className="mt-0.5 flex flex-wrap gap-x-4 pl-9 text-xs text-muted-foreground tabular-nums">
          <span>
            Run {athlete.run_time ?? "—"} · {points(athlete.run_points)}
          </span>
          <span>
            Swim {athlete.swim_time ?? "—"} · {points(athlete.swim_points)}
          </span>
        </p>
      )}
    </li>
  );
}
