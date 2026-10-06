import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseSwimResults, type RawSwimRow } from "./parse-results";
import {
  duplicateAthletes,
  missingFromFile,
  resolveSwimRows,
  type RosterEntry,
} from "./resolve";

const FIXTURE = readFileSync(
  join(__dirname, "__fixtures__", "session-results.txt"),
  "utf8",
);

const rawRows = parseSwimResults(FIXTURE);

/**
 * A roster built from the fixture itself: every non-NS row becomes an entry
 * at its own (heat, lane) with a synthetic athlete number. This is the
 * "entry export agrees with the file" case — §2 Finding 5 confirms swim
 * heat numbering is shared between the two sources.
 */
function rosterFromFixture(): RosterEntry[] {
  return rawRows
    .filter((r) => !r.noShow)
    .map((r, i) => ({
      // Untruncated rows keep their real number so step 1 can match; the
      // rest get a number the file could not have supplied.
      athleteNo: !r.truncated && r.athleteNo !== null ? r.athleteNo : 90000 + i,
      fullName: r.name,
      swimHeat: r.heat,
      swimLane: r.lane,
    }));
}

function row(overrides: Partial<RawSwimRow> = {}): RawSwimRow {
  return {
    eventNo: 2,
    heat: 3,
    race: 3,
    distanceM: 50,
    lane: 1,
    place: 1,
    name: "Test Swimmer",
    athleteNo: 1234,
    truncated: false,
    time: "00:35.00",
    backupTimes: [],
    backupsDisagree: false,
    revised: false,
    noShow: false,
    sourceLine: "   1      1  Test Swimmer (1234)   35.00",
    lineNo: 1,
    ...overrides,
  };
}

const entry = (o: Partial<RosterEntry> = {}): RosterEntry => ({
  athleteNo: 1234,
  fullName: "Test Swimmer",
  swimHeat: 3,
  swimLane: 1,
  ...o,
});

describe("resolveSwimRows — ladder step 1: athlete number", () => {
  it("matches an exact, untruncated athlete number", () => {
    const [resolved] = resolveSwimRows([row()], [entry()]);
    expect(resolved.state).toBe("matched");
    expect(resolved.athleteNo).toBe(1234);
    expect(resolved.athleteName).toBe("Test Swimmer");
  });

  it("never trusts a truncated number as an exact match (§2 Finding 1)", () => {
    // "(81" in the file is really athlete 8124 — matching it to athlete 81
    // would be a believable wrong result, which is the failure mode §300
    // cares about.
    const rows = resolveSwimRows(
      [
        row({
          athleteNo: 81,
          truncated: true,
          name: "Right Pers",
          heat: 3,
          lane: 3,
        }),
      ],
      [
        entry({ athleteNo: 81, fullName: "Wrong Person", swimLane: 9 }),
        entry({ athleteNo: 8124, fullName: "Right Person", swimLane: 3 }),
      ],
    );
    expect(rows[0].athleteNo).toBe(8124);
    expect(rows[0].state).toBe("matched-by-lane");
  });

  it("flags when the number matches but the entry list disagrees on lane", () => {
    const rows = resolveSwimRows(
      [row({ athleteNo: 1234, heat: 3, lane: 1 })],
      [
        entry({ athleteNo: 1234, swimHeat: 3, swimLane: 5 }),
        entry({ athleteNo: 999, fullName: "Other", swimHeat: 3, swimLane: 1 }),
      ],
    );
    expect(rows[0].athleteNo).toBe(1234);
    expect(rows[0].reasons.join(" ")).toContain("999");
  });
});

