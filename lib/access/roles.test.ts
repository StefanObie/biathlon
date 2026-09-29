import { describe, expect, it } from "vitest";

import { canUse, heatModes, type LeagueAccess } from "./roles";

const timekeeper: LeagueAccess = { isAdmin: false, roles: ["timekeeper"] };
const placer: LeagueAccess = { isAdmin: false, roles: ["placer"] };
const official: LeagueAccess = { isAdmin: false, roles: ["official"] };
const admin: LeagueAccess = { isAdmin: true, roles: [] };

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

  it("lets an Official use every League screen except the team", () => {
    for (const screen of [
      "start-list",
      "timer",
      "position",
      "reconcile",
      "swim",
      "export",
    ] as const) {
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
    expect(heatModes(official)).toEqual(["timer", "position", "reconcile"]);
  });
});
