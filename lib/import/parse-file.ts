import Papa from "papaparse";
import ExcelJS from "exceljs";

/**
 * Reads an uploaded entry list (CSV or XLSX) into header-keyed string rows,
 * ready for parseEntryRows. Cell values are stringified so downstream
 * parsing (parseEntryRows) has one input shape regardless of source format.
 */
export async function parseUploadedEntryFile(
  file: File,
): Promise<Record<string, string>[]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv")) {
    const text = await file.text();
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    return result.data;
  }

  if (name.endsWith(".xlsx")) {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];

    const rows: Record<string, string>[] = [];
    let headers: string[] = [];
    worksheet.eachRow((row, rowNumber) => {
      const values = row.values as (string | number | null | undefined)[];
      // ExcelJS row.values is 1-indexed with values[0] undefined.
      const cells = values
        .slice(1)
        .map((v) => (v === null || v === undefined ? "" : String(v)));
      if (rowNumber === 1) {
        headers = cells;
        return;
      }
      const record: Record<string, string> = {};
      headers.forEach((header, i) => {
        record[header] = cells[i] ?? "";
      });
      rows.push(record);
    });
    return rows;
  }

  throw new Error(
    `Unsupported file type: ${file.name}. Expected .csv or .xlsx.`,
  );
}
