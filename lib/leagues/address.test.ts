import { describe, expect, it } from "vitest";

import { leagueAddress, type LeagueScreenAddress } from "./address";

const league = { organizationId: 2, leagueId: 7 };
const base = "/organizations/2/leagues/7";

describe("leagueAddress", () => {
  it("addresses the League home", () => {
    expect(leagueAddress(league)).toBe(base);
  });

  it.each<[LeagueScreenAddress, string]>([
    ["start-list", "/start-list"],
    ["team", "/team"],
    ["settings", "/settings"],
    ["swim", "/swim"],
    ["export", "/export"],
    ["export-xml", "/export/xml"],
    ["bibs-pdf", "/bibs/pdf"],
  ])("addresses the %s screen", (screen, path) => {
    expect(leagueAddress(league, screen)).toBe(`${base}${path}`);
  });

  it.each(["position", "call-room", "timer", "reconcile"] as const)(
    "addresses the %s screen with and without a heat",
    (screen) => {
      expect(leagueAddress(league, screen)).toBe(`${base}/${screen}`);
      expect(leagueAddress(league, screen, 3)).toBe(`${base}/${screen}/3`);
    },
  );
});
