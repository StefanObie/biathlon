import ExcelJS from "exceljs";

import type { ExportRow } from "@/lib/export/build-xml";

const HEADERS = [
  "athleteNo",
  "athleteName",
  "athleteSurname",
  "runtime",
  "swimtime",
];

/**
 * Builds the results workbook: the same rows, order and field names as the
 * XML (buildResultsXml), on one plain sheet. Every cell is text, so Excel
 * never reinterprets a `mm:SS.ss` time as a date; only the header is bold.
 */
export async function buildResultsXlsx(rows: ExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Results");

  const header = sheet.addRow(HEADERS);
  header.font = { bold: true };

  for (const row of rows) {
    const added = sheet.addRow([
      String(row.athleteNo),
      row.fullName,
      row.fullName,
      row.runTime ?? "",
      row.swimTime ?? "",
    ]);
    added.eachCell((cell) => {
      cell.numFmt = "@";
    });
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
