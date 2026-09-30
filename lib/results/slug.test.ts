import { describe, expect, it } from "vitest";

import {
  defaultSlug,
  isCustomSlug,
  isRandomSlug,
  normaliseSlug,
  randomSlug,
} from "./slug";

describe("normaliseSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(normaliseSlug("GNB League 1")).toBe("gnb-league-1");
  });

  it("collapses runs of separators and trims hyphens", () => {
    expect(normaliseSlug("  --Crossland  &  GNB!! ")).toBe("crossland-gnb");
  });

  it("treats anything but a-z and 0-9 as a separator, like the database", () => {
    expect(normaliseSlug("Café Liga")).toBe("caf-liga");
  });

  it("leaves a valid slug alone", () => {
    expect(normaliseSlug("gnb-league-1")).toBe("gnb-league-1");
  });
});

describe("isCustomSlug", () => {
  it.each(["abc", "gnb-league-1", "a1b", "x".repeat(80)])("accepts %s", (s) =>
    expect(isCustomSlug(s)).toBe(true),
  );

  it.each([
    "ab",
    "x".repeat(81),
    "-abc",
    "abc-",
    "a--b",
    "Abc",
    "a b c",
    "a_b_c",
    "",
  ])("rejects %j", (s) => expect(isCustomSlug(s)).toBe(false));
});

describe("defaultSlug", () => {
  it("joins the Organization and League names", () => {
    expect(defaultSlug("Crossland GNB", "League 1", 1)).toBe(
      "crossland-gnb-league-1",
    );
  });

  it("appends a counter from the second attempt", () => {
    expect(defaultSlug("Crossland GNB", "League 1", 2)).toBe(
      "crossland-gnb-league-1-2",
    );
    expect(defaultSlug("Crossland GNB", "League 1", 3)).toBe(
      "crossland-gnb-league-1-3",
    );
  });

  it("stays a valid custom slug when the names are long", () => {
    for (const attempt of [1, 2, 10]) {
      const slug = defaultSlug("O".repeat(60), "L".repeat(60), attempt);
      expect(isCustomSlug(slug)).toBe(true);
    }
    expect(
      defaultSlug("O".repeat(60), "L".repeat(60), 12).endsWith("-12"),
    ).toBe(true);
  });

  it("falls back when the names leave nothing usable", () => {
    expect(isCustomSlug(defaultSlug("!!", "??", 1))).toBe(true);
    expect(isCustomSlug(defaultSlug("!!", "??", 2))).toBe(true);
  });
});

describe("randomSlug", () => {
  it("is a random slug and never a custom one", () => {
    for (let i = 0; i < 500; i++) {
      const slug = randomSlug();
      expect(isRandomSlug(slug)).toBe(true);
      expect(isCustomSlug(slug)).toBe(false);
    }
  });

  it("is different every time", () => {
    expect(new Set(Array.from({ length: 50 }, randomSlug)).size).toBe(50);
  });
});

describe("isRandomSlug", () => {
  it("needs 22 URL-safe characters including an uppercase letter", () => {
    expect(isRandomSlug("Abcdefghijklmnopqrstuv")).toBe(true);
    expect(isRandomSlug("abcdefghijklmnopqrstuv")).toBe(false);
    expect(isRandomSlug("Abcdefghijklmnopqrstu")).toBe(false);
    expect(isRandomSlug("Abcdefghijklmnopqrstu!")).toBe(false);
  });
});
