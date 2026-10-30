import { describe, expect, it } from "vitest";

import { parseAgeFile, reconcileAges } from "./age-file";

// Every athlete here is invented: the repo is public.
const HEADER = "#\tAthlete\tSex\tAge\tProvince\tGroup";

describe("parseAgeFile", () => {
  it("gives each row a birth year of the year taken minus the file age", () => {
    const text = [
      HEADER,
      "1001\tAda Fictional\tF\t14\tXX\tU/17 GIRLS",
      "1002\tBen Madeup\tM\t66\tXX\tMASTERS 60+ MEN",
    ].join("\n");

    expect(parseAgeFile(text, 2026)).toEqual({
      rows: [
        {
          line: 2,
          athleteNo: 1001,
          birthYear: 2012,
          sex: "F",
          ageGroupCode: "U17",
        },
        {
          line: 3,
          athleteNo: 1002,
          birthYear: 1960,
          sex: "M",
          ageGroupCode: "M60",
        },
      ],
      skipped: [],
      warnings: [],
    });
  });

  it("parses from both ends, whatever the name holds", () => {
    const text = [
      "1001 Ada van der Fictional (AFL) F 14 XX U/17 GIRLS",
      "1002 Ben M Madeup (AFL*) M 35 XX SENIORS MEN",
      "1003 Cy F 12 Invented M 9 XX U/11 BOYS",
    ].join("\n");

    expect(parseAgeFile(text, 2026).rows).toEqual([
      {
        line: 1,
        athleteNo: 1001,
        birthYear: 2012,
        sex: "F",
        ageGroupCode: "U17",
      },
      {
        line: 2,
        athleteNo: 1002,
        birthYear: 1991,
        sex: "M",
        ageGroupCode: "SEN",
      },
      {
        line: 3,
        athleteNo: 1003,
        birthYear: 2017,
        sex: "M",
        ageGroupCode: "U11",
      },
    ]);
  });

  it("reads comma separated rows too", () => {
    const text = "1001,Ada Fictional,F,14,XX,U/17 GIRLS\r\n";

    expect(parseAgeFile(text, 2026).rows).toEqual([
      {
        line: 1,
        athleteNo: 1001,
        birthYear: 2012,
        sex: "F",
        ageGroupCode: "U17",
      },
    ]);
  });

  it("ignores blank lines and repeated headers", () => {
    const text = ["", HEADER, "   ", "# Athlete Sex Age Province Group"].join(
      "\n",
    );

    expect(parseAgeFile(text, 2026)).toEqual({
      rows: [],
      skipped: [],
      warnings: [],
    });
  });

  it("reports malformed rows without stopping the others", () => {
    const text = [
      HEADER,
      "not a row at all",
      "abc Ada Fictional F 14 XX U/17 GIRLS",
      "1002 Ben Madeup M old XX U/17 BOYS",
      "1003 Cy Invented M 12 XX U/15 BOYS",
    ].join("\n");

    const { rows, skipped } = parseAgeFile(text, 2026);

    expect(rows.map((row) => row.athleteNo)).toEqual([1003]);
    expect(skipped).toEqual([
      { line: 2, athleteNo: null, reason: "doesn't match the file's columns" },
      { line: 3, athleteNo: null, reason: "invalid athlete number" },
      { line: 4, athleteNo: 1002, reason: "invalid age" },
    ]);
  });

  it("reports implausible ages, and accepts the ends of the range", () => {
    const text = [
      "1001 Ada Fictional F 4 XX U/08 GIRLS",
      "1002 Ben Madeup M 5 XX U/08 BOYS",
      "1003 Cy Invented M 100 XX MASTERS 70+ MEN",
      "1004 Di Notreal F 101 XX MASTERS 70+ WOMEN",
    ].join("\n");

    const { rows, skipped } = parseAgeFile(text, 2026);

    expect(rows.map((row) => row.athleteNo)).toEqual([1002, 1003]);
    expect(skipped).toEqual([
      { line: 1, athleteNo: 1001, reason: "implausible age 4" },
      { line: 4, athleteNo: 1004, reason: "implausible age 101" },
    ]);
  });

  it("keeps the first row of a repeated athlete number and reports the rest", () => {
    const text = [
      "1001 Ada Fictional F 14 XX U/17 GIRLS",
      "1001 Ada Fictional F 15 XX U/17 GIRLS",
    ].join("\n");

    const { rows, skipped } = parseAgeFile(text, 2026);

    expect(rows).toEqual([
      {
        line: 1,
        athleteNo: 1001,
        birthYear: 2012,
        sex: "F",
        ageGroupCode: "U17",
      },
    ]);
    expect(skipped).toEqual([
      { line: 2, athleteNo: 1001, reason: "athlete number repeats line 1" },
    ]);
  });

  it("keeps the age of a row with an unknown group, and warns", () => {
    const { rows, warnings } = parseAgeFile(
      "1001 Ada Fictional F 14 XX SOME OTHER GROUP",
      2026,
    );

    expect(rows).toEqual([
      {
        line: 1,
        athleteNo: 1001,
        birthYear: 2012,
        sex: "F",
        ageGroupCode: null,
      },
    ]);
    expect(warnings).toEqual([
      { athleteNo: 1001, message: 'unrecognised group "SOME OTHER GROUP"' },
    ]);
  });

  it("never carries a name into its result", () => {
    const text = [
      "1001 Ada Fictional F 14 XX U/17 GIRLS",
      "Ada Fictional F 14 XX U/17 GIRLS",
      "1002 Ada Fictional M Ada XX U/17 BOYS",
      "Ada Fictional",
    ].join("\n");

    expect(JSON.stringify(parseAgeFile(text, 2026))).not.toMatch(
      /Ada|Fictional/,
    );
  });
});

