import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { normaliseTime, parseSwimResults } from "./parse-results";

/**
 * Fixture is an anonymised copy of a real Time Drops session export: names
 * replaced, but every structural property preserved byte-for-byte — column
 * geometry, 30-char truncation, the revised block, disagreeing backups, NS
 * lanes and 0.00 rows. Verified structurally identical to the real file on
 * every parsed field (§300 wants the real files as fixtures; real athlete
 * names do not belong in git history).
 */
const FIXTURE = readFileSync(
  join(__dirname, "__fixtures__", "session-results.txt"),
  "utf8",
);

describe("normaliseTime", () => {
  it.each([
    ["59.27", "00:59.27"],
    ["1:13.22", "01:13.22"],
    ["2:26.60", "02:26.60"],
    ["26.19", "00:26.19"],
    ["1:08.45", "01:08.45"],
  ])("normalises %s to %s (§2 Finding 4)", (raw, expected) => {
    expect(normaliseTime(raw)).toBe(expected);
  });

  it("treats 0.00 as no result, never as a time (§4.6)", () => {
    expect(normaliseTime("0.00")).toBeNull();
    expect(normaliseTime("0:00.00")).toBeNull();
  });

  it("returns null for blank or unparseable input", () => {
    expect(normaliseTime("")).toBeNull();
    expect(normaliseTime("   ")).toBeNull();
    expect(normaliseTime("NS")).toBeNull();
  });

  it("zero-pads so lexicographic sort equals chronological sort", () => {
    const times = ["1:13.22", "59.27", "2:26.60", "26.19"]
      .map((t) => normaliseTime(t))
      .filter((t): t is string => t !== null);
    const lexicographic = [...times].sort();
    const chronological = [...times].sort((a, b) => {
      const cs = (t: string) =>
        Number(t.slice(0, 2)) * 6000 +
        Number(t.slice(3, 5)) * 100 +
        Number(t.slice(6, 8));
      return cs(a) - cs(b);
    });
    expect(lexicographic).toEqual(chronological);
  });
});

describe("parseSwimResults", () => {
  const rows = parseSwimResults(FIXTURE);

  it("parses every result row in the session", () => {
    expect(rows).toHaveLength(102);
  });

  it("ignores console noise, false starts and program updates", () => {
    // The file has "false Start declared!", "User pressed 'PREV HEAT'" and
    // "Meet Program was updated" lines; none are result rows.
    expect(rows.every((r) => r.heat >= 1 && r.lane >= 1)).toBe(true);
  });

  it("parses all 17 heats in file order", () => {
    expect([...new Set(rows.map((r) => r.heat))]).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
    ]);
  });

  it("extracts distance from the event header", () => {
    expect(
      [...new Set(rows.map((r) => r.distanceM))].sort(
        (a, b) => Number(a) - Number(b),
      ),
    ).toEqual([25, 50, 100]);
    expect(rows.find((r) => r.heat === 1)?.distanceM).toBe(25);
    expect(rows.find((r) => r.heat === 13)?.distanceM).toBe(100);
  });

  it("flags names that filled the 30-char column (§2 Finding 1)", () => {
    const truncated = rows.filter((r) => r.truncated);
    expect(truncated).toHaveLength(5);
    // The parsed number is a fragment, not the athlete number — "(81" here
    // is really athlete 8124 (§2 Finding 5). It must never be trusted.
    expect(truncated.map((r) => r.athleteNo)).toEqual([
      81, 5861, 1000, 8, 6746,
    ]);
  });

  it("handles swimmers with no athlete number at all", () => {
    const noNumber = rows.filter((r) => !r.noShow && r.athleteNo === null);
    expect(noNumber).toHaveLength(7);
    expect(noNumber.every((r) => r.name.length > 0)).toBe(true);
  });

  it("strips the (AFL) marker from names (§4.6)", () => {
    expect(rows.some((r) => r.name.includes("AFL"))).toBe(false);
  });

  it("marks bare NS lanes as no-result, with no name", () => {
    const ns = rows.filter((r) => r.noShow);
    expect(ns).toHaveLength(11);
    expect(ns.every((r) => r.name === "" && r.time === null)).toBe(true);
  });

  it("gives a named athlete with 0.00 a null time, not a zero time", () => {
    const dns = rows.filter((r) => !r.noShow && r.time === null);
    expect(dns).toHaveLength(9);
    expect(dns.every((r) => r.name.length > 0)).toBe(true);
  });

  it("normalises PLACE 0 to null rather than a zeroth place", () => {
    expect(rows.filter((r) => r.place === 0)).toHaveLength(0);
    expect(rows.filter((r) => r.noShow).every((r) => r.place === null)).toBe(
      true,
    );
  });

  it("uses the official TIME column and flags disagreeing backups (§4.6)", () => {
    const flagged = rows.filter((r) => r.backupsDisagree);
    expect(flagged).toHaveLength(1);
    // Source row reads 2:26.60 / 1:38.43 / 3:14.77 — TIME wins, row flagged.
    expect(flagged[0].time).toBe("02:26.60");
    expect(flagged[0].backupTimes).toEqual(["01:38.43", "03:14.77"]);
  });

  it("does not flag a row whose single backup agrees with the time", () => {
    const agreeing = rows.find(
      (r) => r.backupTimes.length === 1 && r.backupTimes[0] === r.time,
    );
    expect(agreeing).toBeDefined();
    expect(agreeing?.backupsDisagree).toBe(false);
  });

  it("marks every row under a (REVISED FROM EARLIER) marker (§4.6)", () => {
    const revised = rows.filter((r) => r.revised);
    // Heat 17 in the real session carries the marker with no earlier copy
    // to supersede — the rows are still flagged rather than trusted.
    expect(revised).toHaveLength(6);
    expect([...new Set(revised.map((r) => r.heat))]).toEqual([17]);
  });

  it("keeps the verbatim source line for the review table", () => {
    const row = rows.find((r) => r.backupsDisagree);
    expect(row?.sourceLine).toContain("2:26.60");
    expect(row?.sourceLine).toContain("1:38.43");
    expect(row?.lineNo).toBeGreaterThan(0);
  });

  it("supersedes an earlier block when a heat is repeated", () => {
    const doubled = `
Event #1   Heat 1    Race 1      Open 50 SC Meter Freestyle    (Start: 17:00:00)

LANE  PLACE  NAME                                TIME        A         B         C

   1      1  Early Swimmer (1001)               30.00    30.00

(REVISED FROM EARLIER - USE WITH CAUTION)
Event #1   Heat 1    Race 1      Open 50 SC Meter Freestyle    (Start: 17:00:00)

LANE  PLACE  NAME                                TIME        A         B         C

   1      1  Later Swimmer (1002)               31.00    31.00
`;
    const parsed = parseSwimResults(doubled);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].athleteNo).toBe(1002);
    expect(parsed[0].revised).toBe(true);
  });

  it("returns nothing for a file with no result blocks", () => {
    expect(parseSwimResults("Meet Program was updated  25 Aug 2026")).toEqual(
      [],
    );
    expect(parseSwimResults("")).toEqual([]);
  });
});