describe("resolveSwimRows — ladder step 2: (swim_heat, swim_lane)", () => {
  it("resolves a row with no athlete number at all (§2 Finding 5)", () => {
    const rows = resolveSwimRows(
      [row({ athleteNo: null, name: "Real Name", heat: 4, lane: 2 })],
      [
        entry({
          athleteNo: 7777,
          fullName: "Real Name",
          swimHeat: 4,
          swimLane: 2,
        }),
      ],
    );
    expect(rows[0].state).toBe("matched-by-lane");
    expect(rows[0].athleteNo).toBe(7777);
  });

  it("notes when a truncated number does not prefix the resolved athlete", () => {
    const rows = resolveSwimRows(
      [row({ athleteNo: 99, truncated: true, heat: 3, lane: 1 })],
      [entry({ athleteNo: 5432 })],
    );
    expect(rows[0].athleteNo).toBe(5432);
    expect(rows[0].reasons.join(" ")).toContain("does not prefix");
  });

  it("accepts a truncated number that does prefix the resolved athlete", () => {
    const rows = resolveSwimRows(
      [row({ athleteNo: 81, truncated: true, heat: 3, lane: 1 })],
      [entry({ athleteNo: 8124 })],
    );
    expect(rows[0].athleteNo).toBe(8124);
    expect(rows[0].reasons.join(" ")).not.toContain("does not prefix");
  });

  it("flags a file number that is not in the league at all", () => {
    const rows = resolveSwimRows(
      [row({ athleteNo: 4321, heat: 3, lane: 1 })],
      [entry({ athleteNo: 1234 })],
    );
    expect(rows[0].state).toBe("matched-by-lane");
    expect(rows[0].reasons.join(" ")).toContain("not in this league");
  });
});

describe("resolveSwimRows — step 2 only when the names agree", () => {
  it("does not credit a Late entry's swim to the non-starter whose lane they used", () => {
    // #62: Heinrich swam in the lane of 10350 Abel Pretorius, who did not
    // start. The lane alone must not make it Abel's swim.
    const roster = [
      entry({
        athleteNo: 10350,
        fullName: "Abel Pretorius",
        swimHeat: 4,
        swimLane: 3,
      }),
      entry({
        athleteNo: 10777,
        fullName: "Heinrich von Wielligh",
        swimHeat: 8,
        swimLane: 1,
      }),
    ];
    const rows = resolveSwimRows(
      [
        row({
          athleteNo: null,
          name: "Heinrich von Wielligh",
          heat: 4,
          lane: 3,
        }),
      ],
      roster,
    );
    expect(rows[0].state).toBe("unresolved");
    expect(rows[0].athleteNo).toBeNull();
    expect(rows[0].suggestion).toEqual({
      athleteNo: 10777,
      fullName: "Heinrich von Wielligh",
    });
    expect(rows[0].reasons).toContain(
      "Lane 4/3 is #10350 Abel Pretorius on the entry list, but the file says Heinrich von Wielligh",
    );
    // Abel is only missing from the file, never written as DNS.
    expect(rows[0].status).toBe("ok");
    expect(missingFromFile(rows, roster).map((m) => m.athleteNo)).toEqual([
      10350, 10777,
    ]);
  });

  it("accepts the lane when the names differ only in case, punctuation and (AFL)", () => {
    const rows = resolveSwimRows(
      [row({ athleteNo: null, name: "jean-pierre DU TOIT (AFL)" })],
      [entry({ athleteNo: 4444, fullName: "Jean Pierre du Toit" })],
    );
    expect(rows[0].state).toBe("matched-by-lane");
    expect(rows[0].athleteNo).toBe(4444);
  });

  it("still matches by lane when the name column was cut off", () => {
    const rows = resolveSwimRows(
      [
        row({
          athleteNo: 81,
          truncated: true,
          name: "Christiaan van der Westhui",
        }),
      ],
      [entry({ athleteNo: 8124, fullName: "Christiaan van der Westhuizen" })],
    );
    expect(rows[0].state).toBe("matched-by-lane");
    expect(rows[0].athleteNo).toBe(8124);
  });

  it("still matches by lane when the cut falls inside the (AFL) marker", () => {
    const rows = resolveSwimRows(
      [row({ athleteNo: null, truncated: true, name: "Jan Nel (AF" })],
      [entry({ athleteNo: 8124, fullName: "Jan Nel" })],
    );
    expect(rows[0].state).toBe("matched-by-lane");
    expect(rows[0].athleteNo).toBe(8124);
  });

  it("does not treat a prefix as agreement when the name was not cut off", () => {
    const rows = resolveSwimRows(
      [row({ athleteNo: null, name: "Anna Smit" })],
      [entry({ athleteNo: 2222, fullName: "Anna Smith" })],
    );
    expect(rows[0].state).toBe("unresolved");
  });

  it("drops a spelling difference to a name suggestion, never auto-accepted", () => {
    const roster = [
      entry({ athleteNo: 3333, fullName: "Jaco Pieterse" }),
      entry({
        athleteNo: 3334,
        fullName: "Jako Pieterse",
        swimHeat: 9,
        swimLane: 9,
      }),
    ];
    const rows = resolveSwimRows(
      [row({ athleteNo: null, name: "Jako Pieterse" })],
      roster,
    );
    expect(rows[0].state).toBe("unresolved");
    expect(rows[0].athleteNo).toBeNull();
    expect(rows[0].suggestion?.athleteNo).toBe(3334);
    expect(rows[0].reasons.join(" ")).toContain(
      "Lane 3/1 is #3333 Jaco Pieterse on the entry list, but the file says Jako Pieterse",
    );
  });

  it("never lane-matches a Start list entry without a swim slot", () => {
    const rows = resolveSwimRows(
      [row({ athleteNo: null, name: "Test Swimmer" })],
      [entry({ swimHeat: null, swimLane: null })],
    );
    expect(rows[0].state).toBe("unresolved");
    expect(rows[0].athleteNo).toBeNull();
    expect(rows[0].suggestion?.athleteNo).toBe(1234);
  });
});

