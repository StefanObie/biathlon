import { create } from "xmlbuilder2";

export interface ExportRow {
  athleteNo: number;
  fullName: string;
  swimTime: string | null;
  runTime: string | null;
}

/**
 * Builds the SA Biathlon results XML (spec §4.7).
 *
 * Times pass through verbatim — both columns already store canonical
 * `mm:SS.ss`, so there is no formatting step to get wrong.
 *
 * `athleteName` and `athleteSurname` both carry the whole `full_name`: the
 * SA Biathlon import needs a non-empty surname, and a split the source data
 * can't support (spec §6.1, "Van Der Merwe") is not invented here.
 *
 * Status (dns/dnf/dq) is deliberately not consulted — a recorded time is
 * exported as recorded, and anything that should not reach SA Biathlon is
 * removed from the file by hand.
 */
export function buildResultsXml(rows: ExportRow[]): string {
  const doc = create({ version: "1.0", encoding: "UTF-8" }).ele("results", {
    "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
  });

  for (const row of rows) {
    doc
      .ele("result")
      .ele("athleteNo")
      .txt(String(row.athleteNo))
      .up()
      .ele("athleteName")
      .txt(row.fullName)
      .up()
      .ele("athleteSurname")
      .txt(row.fullName)
      .up()
      .ele("runtime")
      .txt(row.runTime ?? "")
      .up()
      .ele("swimtime")
      .txt(row.swimTime ?? "")
      .up()
      .up();
  }

  // allowEmptyTags keeps missing times as <runtime></runtime> rather than
  // the self-closing <runtime/>. Identical to a conformant parser, but the
  // explicit pair is the safer shape for club-level software downstream.
  return doc.end({ prettyPrint: true, allowEmptyTags: true });
}
