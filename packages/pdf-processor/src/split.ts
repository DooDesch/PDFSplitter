import { PDFDocument } from "pdf-lib";

/**
 * Loads a PDF from buffer and splits it into one PDF per page.
 * Returns an array of buffers, each containing a single-page PDF.
 */
export async function splitPdfByPages(pdfBuffer: Buffer): Promise<Buffer[]> {
  const sourceDoc = await PDFDocument.load(pdfBuffer, {
    ignoreEncryption: true,
  });
  const pageCount = sourceDoc.getPageCount();
  const result: Buffer[] = [];

  for (let i = 0; i < pageCount; i++) {
    const newDoc = await PDFDocument.create();
    const [copiedPage] = await newDoc.copyPages(sourceDoc, [i]);
    newDoc.addPage(copiedPage);
    const pdfBytes = await newDoc.save();
    result.push(Buffer.from(pdfBytes));
  }

  return result;
}
