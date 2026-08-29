import { parseAgeGroup } from "./age-group";

export interface EntryRow {
  athleteNo: number;
  fullName: string;
  ageGroupLabel: string;
  runHeat: number;
  swimHeat: number;
  swimLane: number;
}

export interface ParsedEntryRow {
  row: EntryRow;
  ageGroupCode: string;
  gender: "M" | "F";
}

export interface EntryRowError {
  rowNumber: number;
  raw: Record<string, string>;
  reason: string;
}

export interface ParseEntriesResult {
  parsed: ParsedEntryRow[];
  errors: EntryRowError[];
}

const COLUMN_ALIASES: Record<keyof EntryRow, string[]> = {
  athleteNo: ["athlete no", "athlete number", "athleteno"],
  fullName: ["athlete name", "name"],
  ageGroupLabel: ["age group", "agegroup"],
  runHeat: ["run heat", "runheat"],
  swimHeat: ["swim heat", "swimheat"],
  swimLane: ["swim lane", "swimlane"],
};

function findColumn(headers: string[], aliases: string[]): string | null {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return headers[idx];
  }
  return null;
}

/**
 * Maps arbitrary column order/casing (the source file's columns are not in
 * a fixed order, per biathlon-technical-spec.md §6.1) to the fields the
 * importer needs. Returns null for any field whose column can't be found —
 * caller treats that as a fatal format error, not a per-row issue.
 */
export function resolveColumns(
  headers: string[],
): Record<keyof EntryRow, string> | null {
  const resolved = {} as Record<keyof EntryRow, string>;
  for (const key of Object.keys(COLUMN_ALIASES) as (keyof EntryRow)[]) {
    const column = findColumn(headers, COLUMN_ALIASES[key]);
    if (!column) return null;
    resolved[key] = column;
  }
  return resolved;
}

function parseIntStrict(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  return parseInt(value, 10);
}

/**
 * Parses one already-column-mapped row. Never throws — bad rows are
 * reported via ParseEntriesResult.errors so one malformed row doesn't
 * abort the whole import (§4.6's exception-queue pattern, applied here to
 * entry import per §6.1's "validated at import time" trade-off).
 */
export function parseEntryRows(
  rows: Record<string, string>[],
  columns: Record<keyof EntryRow, string>,
): ParseEntriesResult {
  const parsed: ParsedEntryRow[] = [];
  const errors: EntryRowError[] = [];

  rows.forEach((raw, index) => {
    const rowNumber = index + 2; // +1 for header, +1 for 1-indexing
    const athleteNoRaw = raw[columns.athleteNo]?.trim() ?? "";
    const fullName = raw[columns.fullName]?.trim() ?? "";
    const ageGroupLabel = raw[columns.ageGroupLabel]?.trim() ?? "";
    const runHeatRaw = raw[columns.runHeat]?.trim() ?? "";
    const swimHeatRaw = raw[columns.swimHeat]?.trim() ?? "";
    const swimLaneRaw = raw[columns.swimLane]?.trim() ?? "";

    if (!athleteNoRaw && !fullName && !ageGroupLabel) {
      return; // blank row, silently skip
    }

    const athleteNo = parseIntStrict(athleteNoRaw);
    if (athleteNo === null) {
      errors.push({
        rowNumber,
        raw,
        reason: `invalid athlete number "${athleteNoRaw}"`,
      });
      return;
    }

    if (!fullName) {
      errors.push({ rowNumber, raw, reason: "missing athlete name" });
      return;
    }

    const ageGroup = parseAgeGroup(ageGroupLabel);
    if (!ageGroup) {
      errors.push({
        rowNumber,
        raw,
        reason: `unrecognised age group "${ageGroupLabel}"`,
      });
      return;
    }

    const runHeat = parseIntStrict(runHeatRaw);
    const swimHeat = parseIntStrict(swimHeatRaw);
    const swimLane = parseIntStrict(swimLaneRaw);
    if (runHeat === null || swimHeat === null || swimLane === null) {
      errors.push({
        rowNumber,
        raw,
        reason: `invalid heat/lane values (run heat "${runHeatRaw}", swim heat "${swimHeatRaw}", swim lane "${swimLaneRaw}")`,
      });
      return;
    }

    parsed.push({
      row: { athleteNo, fullName, ageGroupLabel, runHeat, swimHeat, swimLane },
      ageGroupCode: ageGroup.code,
      gender: ageGroup.gender,
    });
  });

  return { parsed, errors };
}
