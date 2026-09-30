import { describe, expect, it } from "vitest";

import { acceptDecision, landingPath } from "./landing";

describe("landingPath", () => {
  it("sends Callers, Timekeepers and Placers to their League screen", () => {
    expect(
      landingPath({ organizationId: 1, role: "caller", leagueId: 7 }),
    ).toBe("/leagues/7/call-room");
    expect(
      landingPath({ organizationId: 1, role: "timekeeper", leagueId: 7 }),
    ).toBe("/leagues/7/timer");
    expect(
      landingPath({ organizationId: 1, role: "placer", leagueId: 7 }),
    ).toBe("/leagues/7/position");
  });

  it("sends an Official to the League page", () => {
    expect(
      landingPath({ organizationId: 1, role: "official", leagueId: 7 }),
    ).toBe("/leagues/7");
  });

  it("sends everyone else to the Organization home", () => {
    expect(landingPath({ organizationId: 3, role: null, leagueId: null })).toBe(
      "/leagues#organization-3",
    );
    expect(
      landingPath({ organizationId: 3, role: "caller", leagueId: null }),
    ).toBe("/leagues#organization-3");
  });
});

describe("acceptDecision", () => {
  it("sends an unusable link to the normal sign-in page", () => {
    expect(acceptDecision(null, null)).toBe("sign-in");
    expect(acceptDecision(null, "a@example.com")).toBe("sign-in");
  });

  it("leaves a different signed-in user alone", () => {
    expect(acceptDecision("a@example.com", "b@example.com")).toBe("other-user");
  });

  it("keeps the session of the invitee who is already signed in", () => {
    expect(acceptDecision("A@Example.com", "a@example.com")).toBe(
      "signed-in-invitee",
    );
  });

  it("signs the invitee in when nobody is", () => {
    expect(acceptDecision("a@example.com", null)).toBe("sign-invitee-in");
  });
});
