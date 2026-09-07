import { describe, expect, it } from "vitest";

import { parseEntryRows, resolveColumns } from "./entry-row";

describe("resolveColumns", () => {
  it("resolves columns regardless of order", () => {
    const headers = [
      "Age Group",
      "Athlete name",
      "Athlete No",
      "Run Heat",
      "Swim Heat",
      "Swim Lane",
    ];
    expect(resolveColumns(headers)).toEqual({
      ageGroupLabel: "Age Group",
      fullName: "Athlete name",
      athleteNo: "Athlete No",
      runHeat: "Run Heat",
      swimHeat: "Swim Heat",
      swimLane: "Swim Lane",
    });
  });

  it("is case-insensitive on header names", () => {
    const headers = [
      "age group",
      "ATHLETE NAME",
      "athlete no",
      "run heat",
      "swim heat",
      "swim lane",
    ];
    expect(resolveColumns(headers)).not.toBeNull();
  });

  it("returns null when a required column is missing", () => {
    const headers = [
      "Athlete name",
      "Athlete No",
      "Run Heat",
      "Swim Heat",
      "Swim Lane",
    ];
    expect(resolveColumns(headers)).toBeNull();
  });
});

describe("parseEntryRows", () => {
  const columns = {
    athleteNo: "Athlete No",
    fullName: "Athlete name",
    ageGroupLabel: "Age Group",
    runHeat: "Run Heat",
    swimHeat: "Swim Heat",
    swimLane: "Swim Lane",
  };

  it("parses valid rows from the real sample shape", () => {
    const rows = [
      {
        "Age Group": "U/09 GIRLS",
        "Athlete name": "Elke Vorster",
        "Athlete No": "7409",
        "Run Heat": "1",
        "Swim Heat": "4",
        "Swim Lane": "6",
      },
      {
        "Age Group": "MASTERS 60+ WOMEN",
        "Athlete name": "Marieke Bouwer (AFL)",
        "Athlete No": "4911",
        "Run Heat": "1",
        "Swim Heat": "2",
        "Swim Lane": "6",
      },
    ];

    const { parsed, errors } = parseEntryRows(rows, columns);

    expect(errors).toEqual([]);
    expect(parsed).toEqual([
      {
        row: {
          athleteNo: 7409,
          fullName: "Elke Vorster",
          ageGroupLabel: "U/09 GIRLS",
          runHeat: 1,
          swimHeat: 4,
          swimLane: 6,
        },
        ageGroupCode: "U09",
        gender: "F",
      },
      {
        row: {
          athleteNo: 4911,
          fullName: "Marieke Bouwer (AFL)",
          ageGroupLabel: "MASTERS 60+ WOMEN",
          runHeat: 1,
          swimHeat: 2,
          swimLane: 6,
        },
        ageGroupCode: "M60",
        gender: "F",
      },
    ]);
  });

  it("silently skips fully blank rows", () => {
    const rows = [
      {
        "Age Group": "",
        "Athlete name": "",
        "Athlete No": "",
        "Run Heat": "",
        "Swim Heat": "",
        "Swim Lane": "",
      },
    ];
    const { parsed, errors } = parseEntryRows(rows, columns);
    expect(parsed).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("flags an invalid athlete number", () => {
    const rows = [
      {
        "Age Group": "U/09 GIRLS",
        "Athlete name": "Elke Vorster",
        "Athlete No": "N/A",
        "Run Heat": "1",
        "Swim Heat": "4",
        "Swim Lane": "6",
      },
    ];
    const { parsed, errors } = parseEntryRows(rows, columns);
    expect(parsed).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].reason).toMatch(/invalid athlete number/);
    expect(errors[0].rowNumber).toBe(2);
  });

  it("flags a missing athlete name", () => {
    const rows = [
      {
        "Age Group": "U/09 GIRLS",
        "Athlete name": "",
        "Athlete No": "7409",
        "Run Heat": "1",
        "Swim Heat": "4",
        "Swim Lane": "6",
      },
    ];
    const { errors } = parseEntryRows(rows, columns);
    expect(errors[0].reason).toMatch(/missing athlete name/);
  });

  it("flags an unrecognised age group instead of guessing", () => {
    const rows = [
      {
        "Age Group": "OPEN",
        "Athlete name": "Elke Vorster",
        "Athlete No": "7409",
        "Run Heat": "1",
        "Swim Heat": "4",
        "Swim Lane": "6",
      },
    ];
    const { parsed, errors } = parseEntryRows(rows, columns);
    expect(parsed).toEqual([]);
    expect(errors[0].reason).toMatch(/unrecognised age group/);
  });

  it("flags invalid heat/lane values", () => {
    const rows = [
      {
        "Age Group": "U/09 GIRLS",
        "Athlete name": "Elke Vorster",
        "Athlete No": "7409",
        "Run Heat": "one",
        "Swim Heat": "4",
        "Swim Lane": "6",
      },
    ];
    const { errors } = parseEntryRows(rows, columns);
    expect(errors[0].reason).toMatch(/invalid heat\/lane values/);
  });

  it("numbers row errors accounting for the header row", () => {
    const rows = [
      {
        "Age Group": "U/09 GIRLS",
        "Athlete name": "Elke Vorster",
        "Athlete No": "7409",
        "Run Heat": "1",
        "Swim Heat": "4",
        "Swim Lane": "6",
      },
      {
        "Age Group": "OPEN",
        "Athlete name": "Bad Row",
        "Athlete No": "1",
        "Run Heat": "1",
        "Swim Heat": "1",
        "Swim Lane": "1",
      },
    ];
    const { errors } = parseEntryRows(rows, columns);
    expect(errors[0].rowNumber).toBe(3);
  });
});
