import type { LeagueRole } from "@/lib/access/roles";

/** One Member of an Organization, as an Admin sees them on a team screen. */
export interface TeamRow {
  userId: string;
  email: string;
  isAdmin: boolean;
  /** Roles currently held on the team. */
  roles: LeagueRole[];
}

/** What a team change sends back: an error to show, if it failed. */
export interface TeamChangeResult {
  error?: string;
}

/**
 * Every Member of the Organization, in the order given, with the Roles they
 * hold on a team (a League team or the Default team). Members on no team
 * are listed with no Roles, so an Admin can add them.
 */
export function teamRows(
  members: { user_id: string; email: string; is_admin: boolean }[],
  team: { user_id: string; role: LeagueRole }[],
): TeamRow[] {
  return members.map((member) => ({
    userId: member.user_id,
    email: member.email,
    isAdmin: member.is_admin,
    roles: team
      .filter((entry) => entry.user_id === member.user_id)
      .map((entry) => entry.role),
  }));
}
