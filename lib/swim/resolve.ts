/**
 * Resolves parsed swim rows against a league's entry roster (§4.6).
 *
 * The resolution ladder is strict and never skipped ahead:
 *
 *   1. Exact athlete number match
 *   2. (swim_heat, swim_lane) -> entry roster, only when the names agree
 *   3. Name match, only if unambiguous
 *   4. Human exception queue — unresolved, operator picks
 *
 * Step 3 never auto-accepts on its own: names are not unique in the real
 * data ("Athlete Q" is both 6209 and 8125, §2 Finding 2), so a name-only
 * hit is surfaced as a suggestion for an operator to confirm, not applied.
 *
 * A truncated athlete number is never treated as step 1: "... (81" may be
 * athlete 81, 812 or 8124 (§2 Finding 1). Those rows fall to step 2, which
 * resolves all twelve of the real file's problem rows (§2 Finding 5).
 *
 * Step 2 also requires the file's name to agree with the lane's owner: an
 * athlete can swim in a non-starter's lane, and the lane alone would credit
 * the swim to the wrong person (#62). A disagreeing row falls to step 3.
 */
import type { RawSwimRow } from "@/lib/swim/parse-results";

export type SwimRowState =
  /** Number and (heat, lane) agree, or number matched with no lane conflict. */
  | "matched"
  /** Resolved on (swim_heat, swim_lane) — number truncated, missing or absent. */
  | "matched-by-lane"
  /** Resolved, but something about the row needs a human look (§4.6). */
  | "needs-review"
  /** Ladder exhausted — operator must assign an athlete before saving. */
  | "unresolved"
  /** Empty lane ("NS"). Displayed for completeness, never saved. */
  | "no-result";

export interface RosterEntry {
  athleteNo: number;
  fullName: string;
  /** Null for a Late entry whose swim slot is not known yet. */
  swimHeat: number | null;
  swimLane: number | null;
}

export interface ResolvedSwimRow {
  /** Stable key for React lists and edit tracking. */
  localId: string;
  raw: RawSwimRow;
  athleteNo: number | null;
  athleteName: string | null;
  state: SwimRowState;
  /** Why the row needs review / could not resolve. Shown in the table. */
  reasons: string[];
  /** Name-match suggestion an operator may accept; never auto-applied. */
  suggestion: { athleteNo: number; fullName: string } | null;
  /** mm:SS.ss, operator-editable. Null means no time (DNS). */
  time: string | null;
  status: "ok" | "dns" | "dnf" | "dq";
  /** True once an operator has changed athlete or time on this row. */
  edited: boolean;
}

/**
 * Strips (AFL) and punctuation so name comparison is about the name only.
 *
 * Hyphens and apostrophes become spaces rather than vanishing: the real
 * data has names like "Dani-Leigh" and "O'Connor", and deleting the
 * separator ("danileigh") would fail to match the same name written with a
 * space, which is the exact case a name fallback exists to catch.
 */
function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(afl\)/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

/**
 * Whether the file's name can belong to the lane's owner. A cut-off name
 * column only carries the start of the name, so a prefix is enough there.
 * The cut can also fall inside "(AFL)", leaving an unclosed "(AF" that the
 * parser could not strip, so any unclosed trailing bracket is dropped too.
 */
function namesAgree(raw: RawSwimRow, owner: RosterEntry): boolean {
  const fileName = normaliseName(
    raw.truncated ? raw.name.replace(/\s*\([^)]*$/, "") : raw.name,
  );
  const ownerName = normaliseName(owner.fullName);
  if (fileName === ownerName) return true;
  return raw.truncated && fileName !== "" && ownerName.startsWith(fileName);
}

