import { describe, expect, it } from "vitest";

import { splitLeagues } from "@/lib/leagues/split";

const league = (id: number, league_date: string) => ({ id, league_date });

describe("splitLeagues", () => {
  it("puts today and later in Upcoming, soonest first", () => {
    const { upcoming } = splitLeagues(
      [
        league(1, "2026-10-20"),
        league(2, "2026-10-04"),
        league(3, "2026-11-01"),
      ],
      "2026-10-04",
    );
    expect(upcoming.map((l) => l.id)).toEqual([2, 1, 3]);
  });

  it("puts earlier dates in Past, most recent first", () => {
    const { past } = splitLeagues(
      [
        league(1, "2026-01-01"),
        league(2, "2026-10-03"),
        league(3, "2025-05-05"),
      ],
      "2026-10-04",
    );
    expect(past.map((l) => l.id)).toEqual([2, 1, 3]);
  });
});
