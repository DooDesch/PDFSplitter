import { splitPdfByPages, getPdfPageCount } from "./split.js";
import {
  extractTextFromPdf,
  getDecryptedPdfBytes,
  setPdfWorkerSrc,
  checkPdfNeedsPassword,
} from "./extract-text.js";
import {
  parseRecipientFromText,
  buildSafeFilename,
  type Recipient,
} from "./recipient-from-text.js";
import {
  processPdfToPages,
  type ProgressPhase,
  type ProcessPdfProgressCallback,
  type ProcessedPage,
} from "./process-pdf-to-pages.js";

export type { Recipient };
export type { ProgressPhase, ProcessPdfProgressCallback, ProcessedPage };
export {
  splitPdfByPages,
  getPdfPageCount,
  extractTextFromPdf,
  getDecryptedPdfBytes,
  setPdfWorkerSrc,
  checkPdfNeedsPassword,
  parseRecipientFromText,
  buildSafeFilename,
  processPdfToPages,
};
