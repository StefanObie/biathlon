import { parseAgeGroup, type Gender } from "./age-group";

/**
 * One usable row. Only what checks and stores the age: never a name. `line`
 * is 1-indexed in the file's text.
 */
export interface AgeFileRow {
  line: number;
  athleteNo: number;
  birthYear: number;
  sex: Gender;
  /** Null when the file's group isn't one the start list import knows. */
  ageGroupCode: string | null;
}

/** A row that saves nothing. */
export interface AgeFileSkip {
  line: number;
  athleteNo: number | null;
  reason: string;
}

/** Something to follow up on. The age is still saved. */
export interface AgeFileWarning {
  athleteNo: number;
  message: string;
}

export interface ParsedAgeFile {
  rows: AgeFileRow[];
  skipped: AgeFileSkip[];
  warnings: AgeFileWarning[];
}

/** The same range correct_athlete_age and save_athlete_ages accept. */
const MIN_AGE = 5;
const MAX_AGE = 100;

// Columns are `# Athlete Sex Age Province Group`. Names and groups both hold
// spaces, so the number comes off the front and the rest off the back: the
// greedy name leaves the last lone M or F with three or more tokens after it.
const ROW = /^(\S+)\s+.+\s+([MF])\s+(\S+)\s+\S+\s+(.+)$/;

/**
 * Reads the text of an age file into birth years, skipped rows and warnings.
 * Never throws, so one bad row can't stop the others, and names go no further
 * than this function: reasons never quote a token that could be one. Whether
 * a number is a known athlete is for reconcileAges.
 */
export function parseAgeFile(text: string, yearTaken: number): ParsedAgeFile {
  const rows: AgeFileRow[] = [];
  const skipped: AgeFileSkip[] = [];
  const warnings: AgeFileWarning[] = [];
  const firstLine = new Map<number, number>();

  text.split(/\r?\n/).forEach((raw, index) => {
    const lineNumber = index + 1;
    const line = raw.replace(/[,;"]/g, " ").trim();
    if (!line || line.startsWith("#")) return;

    const skip = (athleteNo: number | null, reason: string) =>
      skipped.push({ line: lineNumber, athleteNo, reason });

    const match = line.match(ROW);
    if (!match) return skip(null, "doesn't match the file's columns");
    const [, numberText, sex, ageText, group] = match;

    if (!/^\d{1,9}$/.test(numberText)) {
      return skip(null, "invalid athlete number");
    }
    const athleteNo = Number(numberText);

    if (!/^\d{1,3}$/.test(ageText)) return skip(athleteNo, "invalid age");
    const age = Number(ageText);
    if (age < MIN_AGE || age > MAX_AGE) {
      return skip(athleteNo, `implausible age ${age}`);
    }

    const repeats = firstLine.get(athleteNo);
    if (repeats !== undefined) {
      return skip(athleteNo, `athlete number repeats line ${repeats}`);
    }
    firstLine.set(athleteNo, lineNumber);

    const ageGroup = parseAgeGroup(group);
    if (!ageGroup) {
      warnings.push({ athleteNo, message: `unrecognised group "${group}"` });
    }
    rows.push({
      line: lineNumber,
      athleteNo,
      birthYear: yearTaken - age,
      sex: sex as Gender,
      ageGroupCode: ageGroup?.code ?? null,
    });
  });

  return { rows, skipped, warnings };
}

/** What's stored for an athlete number in the Organization. */
export interface StoredAthlete {
  athleteNo: number;
  gender: Gender;
  /** The group on their latest League entry, null with no entry. */
  latestAgeGroupCode: string | null;
}

export interface AgeUpdate {
  athleteNo: number;
  birthYear: number;
}

export interface ReconciledAges {
  updates: AgeUpdate[];
  skipped: AgeFileSkip[];
  warnings: AgeFileWarning[];
}

/**
 * Checks parsed rows against what's stored: the preview an Admin confirms.
 * Rows match by athlete number alone. An unknown number is skipped, and a
 * conflicting sex or group only warns: the age is still saved.
 */
export function reconcileAges(
  parsed: ParsedAgeFile,
  stored: StoredAthlete[],
): ReconciledAges {
  const athletes = new Map(stored.map((a) => [a.athleteNo, a]));
  const updates: AgeUpdate[] = [];
  const skipped = [...parsed.skipped];
  const warnings: AgeFileWarning[] = [];

  for (const row of parsed.rows) {
    const { line, athleteNo, birthYear, sex, ageGroupCode } = row;
    const athlete = athletes.get(athleteNo);
    if (!athlete) {
      skipped.push({ line, athleteNo, reason: "unknown athlete number" });
      continue;
    }

    updates.push({ athleteNo, birthYear });
    warnings.push(...parsed.warnings.filter((w) => w.athleteNo === athleteNo));
    if (sex !== athlete.gender) {
      warnings.push({
        athleteNo,
        message: `file says sex ${sex}, stored as ${athlete.gender}`,
      });
    }
    const latest = athlete.latestAgeGroupCode;
    if (ageGroupCode && latest && ageGroupCode !== latest) {
      warnings.push({
        athleteNo,
        message: `file says group ${ageGroupCode}, latest entry is ${latest}`,
      });
    }
  }

  skipped.sort((a, b) => a.line - b.line);
  return { updates, skipped, warnings };
}
