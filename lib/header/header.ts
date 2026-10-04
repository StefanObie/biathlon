export interface HeaderOrganization {
  id: number;
  name: string;
  isAdmin: boolean;
}

export interface HeaderLeague {
  id: number;
  name: string;
  leagueDate: string;
  organizationId: number;
}

export interface HeaderModel {
  /** "text" is the plain, non-interactive label shown while creating one. */
  organization: { kind: "switcher" | "text"; label: string };
  /** Only inside a League. */
  league: {
    label: string;
    options: HeaderLeague[];
    canCreate: boolean;
    organizationId: number;
  } | null;
}

const SELECT_ORGANIZATION = "Select organization";

/**
 * What the header shows for a page. Inside an Organization it's that
 * Organization; on Profile and pending-invitation it's the remembered one,
 * or "Select organization"; on new-organization it's plain text.
 */
export function headerModel({
  pathname,
  organizations,
  leagues,
  remembered,
}: {
  pathname: string;
  organizations: HeaderOrganization[];
  leagues: HeaderLeague[];
  remembered: number | null;
}): HeaderModel {
  if (pathname === "/organizations/new") {
    return {
      organization: { kind: "text", label: "New organization" },
      league: null,
    };
  }

  const match = pathname.match(
    /^\/organizations\/(\d+)(?:\/leagues\/(\d+))?(?:\/|$)/,
  );
  const organizationId = match ? Number(match[1]) : remembered;
  const organization = organizations.find((o) => o.id === organizationId);

  if (!organization) {
    return {
      organization: { kind: "switcher", label: SELECT_ORGANIZATION },
      league: null,
    };
  }

  const current = match?.[2]
    ? leagues.find(
        (l) =>
          l.id === Number(match[2]) && l.organizationId === organization.id,
      )
    : undefined;

  return {
    organization: { kind: "switcher", label: organization.name },
    league: current
      ? {
          label: current.name,
          organizationId: organization.id,
          canCreate: organization.isAdmin,
          options: leagues
            .filter((l) => l.organizationId === organization.id)
            .sort((a, b) => b.leagueDate.localeCompare(a.leagueDate)),
        }
      : null,
  };
}