describe("reconcileAges", () => {
  const known = (
    athleteNo: number,
    gender: "M" | "F",
    code: string | null,
  ) => ({
    athleteNo,
    gender,
    latestAgeGroupCode: code,
  });

  it("updates rows matching a stored athlete number, with no warnings", () => {
    const parsed = parseAgeFile("1001 Ada Fictional F 14 XX U/17 GIRLS", 2026);

    expect(reconcileAges(parsed, [known(1001, "F", "U17")])).toEqual({
      updates: [{ athleteNo: 1001, birthYear: 2012 }],
      skipped: [],
      warnings: [],
    });
  });

  it("skips and reports an unknown athlete number, after the file's own skips", () => {
    const parsed = parseAgeFile(
      [
        "1001 Ada Fictional F 14 XX U/17 GIRLS",
        "1002 Ben Madeup M 4 XX U/08 BOYS",
        "9999 Cy Invented M 12 XX U/15 BOYS",
      ].join("\n"),
      2026,
    );

    const { updates, skipped } = reconcileAges(parsed, [
      known(1001, "F", "U17"),
    ]);

    expect(updates).toEqual([{ athleteNo: 1001, birthYear: 2012 }]);
    expect(skipped).toEqual([
      { line: 2, athleteNo: 1002, reason: "implausible age 4" },
      { line: 3, athleteNo: 9999, reason: "unknown athlete number" },
    ]);
  });

  it("still saves the age when the sex conflicts, and warns", () => {
    const parsed = parseAgeFile("1001 Ada Fictional F 14 XX U/17 GIRLS", 2026);

    const { updates, warnings } = reconcileAges(parsed, [
      known(1001, "M", "U17"),
    ]);

    expect(updates).toEqual([{ athleteNo: 1001, birthYear: 2012 }]);
    expect(warnings).toEqual([
      { athleteNo: 1001, message: "file says sex F, stored as M" },
    ]);
  });

  it("still saves the age when the group conflicts with the latest entry, and warns", () => {
    const parsed = parseAgeFile("1001 Ada Fictional F 14 XX U/17 GIRLS", 2026);

    const { updates, warnings } = reconcileAges(parsed, [
      known(1001, "F", "U15"),
    ]);

    expect(updates).toEqual([{ athleteNo: 1001, birthYear: 2012 }]);
    expect(warnings).toEqual([
      { athleteNo: 1001, message: "file says group U17, latest entry is U15" },
    ]);
  });

  it("has no group to conflict with for an athlete with no entry", () => {
    const parsed = parseAgeFile("1001 Ada Fictional F 14 XX U/17 GIRLS", 2026);

    expect(reconcileAges(parsed, [known(1001, "F", null)]).warnings).toEqual(
      [],
    );
  });

  it("drops the file's warning for a row it skips, and keeps the rest", () => {
    const parsed = parseAgeFile(
      [
        "1001 Ada Fictional F 14 XX SOME GROUP",
        "9999 Ben Madeup M 14 XX OTHER GROUP",
      ].join("\n"),
      2026,
    );

    expect(reconcileAges(parsed, [known(1001, "F", "U17")]).warnings).toEqual([
      { athleteNo: 1001, message: 'unrecognised group "SOME GROUP"' },
    ]);
  });
});
