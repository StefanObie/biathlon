/**
 * What each Role lets a Member do on a League (#32). The UI uses this to
 * hide links and to show "no access" on a screen someone can't use. It
 * isn't a security boundary: the database's access rules
 * (private.has_league_role in supabase/schemas/core.sql) decide what can
 * actually be read and written, and this mirrors them.
 */

import { Constants, type Database } from "@/lib/supabase/database.types";

/** A Role held on a League's team. Admin isn't one: it's held on the
 * Organization, and covers every League in it. */
export type LeagueRole = Database["public"]["Enums"]["league_role"];

export const LEAGUE_ROLES: readonly LeagueRole[] =
  Constants.public.Enums.league_role;

export const ROLE_LABEL: Record<LeagueRole, string> = {
  official: "Official",
  timekeeper: "Timekeeper",
  placer: "Placer",
  caller: "Caller",
};

/** What the signed-in Member holds on one League. */
export interface LeagueAccess {
  isAdmin: boolean;
  roles: LeagueRole[];
}

export type LeagueScreen =
  | "start-list"
  | "timer"
  | "position"
  | "call-room"
  | "reconcile"
  | "swim"
  | "export"
  | "team"
  | "results";

// The least a Member needs to use each screen. "admin" is only met by an
// Admin of the League's Organization.
const REQUIRED: Record<LeagueScreen, LeagueRole | "admin"> = {
  "start-list": "official",
  timer: "timekeeper",
  position: "placer",
  "call-room": "caller",
  reconcile: "official",
  swim: "official",
  export: "official",
  team: "admin",
  results: "admin",
};

/** Whether the Member holds a Role covering `required`: Admin covers
 * Official, and Official covers Timekeeper, Placer and Caller. */
export function hasRole(
  access: LeagueAccess,
  required: LeagueRole | "admin",
): boolean {
  if (access.isAdmin) return true;
  if (required === "admin") return false;
  return access.roles.some((role) => role === required || role === "official");
}

export function canUse(access: LeagueAccess, screen: LeagueScreen): boolean {
  return hasRole(access, REQUIRED[screen]);
}

export type HeatMode = "timer" | "position" | "call-room" | "reconcile";

/** The heat screens a Member can switch between, in display order. */
export function heatModes(access: LeagueAccess): HeatMode[] {
  return (["timer", "position", "call-room", "reconcile"] as const).filter(
    (mode) => canUse(access, mode),
  );
}

/** The screens used on the day of the race, in the order the League home
 * shows them. */
export const RACE_DAY_SCREENS: readonly HeatMode[] = [
  "position",
  "call-room",
  "timer",
  "reconcile",
];

/** The Race day screens a Member can use. */
export function raceDayScreens(access: LeagueAccess): HeatMode[] {
  return RACE_DAY_SCREENS.filter((screen) => canUse(access, screen));
}

export type SetupScreen = "start-list" | "team" | "results" | "swim" | "export";

export interface SetupGroup {
  title: string;
  screens: readonly SetupScreen[];
}

/** The League setup hub's groups, in display order. */
export const SETUP_GROUPS: readonly SetupGroup[] = [
  { title: "Before the race", screens: ["start-list", "team", "results"] },
  { title: "After the race", screens: ["swim", "export"] },
];

/** The setup groups a Member can use, each with only the screens they can
 * use. A group with none left is left out. */
export function setupGroups(access: LeagueAccess): SetupGroup[] {
  return SETUP_GROUPS.map((group) => ({
    ...group,
    screens: group.screens.filter((screen) => canUse(access, screen)),
  })).filter((group) => group.screens.length > 0);
}

/** Whether the Member can use any League setup screen, so the League home
 * shows its Setup link. */
export function canSetUp(access: LeagueAccess): boolean {
  return setupGroups(access).length > 0;
}
