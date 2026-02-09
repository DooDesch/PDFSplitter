import { PDFDocument } from "pdf-lib";

/**
 * Loads a PDF from buffer and splits it into one PDF per page.
 * Returns an array of buffers, each containing a single-page PDF.
 * Works in Node and browser (Uint8Array / ArrayBuffer).
 */
export async function splitPdfByPages(
  pdfBuffer: Uint8Array | ArrayBuffer
): Promise<Uint8Array[]> {
  const bytes = pdfBuffer instanceof ArrayBuffer ? new Uint8Array(pdfBuffer) : pdfBuffer;
  const sourceDoc = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
  });
  const pageCount = sourceDoc.getPageCount();
  const result: Uint8Array[] = [];

  for (let i = 0; i < pageCount; i++) {
    const newDoc = await PDFDocument.create();
    const [copiedPage] = await newDoc.copyPages(sourceDoc, [i]);
    newDoc.addPage(copiedPage);
    const pdfBytes = await newDoc.save();
    result.push(new Uint8Array(pdfBytes));
  }

  return result;
}
