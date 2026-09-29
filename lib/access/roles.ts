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
  | "team";

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
