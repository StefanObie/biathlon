/** A League and the Organization it sits under, as every League address names them. */
export interface LeagueRef {
  organizationId: number;
  leagueId: number;
}

/** The screens that run once per heat, and so can address a single heat. */
export type HeatScreenAddress =
  "position" | "call-room" | "timer" | "reconcile";

export type LeagueScreenAddress =
  | HeatScreenAddress
  | "start-list"
  | "swim"
  | "export"
  | "export-xml"
  | "export-xlsx"
  | "team"
  | "results"
  | "setup"
  | "bibs-pdf";

const PATH: Record<LeagueScreenAddress, string> = {
  position: "/position",
  "call-room": "/call-room",
  timer: "/timer",
  reconcile: "/reconcile",
  setup: "/setup",
  "start-list": "/setup/start-list",
  swim: "/setup/swim",
  export: "/setup/export",
  "export-xml": "/setup/export/xml",
  "export-xlsx": "/setup/export/xlsx",
  team: "/setup/team",
  results: "/setup/results",
  "bibs-pdf": "/setup/start-list/bibs/pdf",
};

/**
 * The one place a League address is built (ADR 0004): the League home with no
 * screen, otherwise that screen, and for the per-heat screens optionally one
 * heat. Nothing else builds a League path by hand.
 */
export function leagueAddress(league: LeagueRef): string;
export function leagueAddress(
  league: LeagueRef,
  screen: HeatScreenAddress,
  heat?: number,
): string;
export function leagueAddress(
  league: LeagueRef,
  screen: LeagueScreenAddress,
): string;
export function leagueAddress(
  { organizationId, leagueId }: LeagueRef,
  screen?: LeagueScreenAddress,
  heat?: number,
): string {
  const home = `/organizations/${organizationId}/leagues/${leagueId}`;
  if (screen === undefined) return home;
  const path = `${home}${PATH[screen]}`;
  return heat === undefined ? path : `${path}/${heat}`;
}
