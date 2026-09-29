import { describe, expect, it } from "vitest";

import {
  canUse,
  hasRole,
  heatModes,
  ROLE_LABEL,
  type LeagueAccess,
} from "./roles";

const timekeeper: LeagueAccess = { isAdmin: false, roles: ["timekeeper"] };
const placer: LeagueAccess = { isAdmin: false, roles: ["placer"] };
const caller: LeagueAccess = { isAdmin: false, roles: ["caller"] };
const official: LeagueAccess = { isAdmin: false, roles: ["official"] };
const admin: LeagueAccess = { isAdmin: true, roles: [] };

// Every screen except the team, which only an Admin can use.
const LEAGUE_SCREENS = [
  "start-list",
  "timer",
  "position",
  "call-room",
  "reconcile",
  "swim",
  "export",
] as const;

describe("canUse", () => {
  it("lets a Timekeeper use the heat list and the Timer screen only", () => {
    expect(canUse(timekeeper, "timer")).toBe(true);
    expect(canUse(timekeeper, "position")).toBe(false);
    expect(canUse(timekeeper, "reconcile")).toBe(false);
    expect(canUse(timekeeper, "start-list")).toBe(false);
    expect(canUse(timekeeper, "swim")).toBe(false);
    expect(canUse(timekeeper, "export")).toBe(false);
    expect(canUse(timekeeper, "team")).toBe(false);
  });

  it("lets a Placer use the heat list and the Position screen only", () => {
    expect(canUse(placer, "position")).toBe(true);
    expect(canUse(placer, "timer")).toBe(false);
    expect(canUse(placer, "reconcile")).toBe(false);
    expect(canUse(placer, "start-list")).toBe(false);
    expect(canUse(placer, "export")).toBe(false);
  });

  it("lets a Caller use the Call room screen only", () => {
    expect(canUse(caller, "call-room")).toBe(true);
    for (const screen of LEAGUE_SCREENS.filter((s) => s !== "call-room")) {
      expect(canUse(caller, screen)).toBe(false);
    }
    expect(canUse(caller, "team")).toBe(false);
    expect(heatModes(caller)).toEqual(["call-room"]);
  });

  it("hides the Call room screen from a Timekeeper and a Placer", () => {
    expect(canUse(timekeeper, "call-room")).toBe(false);
    expect(canUse(placer, "call-room")).toBe(false);
  });

  it("lets an Official use every League screen except the team", () => {
    for (const screen of LEAGUE_SCREENS) {
      expect(canUse(official, screen)).toBe(true);
    }
    expect(canUse(official, "team")).toBe(false);
  });

  it("lets an Admin use every screen without being on the League team", () => {
    expect(canUse(admin, "reconcile")).toBe(true);
    expect(canUse(admin, "timer")).toBe(true);
    expect(canUse(admin, "export")).toBe(true);
    expect(canUse(admin, "team")).toBe(true);
  });

  it("combines the Roles of a Member who holds several", () => {
    const both: LeagueAccess = {
      isAdmin: false,
      roles: ["timekeeper", "placer"],
    };
    expect(canUse(both, "timer")).toBe(true);
    expect(canUse(both, "position")).toBe(true);
    expect(canUse(both, "reconcile")).toBe(false);
  });

  it("lets someone with no Role use nothing", () => {
    const none: LeagueAccess = { isAdmin: false, roles: [] };
    expect(canUse(none, "timer")).toBe(false);
    expect(canUse(none, "position")).toBe(false);
  });
});

describe("heatModes", () => {
  it("offers a Timekeeper only the Timer screen when switching mode", () => {
    expect(heatModes(timekeeper)).toEqual(["timer"]);
  });

  it("offers an Official every heat screen", () => {
    expect(heatModes(official)).toEqual([
      "timer",
      "position",
      "call-room",
      "reconcile",
    ]);
  });
});

describe("hasRole", () => {
  it("covers Caller for a Caller, an Official and an Admin", () => {
    expect(hasRole(caller, "caller")).toBe(true);
    expect(hasRole(official, "caller")).toBe(true);
    expect(hasRole(admin, "caller")).toBe(true);
  });

  it("doesn't cover Caller for a Timekeeper or a Placer", () => {
    expect(hasRole(timekeeper, "caller")).toBe(false);
    expect(hasRole(placer, "caller")).toBe(false);
  });

  it("doesn't let Caller cover any other Role", () => {
    expect(hasRole(caller, "timekeeper")).toBe(false);
    expect(hasRole(caller, "placer")).toBe(false);
    expect(hasRole(caller, "official")).toBe(false);
  });
});

describe("ROLE_LABEL", () => {
  it("labels Caller", () => {
    expect(ROLE_LABEL.caller).toBe("Caller");
  });
});
