// pdf-parse is CJS; load via dynamic import to avoid createRequire/import.meta in build
type PdfParseFn = (buffer: Buffer) => Promise<{ text: string }>;
let cached: PdfParseFn | null = null;

async function getPdfParse(): Promise<PdfParseFn> {
  if (cached) return cached;
  const m = await import("pdf-parse");
  const fn = (m.default ?? m) as PdfParseFn;
  cached = fn;
  return fn;
}

/**
 * Extracts raw text from a single PDF buffer (e.g. one page).
 */
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  const parse = await getPdfParse();
  const data = await parse(pdfBuffer);
  return data.text ?? "";
}
