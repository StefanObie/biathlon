import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import type { ExportRow } from "./build-xml";
import { buildResultsXlsx } from "./build-xlsx";

const row = (overrides: Partial<ExportRow> = {}): ExportRow => ({
  athleteNo: 7409,
  fullName: "Jan van der Merwe",
  swimTime: "00:56.12",
  runTime: "01:47.03",
  ...overrides,
});

async function read(rows: ExportRow[]) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await buildResultsXlsx(rows)) as never);
  return workbook.worksheets[0];
}

describe("buildResultsXlsx", () => {
  it("writes a bold header row in the XML field order", async () => {
    const sheet = await read([]);
    const header = sheet.getRow(1);
    expect(header.values).toEqual([
      undefined,
      "athleteNo",
      "athleteName",
      "athleteSurname",
      "runtime",
      "swimtime",
    ]);
    header.eachCell((cell) => expect(cell.font?.bold).toBe(true));
  });

  it("writes a row as text, repeating the full name as the surname", async () => {
    const sheet = await read([row()]);
    expect(sheet.getRow(2).values).toEqual([
      undefined,
      "7409",
      "Jan van der Merwe",
      "Jan van der Merwe",
      "01:47.03",
      "00:56.12",
    ]);
  });

  it("leaves a missing time as an empty text cell", async () => {
    const sheet = await read([row({ runTime: null, swimTime: null })]);
    expect(sheet.getRow(2).getCell(4).value ?? "").toBe("");
    expect(sheet.getRow(2).getCell(5).value ?? "").toBe("");
  });

  it("preserves the order it is given", async () => {
    const sheet = await read([row({ athleteNo: 1 }), row({ athleteNo: 2 })]);
    expect(sheet.getRow(2).getCell(1).value).toBe("1");
    expect(sheet.getRow(3).getCell(1).value).toBe("2");
  });

  it("applies no formatting beyond the bold header", async () => {
    const sheet = await read([row()]);
    expect(sheet.views ?? []).toEqual([]);
    expect(sheet.autoFilter).toBeUndefined();
    expect(sheet.getRow(2).getCell(1).font?.bold).toBeFalsy();
  });
});
