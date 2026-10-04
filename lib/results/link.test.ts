import { describe, expect, it } from "vitest";

import { resultsLink } from "./link";

const ids = { organizationId: 1, leagueId: 2 };

describe("resultsLink", () => {
  it("links to the public results for a Public League", () => {
    expect(
      resultsLink({
        visibility: "public",
        slug: "a-b",
        isAdmin: false,
        ...ids,
      }),
    ).toEqual({ kind: "results", href: "/results/a-b" });
  });

  it("links to the public results for a Protected League", () => {
    expect(
      resultsLink({
        visibility: "protected",
        slug: "x9",
        isAdmin: true,
        ...ids,
      }),
    ).toEqual({ kind: "results", href: "/results/x9" });
  });

  it("sends an Admin of a Private League to Setup → Visibility", () => {
    expect(
      resultsLink({ visibility: "private", slug: null, isAdmin: true, ...ids }),
    ).toEqual({
      kind: "private",
      href: "/organizations/1/leagues/2/setup/results",
    });
  });

  it("gives an Official of a Private League plain text", () => {
    expect(
      resultsLink({
        visibility: "private",
        slug: null,
        isAdmin: false,
        ...ids,
      }),
    ).toEqual({ kind: "private", href: null });
  });

  it("treats a missing slug as private", () => {
    expect(
      resultsLink({ visibility: "public", slug: null, isAdmin: false, ...ids }),
    ).toEqual({ kind: "private", href: null });
  });
});
