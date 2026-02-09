import { PDFDocument } from "pdf-lib";

export interface SplitProgressCallback {
  (current: number, total: number): void;
}

/**
 * Returns the number of pages in a PDF without fully processing it.
 * Uses pdf-lib; fast way to get page count for progress UI.
 */
export async function getPdfPageCount(
  pdfBuffer: Uint8Array | ArrayBuffer
): Promise<number> {
  const bytes =
    pdfBuffer instanceof ArrayBuffer ? new Uint8Array(pdfBuffer) : pdfBuffer;
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

/**
 * Loads a PDF from buffer and splits it into one PDF per page.
 * Returns an array of buffers, each containing a single-page PDF.
 * Works in Node and browser (Uint8Array / ArrayBuffer).
 * Optional onProgress(current, total) is called after each page is split.
 */
export async function splitPdfByPages(
  pdfBuffer: Uint8Array | ArrayBuffer,
  options?: { onProgress?: SplitProgressCallback }
): Promise<Uint8Array[]> {
  const bytes =
    pdfBuffer instanceof ArrayBuffer ? new Uint8Array(pdfBuffer) : pdfBuffer;
  const sourceDoc = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
  });
  const pageCount = sourceDoc.getPageCount();
  const result: Uint8Array[] = [];
  const onProgress = options?.onProgress;

  for (let i = 0; i < pageCount; i++) {
    const newDoc = await PDFDocument.create();
    const [copiedPage] = await newDoc.copyPages(sourceDoc, [i]);
    newDoc.addPage(copiedPage);
    const pdfBytes = await newDoc.save();
    result.push(new Uint8Array(pdfBytes));
    onProgress?.(i + 1, pageCount);
  }

  return result;
}