describe("resolveSwimRows — ladder step 3: name, never auto-accepted", () => {
  it("suggests but does not apply a unique name match (§2 Finding 2)", () => {
    const rows = resolveSwimRows(
      [row({ athleteNo: null, name: "Unique Person", heat: 9, lane: 9 })],
      [
        entry({
          athleteNo: 5555,
          fullName: "Unique Person",
          swimHeat: 1,
          swimLane: 1,
        }),
      ],
    );
    expect(rows[0].state).toBe("unresolved");
    expect(rows[0].athleteNo).toBeNull();
    expect(rows[0].suggestion).toEqual({
      athleteNo: 5555,
      fullName: "Unique Person",
    });
  });

  it("refuses to suggest when a name matches more than one athlete", () => {
    const rows = resolveSwimRows(
      [row({ athleteNo: null, name: "Athlete Q", heat: 9, lane: 9 })],
      [
        entry({
          athleteNo: 6209,
          fullName: "Athlete Q",
          swimHeat: 1,
          swimLane: 1,
        }),
        entry({
          athleteNo: 8125,
          fullName: "Athlete Q",
          swimHeat: 2,
          swimLane: 1,
        }),
      ],
    );
    expect(rows[0].state).toBe("unresolved");
    expect(rows[0].suggestion).toBeNull();
    expect(rows[0].reasons.join(" ")).toContain("2 athletes");
  });

  it("ignores (AFL) and punctuation when comparing names", () => {
    const rows = resolveSwimRows(
      [row({ athleteNo: null, name: "Jean-Pierre du Toit", heat: 9, lane: 9 })],
      [
        entry({
          athleteNo: 4444,
          fullName: "Jean Pierre du Toit",
          swimHeat: 1,
          swimLane: 1,
        }),
      ],
    );
    expect(rows[0].suggestion?.athleteNo).toBe(4444);
  });

  it("says to add the swimmer to the start list when nothing matches", () => {
    const rows = resolveSwimRows(
      [row({ athleteNo: null, name: "Total Stranger", heat: 9, lane: 9 })],
      [entry()],
    );
    expect(rows[0].state).toBe("unresolved");
    expect(rows[0].reasons.join(" ")).toContain("add to start list");
  });
});

