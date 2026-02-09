import { splitPdfByPages } from "./split.js";
import { extractTextFromPdf } from "./extract-text.js";
import {
  parseRecipientFromText,
  buildSafeFilename,
  type Recipient,
} from "./recipient-from-text.js";

export type { Recipient };
export { splitPdfByPages, extractTextFromPdf, parseRecipientFromText, buildSafeFilename };

export interface ProcessedPage {
  buffer: Buffer;
  filename: string;
  pageIndex: number;
}

/**
 * Loads a PDF buffer, splits by page, extracts text from each page,
 * derives a filename from recipient heuristics, and returns one entry per page.
 */
export async function processPdfToPages(pdfBuffer: Buffer): Promise<ProcessedPage[]> {
  const pageBuffers = await splitPdfByPages(pdfBuffer);
  const result: ProcessedPage[] = [];

  for (let i = 0; i < pageBuffers.length; i++) {
    const buffer = pageBuffers[i]!;
    const text = await extractTextFromPdf(buffer);
    const recipient = parseRecipientFromText(text);
    const filename = buildSafeFilename(recipient, i);
    result.push({ buffer, filename, pageIndex: i });
  }

  return result;
}
