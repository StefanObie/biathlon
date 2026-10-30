import { describe, expect, it } from "vitest";

import {
  counterpartHeat,
  isHeatScreen,
  navModel,
  nearestLeague,
} from "@/lib/navigation/navigation";

const organizations = [
  { id: 1, name: "Gauteng North", isAdmin: false },
  { id: 2, name: "Western Cape", isAdmin: true },
];
const leagues = [
  { id: 10, name: "Round 1", leagueDate: "2026-03-01", organizationId: 1 },
  { id: 11, name: "Round 2", leagueDate: "2026-05-01", organizationId: 1 },
  { id: 12, name: "Round 3", leagueDate: "2026-07-01", organizationId: 1 },
  { id: 20, name: "Cape Cup", leagueDate: "2026-04-01", organizationId: 2 },
];
const home = "/organizations/1/leagues/11";

const model = (
  pathname: string,
  overrides: Partial<Parameters<typeof navModel>[0]> = {},
) =>
  navModel({
    pathname,
    organizations,
    leagues,
    team: [{ leagueId: 11, role: "official" }],
    remembered: 1,
    today: "2026-05-01",
    ...overrides,
  });

describe("nearestLeague", () => {
  const dated = (leagueDate: string) => ({ leagueDate });

  it("prefers today's League", () => {
    expect(
      nearestLeague(
        [dated("2026-04-01"), dated("2026-05-01"), dated("2026-06-01")],
        "2026-05-01",
      ),
    ).toEqual(dated("2026-05-01"));
  });

  it("then the next one coming up", () => {
    expect(
      nearestLeague(
        [dated("2026-07-01"), dated("2026-06-01"), dated("2026-04-01")],
        "2026-05-01",
      ),
    ).toEqual(dated("2026-06-01"));
  });

  it("then the most recent", () => {
    expect(
      nearestLeague([dated("2026-01-01"), dated("2026-04-01")], "2026-05-01"),
    ).toEqual(dated("2026-04-01"));
  });

  it("is null with no Leagues", () => {
    expect(nearestLeague([], "2026-05-01")).toBeNull();
  });
});

describe("isHeatScreen", () => {
  it("matches the per-heat screens, run and swim", () => {
    expect(isHeatScreen(`${home}/timer/3`)).toBe(true);
    expect(isHeatScreen(`${home}/position/3`)).toBe(true);
    expect(isHeatScreen(`${home}/reconcile/3`)).toBe(true);
    expect(isHeatScreen(`${home}/call-room/3`)).toBe(true);
    expect(isHeatScreen(`${home}/call-room/swim/3`)).toBe(true);
  });

  it("doesn't match the heat pickers or other screens", () => {
    expect(isHeatScreen(`${home}/timer`)).toBe(false);
    expect(isHeatScreen(`${home}/call-room`)).toBe(false);
    expect(isHeatScreen(`${home}/call-room/swim`)).toBe(false);
    expect(isHeatScreen(`${home}/medals`)).toBe(false);
    expect(isHeatScreen("/organizations/1")).toBe(false);
  });
});

describe("counterpartHeat", () => {
  it("keeps the heat number when the other side has it", () => {
    expect(counterpartHeat(3, [1, 2, 3])).toBe(3);
  });

  it("falls back to the first heat", () => {
    expect(counterpartHeat(9, [4, 2, 3])).toBe(2);
  });

  it("is null when the other side has no heats", () => {
    expect(counterpartHeat(3, [])).toBeNull();
  });
});

describe("navModel", () => {
  it("uses the open League inside one", () => {
    const { league } = model(`${home}/medals`);
    expect(league?.id).toBe(11);
    expect(league?.settings).toEqual({
      href: `${home}/settings`,
      active: false,
    });
  });

  it("uses the nearest League outside one, so League settings always leads somewhere", () => {
    const { league, organization } = model("/organizations/1", {
      today: "2026-06-01",
      team: [{ leagueId: 12, role: "official" }],
    });
    expect(organization).toEqual({ href: "/organizations/1", active: true });
    expect(league?.id).toBe(12);
    expect(league?.settings?.href).toBe("/organizations/1/leagues/12/settings");
    expect(league?.settings?.active).toBe(false);
  });

  it("hides League settings from someone with no settings screen", () => {
    const { league } = model(home, {
      team: [{ leagueId: 11, role: "caller" }],
    });
    expect(league?.settings).toBeNull();
    expect(league?.screens.map((s) => s.screen)).toEqual([
      "call-room",
      "call-room-swim",
    ]);
  });

  it("gives an Admin every destination with no team entry", () => {
    const { league } = model("/organizations/2", { team: [] });
    expect(league?.id).toBe(20);
    expect(league?.screens).toHaveLength(6);
    expect(league?.settings).not.toBeNull();
  });

  it("has no League when the Member can see none", () => {
    expect(model("/organizations/1", { leagues: [] }).league).toBeNull();
  });

  it("has no League or Organization to link to without one", () => {
    const nav = model("/profile", { remembered: null });
    expect(nav.organization.href).toBe("/organizations");
    expect(nav.league).toBeNull();
  });

  it("marks one Call room side active at a time", () => {
    const active = (pathname: string) =>
      model(pathname)
        .league?.screens.filter((s) => s.active)
        .map((s) => s.screen);
    expect(active(`${home}/call-room`)).toEqual(["call-room"]);
    expect(active(`${home}/call-room/3`)).toEqual(["call-room"]);
    expect(active(`${home}/call-room/swim`)).toEqual(["call-room-swim"]);
    expect(active(`${home}/call-room/swim/3`)).toEqual(["call-room-swim"]);
  });

  it("keeps League settings active on its sub-pages", () => {
    expect(model(`${home}/settings/team`).league?.settings?.active).toBe(true);
    expect(model(home).league?.home.active).toBe(true);
    expect(model(`${home}/settings`).league?.home.active).toBe(false);
  });

  it("flags heat screens", () => {
    expect(model(`${home}/timer/2`).heatScreen).toBe(true);
    expect(model(home).heatScreen).toBe(false);
  });
});
