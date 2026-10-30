/**
 * The text of an uploaded age file, one row per line, ready for parseAgeFile.
 * It runs in the browser, so the file and its names never reach the server. A
 * real age file is a PDF printed from the entry system, so a PDF's lines are
 * rebuilt from where each piece of text sits on the page.
 */
export async function readAgeFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".csv")) return file.text();
  if (!name.endsWith(".pdf")) {
    throw new Error(
      `Unsupported file type: ${file.name}. Expected .pdf, .csv or .txt.`,
    );
  }

  const { getDocument, GlobalWorkerOptions } =
    await import("pdfjs-dist/legacy/build/pdf.mjs");
  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const pdf = await getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise;
  const lines: string[] = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const { items } = await page.getTextContent();
    const rows = new Map<number, { x: number; text: string }[]>();
    for (const item of items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const [, , , , x, y] = item.transform as number[];
      const row = Math.round(y);
      rows.set(row, [...(rows.get(row) ?? []), { x, text: item.str }]);
    }
    const topDown = [...rows.keys()].sort((a, b) => b - a);
    for (const row of topDown) {
      const cells = rows.get(row)!.sort((a, b) => a.x - b.x);
      lines.push(cells.map((cell) => cell.text).join("\t"));
    }
  }
  await pdf.destroy();
  return lines.join("\n");
}
