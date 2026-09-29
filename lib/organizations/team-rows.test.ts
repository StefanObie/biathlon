import { describe, expect, it } from "vitest";

import { teamRows } from "./team-rows";

const members = [
  { user_id: "a", email: "admin@example.com", is_admin: true },
  { user_id: "b", email: "official@example.com", is_admin: false },
  { user_id: "c", email: "nobody@example.com", is_admin: false },
];

describe("teamRows", () => {
  it("lists every Member with the Roles they hold on the team", () => {
    const rows = teamRows(members, [
      { user_id: "b", role: "official" },
      { user_id: "b", role: "caller" },
    ]);

    expect(rows).toEqual([
      { userId: "a", email: "admin@example.com", isAdmin: true, roles: [] },
      {
        userId: "b",
        email: "official@example.com",
        isAdmin: false,
        roles: ["official", "caller"],
      },
      { userId: "c", email: "nobody@example.com", isAdmin: false, roles: [] },
    ]);
  });

  it("ignores team entries for someone who isn't a Member", () => {
    const rows = teamRows(members.slice(0, 1), [
      { user_id: "z", role: "placer" },
    ]);

    expect(rows).toEqual([
      { userId: "a", email: "admin@example.com", isAdmin: true, roles: [] },
    ]);
  });
});
