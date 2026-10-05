import { describe, expect, it } from "vitest";

import { buildResultsXml, type ExportRow } from "./build-xml";

const row = (overrides: Partial<ExportRow> = {}): ExportRow => ({
  athleteNo: 7409,
  fullName: "Jan van der Merwe",
  swimTime: "00:56.12",
  runTime: "01:47.03",
  ...overrides,
});

describe("buildResultsXml", () => {
  it("emits the declaration and a results root with the xsi namespace", () => {
    const xml = buildResultsXml([]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(
      '<results xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    );
  });

  it("writes every field of a complete row", () => {
    const xml = buildResultsXml([row()]);
    expect(xml).toContain("<athleteNo>7409</athleteNo>");
    expect(xml).toContain("<swimtime>00:56.12</swimtime>");
    expect(xml).toContain("<runtime>01:47.03</runtime>");
    expect(xml).toContain("<athleteName>Jan van der Merwe</athleteName>");
  });

  it("emits an explicit empty pair for a missing run time", () => {
    const xml = buildResultsXml([row({ runTime: null })]);
    expect(xml).toContain("<runtime></runtime>");
    expect(xml).not.toContain("<runtime/>");
  });

  it("emits an explicit empty pair for a missing swim time", () => {
    const xml = buildResultsXml([row({ swimTime: null })]);
    expect(xml).toContain("<swimtime></swimtime>");
    expect(xml).not.toContain("<swimtime/>");
  });

  it("repeats the full name in athleteSurname", () => {
    const xml = buildResultsXml([row()]);
    expect(xml).toContain("<athleteSurname>Jan van der Merwe</athleteSurname>");
  });

  it("orders the fields athleteNo, athleteName, athleteSurname, runtime, swimtime", () => {
    const xml = buildResultsXml([row()]);
    const order = [
      "<athleteNo>",
      "<athleteName>",
      "<athleteSurname>",
      "<runtime>",
      "<swimtime>",
    ].map((tag) => xml.indexOf(tag));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i >= 0)).toBe(true);
  });

  it("exports a recorded time regardless of status", () => {
    // A DQ'd athlete's time is passed through as recorded; the XML carries
    // no status and the operator strips such rows by hand.
    const xml = buildResultsXml([row({ athleteNo: 42 })]);
    expect(xml).toContain("<runtime>01:47.03</runtime>");
  });

  it("escapes characters that would otherwise malform the file", () => {
    const xml = buildResultsXml([
      row({ fullName: "Renée Müller & Sons <test>" }),
    ]);
    expect(xml).toContain("Renée Müller &amp; Sons &lt;test&gt;");
    expect(xml).not.toContain("& Sons");
  });

  it("preserves the order it is given", () => {
    const xml = buildResultsXml([
      row({ athleteNo: 1 }),
      row({ athleteNo: 2 }),
      row({ athleteNo: 3 }),
    ]);
    expect(xml.indexOf("<athleteNo>1<")).toBeLessThan(
      xml.indexOf("<athleteNo>2<"),
    );
    expect(xml.indexOf("<athleteNo>2<")).toBeLessThan(
      xml.indexOf("<athleteNo>3<"),
    );
  });

  it("emits one result element per row", () => {
    const xml = buildResultsXml([row({ athleteNo: 1 }), row({ athleteNo: 2 })]);
    expect(xml.match(/<result>/g)).toHaveLength(2);
  });
});
