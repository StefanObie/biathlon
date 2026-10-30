import {
  hasSettings,
  homeTiles,
  type HomeTile,
  type LeagueAccess,
  type LeagueRole,
} from "@/lib/access/roles";
import {
  headerModel,
  type HeaderLeague,
  type HeaderModel,
  type HeaderOrganization,
} from "@/lib/header/header";
import { leagueAddress } from "@/lib/leagues/address";

/** A Role the signed-in Member currently holds on a League's team. */
export interface NavTeamEntry {
  leagueId: number;
  role: LeagueRole;
}

export const SCREEN_LABEL: Record<HomeTile, string> = {
  "call-room": "Run call room",
  "call-room-swim": "Swim call room",
  position: "Position",
  timer: "Timer",
  reconcile: "Reconcile",
  medals: "Medals",
};

export interface NavScreen {
  screen: HomeTile;
  label: string;
  href: string;
  active: boolean;
}

export interface NavModel {
  header: HeaderModel;
  organization: { href: string; active: boolean };
  /** The League the navigation is about: the open one, otherwise the
   * Organization's nearest. Null when the Member can see no League in it. */
  league: {
    id: number;
    label: string;
    organizationId: number;
    options: HeaderLeague[];
    canCreate: boolean;
    home: { href: string; active: boolean };
    screens: NavScreen[];
    /** Null when the Member can't use any League settings screen. */
    settings: { href: string; active: boolean } | null;
  } | null;
  /** A per-heat screen: its own bar owns the bottom of the phone screen. */
  heatScreen: boolean;
}

const LEAGUE_PATH = /^\/organizations\/(\d+)(?:\/leagues\/(\d+))?(?:\/|$)/;

const HEAT_SCREEN_PATH =
  /^\/organizations\/\d+\/leagues\/\d+\/(?:timer|position|reconcile|call-room|call-room\/swim)\/\d+\/?$/;

/** Whether a path is one of the per-heat screens (ADR 0004 addresses). */
export function isHeatScreen(pathname: string): boolean {
  return HEAT_SCREEN_PATH.test(pathname);
}

/**
 * The League someone most likely means when they aren't in one: today's,
 * otherwise the next one coming up, otherwise the most recent. Dates are ISO
 * `YYYY-MM-DD`, so they compare as strings.
 */
export function nearestLeague<T extends { leagueDate: string }>(
  leagues: T[],
  today: string,
): T | null {
  const upcoming = leagues
    .filter((l) => l.leagueDate >= today)
    .sort((a, b) => a.leagueDate.localeCompare(b.leagueDate));
  if (upcoming.length > 0) return upcoming[0];
  const past = [...leagues].sort((a, b) =>
    b.leagueDate.localeCompare(a.leagueDate),
  );
  return past[0] ?? null;
}

/** The heat to land on when switching a Call room between run and swim: the
 * same number if the other side has it, otherwise its first heat. */
export function counterpartHeat(heat: number, heats: number[]): number | null {
  if (heats.includes(heat)) return heat;
  return heats.length > 0 ? Math.min(...heats) : null;
}

/** What the fixed navigation shows for a page, and where each link goes. */
export function navModel({
  pathname,
  organizations,
  leagues,
  team,
  remembered,
  today,
}: {
  pathname: string;
  organizations: HeaderOrganization[];
  leagues: HeaderLeague[];
  team: NavTeamEntry[];
  remembered: number | null;
  today: string;
}): NavModel {
  const header = headerModel({ pathname, organizations, leagues, remembered });
  const match = pathname.match(LEAGUE_PATH);
  const organizationId = match ? Number(match[1]) : remembered;
  const organization = organizations.find((o) => o.id === organizationId);
  const heatScreen = isHeatScreen(pathname);

  if (!organization) {
    return {
      header,
      organization: { href: "/organizations", active: false },
      league: null,
      heatScreen,
    };
  }

  const options = leagues
    .filter((l) => l.organizationId === organization.id)
    .sort((a, b) => b.leagueDate.localeCompare(a.leagueDate));
  const open = match?.[2]
    ? options.find((l) => l.id === Number(match[2]))
    : undefined;
  const chosen = open ?? nearestLeague(options, today);

  const organizationHref = `/organizations/${organization.id}`;
  return {
    header,
    organization: {
      href: organizationHref,
      active: pathname === organizationHref,
    },
    league: chosen && {
      id: chosen.id,
      label: chosen.name,
      organizationId: organization.id,
      options,
      canCreate: organization.isAdmin,
      ...leagueLinks(chosen, organization, team, pathname),
    },
    heatScreen,
  };
}

function leagueLinks(
  league: HeaderLeague,
  organization: HeaderOrganization,
  team: NavTeamEntry[],
  pathname: string,
) {
  const ref = { organizationId: organization.id, leagueId: league.id };
  const access: LeagueAccess = {
    isAdmin: organization.isAdmin,
    roles: team.filter((e) => e.leagueId === league.id).map((e) => e.role),
  };
  const within = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const home = leagueAddress(ref);
  const settings = leagueAddress(ref, "settings");
  const swimCallRoom = leagueAddress(ref, "call-room-swim");

  return {
    home: { href: home, active: pathname === home },
    screens: homeTiles(access).map((screen) => {
      const href = leagueAddress(ref, screen);
      return {
        screen,
        label: SCREEN_LABEL[screen],
        href,
        // The swim side's address sits under the run side's.
        active:
          within(href) && (screen !== "call-room" || !within(swimCallRoom)),
      };
    }),
    settings: hasSettings(access)
      ? { href: settings, active: within(settings) }
      : null,
  };
}