export function resolveSwimRows(
  rows: RawSwimRow[],
  roster: RosterEntry[],
): ResolvedSwimRow[] {
  const byNumber = new Map<number, RosterEntry>();
  const byHeatLane = new Map<string, RosterEntry>();
  const byName = new Map<string, RosterEntry[]>();

  for (const entry of roster) {
    byNumber.set(entry.athleteNo, entry);
    if (entry.swimHeat !== null && entry.swimLane !== null) {
      byHeatLane.set(`${entry.swimHeat}:${entry.swimLane}`, entry);
    }
    const key = normaliseName(entry.fullName);
    const bucket = byName.get(key);
    if (bucket) bucket.push(entry);
    else byName.set(key, [entry]);
  }

  return rows.map((raw, index) => {
    const localId = `swim-${raw.heat}-${raw.lane}-${index}`;
    const reasons: string[] = [];

    if (raw.revised) reasons.push("Revised block — confirm against the source");
    if (raw.backupsDisagree) {
      reasons.push(
        `Backup times disagree (${raw.backupTimes.join(", ")}) — official TIME used`,
      );
    }

    if (raw.noShow) {
      return {
        localId,
        raw,
        athleteNo: null,
        athleteName: null,
        state: "no-result",
        reasons,
        suggestion: null,
        time: null,
        status: "dns",
        edited: false,
      };
    }

    const laneMatch = byHeatLane.get(`${raw.heat}:${raw.lane}`) ?? null;

    // Step 1 — exact number, only when the column was not truncated.
    const numberMatch =
      !raw.truncated && raw.athleteNo !== null
        ? (byNumber.get(raw.athleteNo) ?? null)
        : null;

    let athlete: RosterEntry | null = null;
    let state: SwimRowState = "unresolved";
    let suggestion: { athleteNo: number; fullName: string } | null = null;

    if (numberMatch) {
      athlete = numberMatch;
      state = "matched";
      // The number resolved, but the file put them in a different lane than
      // the entry list did. Both can't be right — flag rather than pick.
      if (laneMatch && laneMatch.athleteNo !== numberMatch.athleteNo) {
        reasons.push(
          `Entry list has lane ${raw.heat}/${raw.lane} as ${laneMatch.athleteNo} ${laneMatch.fullName}`,
        );
      }
    } else if (laneMatch && namesAgree(raw, laneMatch)) {
      // Step 2 — (swim_heat, swim_lane). Resolves truncated and missing
      // numbers alike (§2 Finding 5).
      athlete = laneMatch;
      state = "matched-by-lane";
      if (raw.athleteNo !== null && !raw.truncated) {
        reasons.push(
          `File number ${raw.athleteNo} not in this league — resolved on heat/lane`,
        );
      } else if (raw.truncated && raw.athleteNo !== null) {
        const asText = String(laneMatch.athleteNo);
        // A truncated "(81" should be a prefix of the real number; if it
        // isn't, heat/lane and the file disagree about who this is.
        if (!asText.startsWith(String(raw.athleteNo))) {
          reasons.push(
            `Truncated number "${raw.athleteNo}" does not prefix ${laneMatch.athleteNo}`,
          );
        }
      }
    } else {
      if (laneMatch) {
        reasons.push(
          `Lane ${raw.heat}/${raw.lane} is #${laneMatch.athleteNo} ${laneMatch.fullName} on the entry list, but the file says ${raw.name}`,
        );
      }
      // Step 3 — name, suggestion only, never auto-accepted (§2 Finding 2).
      const candidates = byName.get(normaliseName(raw.name)) ?? [];
      if (candidates.length === 1) {
        suggestion = {
          athleteNo: candidates[0].athleteNo,
          fullName: candidates[0].fullName,
        };
        reasons.push("Name match only — confirm the athlete");
      } else if (candidates.length > 1) {
        reasons.push(
          `Name matches ${candidates.length} athletes — pick the right one`,
        );
      } else {
        reasons.push("Not in this league's entry list — add to start list");
      }
      state = "unresolved";
    }

    // Review flags outrank a clean match, but never downgrade an unresolved
    // row: the operator still has to resolve it first.
    if (athlete && (raw.revised || raw.backupsDisagree)) {
      state = "needs-review";
    }

    return {
      localId,
      raw,
      athleteNo: athlete?.athleteNo ?? null,
      athleteName: athlete?.fullName ?? null,
      state,
      reasons,
      suggestion,
      time: raw.time,
      // A named athlete with 0.00 is an entered swimmer who did not start
      // (§4.6); an empty lane was handled as no-result above.
      status: raw.time === null ? "dns" : "ok",
      edited: false,
    };
  });
}

/**
 * Athletes on the league roster with no row in the uploaded file.
 *
 * Reported as a count only — never written as DNS rows. Absence from a file
 * is not evidence of a DNS, and inventing rows for a mistakenly-uploaded
 * wrong-session file is exactly the silent-wrongness failure (§300).
 */
export function missingFromFile(
  rows: ResolvedSwimRow[],
  roster: RosterEntry[],
): RosterEntry[] {
  const present = new Set(
    rows.filter((r) => r.athleteNo !== null).map((r) => r.athleteNo),
  );
  return roster.filter((e) => !present.has(e.athleteNo));
}

/** Rows appearing twice for one athlete — one run, one swim (Q2). */
export function duplicateAthletes(rows: ResolvedSwimRow[]): number[] {
  const seen = new Map<number, number>();
  for (const row of rows) {
    if (row.athleteNo === null) continue;
    seen.set(row.athleteNo, (seen.get(row.athleteNo) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([no]) => no);
}
