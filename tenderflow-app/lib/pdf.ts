// Local PDF parsing — per-page text via pdfjs-dist (Mozilla, Apache-2.0).
// No external service. Scanned PDFs (no extractable text) are flagged so
// the UI can say so instead of inventing content.

export interface ParsedPage {
  page_no: number;
  text: string;
  char_count: number;
}

export interface ParsedPdf {
  page_count: number;
  pages: ParsedPage[];
  scanned: boolean;
  total_chars: number;
}

export async function parsePdf(buffer: Buffer): Promise<ParsedPdf> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data, useWorkerFetch: false }).promise;
  const pages: ParsedPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push({ page_no: n, text, char_count: text.length });
  }
  await doc.cleanup();
  const total_chars = pages.reduce((s, p) => s + p.char_count, 0);
  return { page_count: pages.length, pages, total_chars, scanned: total_chars < 50 };
}
