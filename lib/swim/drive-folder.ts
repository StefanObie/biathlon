/**
 * Finding a League's Swim results file in its Organization's Swim folder
 * (#71). The Swim folder holds one League folder per League, named
 * "<league name> - <league date>", and the League folder holds the Swim
 * results file, its one .txt: the per-heat times-only files Time Drops also
 * writes are not .txt. Should a stray second .txt appear, the newest wins.
 */

export interface DriveItem {
  id: string;
  name: string;
}

export interface DriveFile extends DriveItem {
  /** RFC 3339, as Drive reports it. */
  modifiedTime: string;
}

// Spelled out rather than from toLocaleDateString: newer ICU data writes
// September as "Sept" in en-GB, which would stop the name matching.
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** The League folder's expected name, e.g. "League 3 - 6 Oct 2026". */
export function leagueFolderName(
  leagueName: string,
  leagueDate: string,
): string {
  const [year, month, day] = leagueDate.split("-").map(Number);
  return `${leagueName.trim()} - ${day} ${MONTHS[month - 1]} ${year}`;
}

function comparable(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * The League folder named after the League, or null when there is none or
 * more than one. An Official then picks the folder by hand.
 */
export function findLeagueFolder<T extends DriveItem>(
  folders: T[],
  leagueName: string,
  leagueDate: string,
): T | null {
  const wanted = comparable(leagueFolderName(leagueName, leagueDate));
  const matches = folders.filter((f) => comparable(f.name) === wanted);
  return matches.length === 1 ? matches[0] : null;
}

/**
 * A League folder's .txt files, newest first. The newest isn't always the
 * Swim results file: Time Drops leaves a stub .txt with no results each
 * time its console starts, so the caller reads them in turn.
 */
export function resultsFileCandidates<T extends DriveFile>(files: T[]): T[] {
  return files
    .filter((f) => /\.txt$/i.test(f.name))
    .sort((a, b) => Date.parse(b.modifiedTime) - Date.parse(a.modifiedTime));
}

const FOLDER_ID = /^[A-Za-z0-9_-]+$/;

/** The link that opens a Drive folder, e.g. to show a saved Swim folder. */
export function driveFolderLink(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

/**
 * The folder id from a Drive folder link, or a bare id as pasted. Null for
 * anything else, so a typo is caught before it reaches Drive.
 */
export function driveFolderId(input: string): string | null {
  const trimmed = input.trim();
  const fromLink = /\/folders\/([^/?#]+)/.exec(trimmed);
  const id = fromLink ? fromLink[1] : trimmed;
  return FOLDER_ID.test(id) ? id : null;
}
