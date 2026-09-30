import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { AGE_GROUP_LABELS, parseAgeGroup } from "@/lib/import/age-group";

// The 2027 points table is data in a migration, so read it from there.
const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260930230000_public_results_points.sql",
  ),
  "utf8",
);

interface Row {
  gender: string;
  code: string;
  runBase: string;
  swimBase: string;
  swimRate: number;
}

const rows: Row[] = [
  ...migration.matchAll(
    /\('2026-05-01', '([MF])', '(\w+)',\s*'[^']*',\s*\d+,\s*\d+,\s*\d+,\s*\d+, '([\d:.]+)', (\d+),\s*\d+, '([\d:.]+)',\s*(\d+),/g,
  ),
].map((m) => ({
  gender: m[1],
  code: m[2],
  runBase: m[3],
  swimBase: m[5],
  swimRate: Number(m[6]),
}));

const find = (gender: string, code: string) =>
  rows.find((r) => r.gender === gender && r.code === code);

describe("the 2027 points table", () => {
  it("has a row for every age group in the start list import", () => {
    expect(rows).toHaveLength(30);
    for (const label of AGE_GROUP_LABELS) {
      const parsed = parseAgeGroup(label);
      expect(parsed, label).not.toBeNull();
      expect(find(parsed!.gender, parsed!.code), label).toBeDefined();
    }
  });

  it("matches the PDF's times for 1,000 points", () => {
    // Spot checks read off Age Group & Points Table 2027 (1).pdf.
    expect(find("M", "U15")).toMatchObject({
      runBase: "02:47.00",
      swimBase: "01:13.00",
    });
    expect(find("F", "SEN")).toMatchObject({
      runBase: "03:06.00",
      swimBase: "01:25.00",
    });
    expect(find("F", "M80")).toMatchObject({
      runBase: "02:37.00",
      swimBase: "01:10.00",
    });
    expect(find("M", "SN")).toMatchObject({
      runBase: "02:00.00",
      swimBase: "00:45.00",
    });
  });

  it("scores swimming at 5 points a second, except U/13 at 10", () => {
    for (const row of rows) {
      expect(row.swimRate, `${row.gender}/${row.code}`).toBe(
        row.code === "U13" ? 10 : 5,
      );
    }
  });
});