describe("resolveSwimRows — statuses and review flags", () => {
  it("marks an empty NS lane no-result and never assigns an athlete", () => {
    const rows = resolveSwimRows(
      [row({ noShow: true, name: "", time: null, place: null })],
      [entry()],
    );
    expect(rows[0].state).toBe("no-result");
    expect(rows[0].athleteNo).toBeNull();
  });

  it("gives a named athlete with no time status dns (§4.6)", () => {
    const rows = resolveSwimRows([row({ time: null })], [entry()]);
    expect(rows[0].status).toBe("dns");
    expect(rows[0].time).toBeNull();
    expect(rows[0].athleteNo).toBe(1234);
  });

  it("downgrades a matched row to needs-review when backups disagree", () => {
    const rows = resolveSwimRows(
      [row({ backupsDisagree: true, backupTimes: ["01:38.43", "03:14.77"] })],
      [entry()],
    );
    expect(rows[0].state).toBe("needs-review");
    expect(rows[0].time).toBe("00:35.00");
    expect(rows[0].reasons.join(" ")).toContain("Backup times disagree");
  });

  it("downgrades a matched row to needs-review inside a revised block", () => {
    const rows = resolveSwimRows([row({ revised: true })], [entry()]);
    expect(rows[0].state).toBe("needs-review");
    expect(rows[0].reasons.join(" ")).toContain("Revised block");
  });

  it("keeps an unresolved row unresolved even when flagged for review", () => {
    // Review flags must never mask the fact that nobody is assigned yet.
    const rows = resolveSwimRows(
      [
        row({
          athleteNo: null,
          name: "Nobody",
          heat: 9,
          lane: 9,
          revised: true,
        }),
      ],
      [entry()],
    );
    expect(rows[0].state).toBe("unresolved");
  });
});

describe("resolveSwimRows — against the real session fixture", () => {
  const roster = rosterFromFixture();
  const resolved = resolveSwimRows(rawRows, roster);

  it("resolves every swimmer in the file when the roster agrees", () => {
    const unresolved = resolved.filter((r) => r.state === "unresolved");
    expect(unresolved).toHaveLength(0);
  });

  it("resolves all five truncated names on (heat, lane) (§2 Finding 5)", () => {
    const truncated = resolved.filter((r) => r.raw.truncated);
    expect(truncated).toHaveLength(5);
    expect(truncated.every((r) => r.athleteNo !== null)).toBe(true);
    expect(truncated.every((r) => r.state === "matched-by-lane")).toBe(true);
  });

  it("resolves all seven numberless swimmers on (heat, lane)", () => {
    const numberless = resolved.filter(
      (r) => !r.raw.noShow && r.raw.athleteNo === null,
    );
    expect(numberless).toHaveLength(7);
    expect(numberless.every((r) => r.athleteNo !== null)).toBe(true);
  });

  it("assigns nobody to the eleven empty NS lanes", () => {
    const noResult = resolved.filter((r) => r.state === "no-result");
    expect(noResult).toHaveLength(11);
    expect(noResult.every((r) => r.athleteNo === null)).toBe(true);
  });

  it("flags the revised heat and the disagreeing-backup row for review", () => {
    const review = resolved.filter((r) => r.state === "needs-review");
    // Heat 17 has six rows, but one is an empty NS lane, which stays
    // no-result — an unoccupied lane needs no review.
    expect(review.length).toBe(5);
    expect(review.every((r) => r.raw.heat === 17)).toBe(true);
    expect(review.some((r) => r.raw.backupsDisagree)).toBe(true);
  });

  it("produces no duplicate athletes from a clean file", () => {
    expect(duplicateAthletes(resolved)).toEqual([]);
  });
});

describe("missingFromFile", () => {
  it("lists entered athletes with no row in the file", () => {
    const resolved = resolveSwimRows([row()], [entry()]);
    const missing = missingFromFile(resolved, [
      entry(),
      entry({ athleteNo: 4242, fullName: "Absent Swimmer", swimLane: 6 }),
    ]);
    expect(missing.map((m) => m.athleteNo)).toEqual([4242]);
  });

  it("is empty when every entered athlete appears", () => {
    const resolved = resolveSwimRows([row()], [entry()]);
    expect(missingFromFile(resolved, [entry()])).toEqual([]);
  });
});

describe("duplicateAthletes", () => {
  it("reports an athlete resolved on two rows — one run, one swim", () => {
    const rows = resolveSwimRows(
      [row({ heat: 3, lane: 1 }), row({ heat: 5, lane: 1, athleteNo: 1234 })],
      [entry({ swimHeat: 3, swimLane: 1 })],
    );
    expect(duplicateAthletes(rows)).toEqual([1234]);
  });
});
