import { describe, expect, it } from "vitest";

import {
  decideLateEntry,
  parseLateEntryAge,
  type OrganizationAthlete,
} from "./late-entry";

const athletes: OrganizationAthlete[] = [
  {
    athleteNo: 6918,
    fullName: "Raced Last Week",
    gender: "F",
    latestAgeGroupCode: "U13",
  },
  {
    athleteNo: 5478,
    fullName: "Also Raced Last Week",
    gender: "M",
    latestAgeGroupCode: "M40",
  },
  {
    athleteNo: 1234,
    fullName: "Never Entered",
    gender: "M",
    latestAgeGroupCode: null,
  },
];

describe("decideLateEntry", () => {
  it("is a new athlete when the Organization has no such Athlete number", () => {
    expect(decideLateEntry(90001, athletes, [])).toEqual({
      kind: "new-athlete",
    });
  });

  it("is an existing athlete with their stored name and gender and latest age group", () => {
    expect(decideLateEntry(6918, athletes, [])).toEqual({
      kind: "existing-athlete",
      fullName: "Raced Last Week",
      gender: "F",
      suggestedAgeGroupLabel: "U/13 GIRLS",
    });
  });

  it("suggests the latest age group for each athlete who has raced before", () => {
    expect(decideLateEntry(5478, athletes, [])).toMatchObject({
      suggestedAgeGroupLabel: "MASTERS 40+ MEN",
    });
  });

  it("suggests no age group for an athlete of the Organization who was never entered", () => {
    expect(decideLateEntry(1234, athletes, [])).toEqual({
      kind: "existing-athlete",
      fullName: "Never Entered",
      gender: "M",
      suggestedAgeGroupLabel: null,
    });
  });

  it("is already on the Start list, with the heat, whether or not the Organization knows the athlete", () => {
    const startList = [
      { athleteNo: 6918, runHeat: 3 },
      { athleteNo: 42, runHeat: 1 },
    ];
    expect(decideLateEntry(6918, athletes, startList)).toEqual({
      kind: "already-on-start-list",
      runHeat: 3,
    });
    expect(decideLateEntry(42, athletes, startList)).toEqual({
      kind: "already-on-start-list",
      runHeat: 1,
    });
  });
});

describe("parseLateEntryAge", () => {
  it("is no age for a blank field, so the Late entry still saves", () => {
    expect(parseLateEntryAge("")).toEqual({ age: null });
    expect(parseLateEntryAge("   ")).toEqual({ age: null });
    expect(parseLateEntryAge(null)).toEqual({ age: null });
  });

  it("reads a plausible age, up to and including both ends of the range", () => {
    expect(parseLateEntryAge("45")).toEqual({ age: 45 });
    expect(parseLateEntryAge(" 5 ")).toEqual({ age: 5 });
    expect(parseLateEntryAge("100")).toEqual({ age: 100 });
  });

  it.each(["4", "101", "0", "-30", "45.5", "abc"])(
    "rejects %s with a message saying what an age must be",
    (value) => {
      expect(parseLateEntryAge(value)).toEqual({
        error: "Age must be a whole number between 5 and 100.",
      });
    },
  );
});
