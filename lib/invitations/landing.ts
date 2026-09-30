import type { LeagueRole } from "@/lib/access/roles";

const SCREEN: Partial<Record<LeagueRole, string>> = {
  caller: "/call-room",
  timekeeper: "/timer",
  placer: "/position",
  official: "",
};

/**
 * Where an invitee lands once their Invitation is accepted: the League
 * screen for their Role (Caller, Timekeeper, Placer), the League page
 * (Official), or the Organization home (Default team, no Role, or a League
 * that has since gone, which comes back with no league).
 */
export function landingPath(landing: {
  organizationId: number;
  role: LeagueRole | null;
  leagueId: number | null;
}): string {
  if (landing.role !== null && landing.leagueId !== null) {
    return `/leagues/${landing.leagueId}${SCREEN[landing.role] ?? ""}`;
  }
  return `/leagues#organization-${landing.organizationId}`;
}

export type AcceptDecision =
  "sign-in" | "other-user" | "signed-in-invitee" | "sign-invitee-in";

/**
 * What following an Invitation link does, given the email of its open
 * Invitation (null if the link can't be used) and of whoever is signed in.
 * A different signed-in user is never touched and nothing is consumed.
 */
export function acceptDecision(
  invitationEmail: string | null,
  signedInEmail: string | null,
): AcceptDecision {
  if (invitationEmail === null) return "sign-in";
  if (signedInEmail === null) return "sign-invitee-in";
  return signedInEmail.toLowerCase() === invitationEmail.toLowerCase()
    ? "signed-in-invitee"
    : "other-user";
}
