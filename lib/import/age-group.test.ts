import { describe, expect, it } from "vitest";

import { AGE_GROUP_LABELS, parseAgeGroup } from "./age-group";

describe("parseAgeGroup", () => {
  it.each([
    ["U/09 GIRLS", { code: "U09", gender: "F" }],
    ["U/08 BOYS", { code: "U08", gender: "M" }],
    ["U/09 BOYS", { code: "U09", gender: "M" }],
    ["U/11 GIRLS", { code: "U11", gender: "F" }],
    ["U/11 BOYS", { code: "U11", gender: "M" }],
    ["U/13 GIRLS", { code: "U13", gender: "F" }],
    ["U/13 BOYS", { code: "U13", gender: "M" }],
    ["U/15 GIRLS", { code: "U15", gender: "F" }],
    ["U/15 BOYS", { code: "U15", gender: "M" }],
    ["U/17 GIRLS", { code: "U17", gender: "F" }],
    ["U/17 BOYS", { code: "U17", gender: "M" }],
    ["U/19 BOYS", { code: "U19", gender: "M" }],
    ["JNR WOMEN", { code: "JNR", gender: "F" }],
    ["JNR MEN", { code: "JNR", gender: "M" }],
    ["MASTERS 40+ WOMEN", { code: "M40", gender: "F" }],
    ["MASTERS 40+ MEN", { code: "M40", gender: "M" }],
    ["MASTERS 50+ WOMEN", { code: "M50", gender: "F" }],
    ["MASTERS 60+ WOMEN", { code: "M60", gender: "F" }],
    ["MASTERS 60+ MEN", { code: "M60", gender: "M" }],
    ["MASTERS 70+ WOMEN", { code: "M70", gender: "F" }],
    ["MASTERS 70+ MEN", { code: "M70", gender: "M" }],
  ] as const)("parses %s", (label, expected) => {
    expect(parseAgeGroup(label)).toEqual(expected);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(parseAgeGroup("  u/09 girls  ")).toEqual({
      code: "U09",
      gender: "F",
    });
  });

  it("returns null for an unrecognised label", () => {
    expect(parseAgeGroup("OPEN")).toBeNull();
    expect(parseAgeGroup("SENIORS")).toBeNull();
    expect(parseAgeGroup("")).toBeNull();
  });

  it.each(AGE_GROUP_LABELS)(
    "AGE_GROUP_LABELS entry %s parses successfully",
    (label) => {
      expect(parseAgeGroup(label)).not.toBeNull();
    },
  );
});
