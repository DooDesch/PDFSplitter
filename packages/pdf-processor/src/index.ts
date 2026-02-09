import { splitPdfByPages, getPdfPageCount } from "./split.js";
import { extractTextFromPdf, setPdfWorkerSrc } from "./extract-text.js";
import {
  parseRecipientFromText,
  buildSafeFilename,
  type Recipient,
} from "./recipient-from-text.js";

export type { Recipient };
export {
  splitPdfByPages,
  getPdfPageCount,
  extractTextFromPdf,
  setPdfWorkerSrc,
  parseRecipientFromText,
  buildSafeFilename,
};

export type ProgressPhase = "splitting" | "processing";

export interface ProcessPdfProgressCallback {
  (phase: ProgressPhase, current: number, total: number): void;
}

export interface ProcessedPage {
  buffer: Uint8Array;
  filename: string;
  pageIndex: number;
}

/**
 * Loads a PDF buffer, splits by page, extracts text from each page,
 * derives a filename from recipient heuristics, and returns one entry per page.
 * Works in Node and browser (Uint8Array / ArrayBuffer).
 * Optional onProgress(phase, current, total) reports progress for UI.
 */
export async function processPdfToPages(
  pdfBuffer: Uint8Array | ArrayBuffer,
  options?: { onProgress?: ProcessPdfProgressCallback },
): Promise<ProcessedPage[]> {
  const onProgress = options?.onProgress;

  const pageBuffers = await splitPdfByPages(pdfBuffer, {
    onProgress: (current, pageTotal) =>
      onProgress?.("splitting", current, pageTotal),
  });
  const pageTotal = pageBuffers.length;
  const result: ProcessedPage[] = [];

  for (let i = 0; i < pageBuffers.length; i++) {
    onProgress?.("processing", i, pageTotal);
    const buffer = pageBuffers[i]!;
    // Pass a copy to extractTextFromPdf so pdfjs getDocument() does not transfer/mutate the buffer.
    const text = await extractTextFromPdf(new Uint8Array(buffer));
    const recipient = parseRecipientFromText(text);
    const filename = buildSafeFilename(recipient, i);
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/e3185b0b-ed05-469a-9e26-71acea8e6545',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:before push',message:'processPdfToPages buffer',data:{pageIndex:i,bufferLength:buffer.length,bufferByteLength:buffer.byteLength},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    result.push({ buffer, filename, pageIndex: i });
  }
  onProgress?.("processing", pageTotal, pageTotal);

  return result;
}
