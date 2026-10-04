import { describe, expect, it } from "vitest";

import { headerModel } from "@/lib/header/header";

const organizations = [
  { id: 1, name: "Gauteng North", isAdmin: true },
  { id: 2, name: "Western Cape", isAdmin: false },
];
const leagues = [
  { id: 10, name: "Round 1", leagueDate: "2026-03-01", organizationId: 1 },
  { id: 11, name: "Round 2", leagueDate: "2026-05-01", organizationId: 1 },
  { id: 20, name: "Cape Cup", leagueDate: "2026-04-01", organizationId: 2 },
];

describe("headerModel", () => {
  it("shows the Organization and no League switcher on an Organization page", () => {
    const model = headerModel({
      pathname: "/organizations/1",
      organizations,
      leagues,
      remembered: null,
    });
    expect(model.organization).toEqual({
      kind: "switcher",
      label: "Gauteng North",
    });
    expect(model.league).toBeNull();
  });

  it("shows the League switcher inside a League, newest date first", () => {
    const model = headerModel({
      pathname: "/organizations/1/leagues/10/timer/2",
      organizations,
      leagues,
      remembered: null,
    });
    expect(model.league?.label).toBe("Round 1");
    expect(model.league?.options.map((l) => l.id)).toEqual([11, 10]);
  });

  it("offers New league only to Admins", () => {
    const admin = headerModel({
      pathname: "/organizations/1/leagues/10",
      organizations,
      leagues,
      remembered: null,
    });
    const member = headerModel({
      pathname: "/organizations/2/leagues/20",
      organizations,
      leagues,
      remembered: null,
    });
    expect(admin.league?.canCreate).toBe(true);
    expect(member.league?.canCreate).toBe(false);
  });

  it("falls back to the remembered Organization on Profile", () => {
    const model = headerModel({
      pathname: "/profile",
      organizations,
      leagues,
      remembered: 2,
    });
    expect(model.organization).toEqual({
      kind: "switcher",
      label: "Western Cape",
    });
    expect(model.league).toBeNull();
  });

  it("says Select organization when nothing is remembered or it's stale", () => {
    for (const remembered of [null, 99]) {
      const model = headerModel({
        pathname: "/organizations/pending-invitation",
        organizations,
        leagues,
        remembered,
      });
      expect(model.organization).toEqual({
        kind: "switcher",
        label: "Select organization",
      });
    }
  });

  it("shows plain New organization text on the create page", () => {
    const model = headerModel({
      pathname: "/organizations/new",
      organizations: [],
      leagues: [],
      remembered: null,
    });
    expect(model.organization).toEqual({
      kind: "text",
      label: "New organization",
    });
  });

  it("treats an Organization the user isn't in as the fallback", () => {
    const model = headerModel({
      pathname: "/organizations/99/leagues/5",
      organizations,
      leagues,
      remembered: null,
    });
    expect(model.organization.label).toBe("Select organization");
    expect(model.league).toBeNull();
  });
});
