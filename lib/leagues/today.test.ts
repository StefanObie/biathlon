import { describe, expect, it } from "vitest";

import { isLeagueToday, leagueToday } from "@/lib/leagues/today";

describe("leagueToday", () => {
  it("is already tomorrow in South Africa from 22:00 UTC", () => {
    expect(leagueToday(new Date("2026-10-30T21:59:00Z"))).toBe("2026-10-30");
    expect(leagueToday(new Date("2026-10-30T22:00:00Z"))).toBe("2026-10-31");
  });
});

describe("isLeagueToday", () => {
  const now = new Date("2026-10-30T10:00:00Z");

  it("is true only for today's date", () => {
    expect(isLeagueToday("2026-10-30", now)).toBe(true);
    expect(isLeagueToday("2026-10-29", now)).toBe(false);
    expect(isLeagueToday("2026-10-31", now)).toBe(false);
  });
});
