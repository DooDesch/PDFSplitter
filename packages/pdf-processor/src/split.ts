import { PDFDocument } from "pdf-lib";
import {
  getDecryptedPdfBytes,
  getPdfPageCountWithPassword,
  isBrowser,
} from "./extract-text.js";
import { splitEncryptedPdfByPagesInBrowser } from "./split-encrypted-browser.js";

export interface SplitProgressCallback {
  (current: number, total: number): void;
}

function isEncryptedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /encrypted/i.test(msg);
}

/**
 * Load bytes with pdf-lib. When password was used, try without ignoreEncryption first;
 * if pdf-lib still reports encrypted (e.g. PDF.js getData() returned raw bytes), fall back to ignoreEncryption.
 */
async function loadPdfDoc(
  bytes: Uint8Array,
  usedPassword: boolean,
): Promise<Awaited<ReturnType<typeof PDFDocument.load>>> {
  try {
    return await PDFDocument.load(bytes, {
      ...(usedPassword ? {} : { ignoreEncryption: true }),
    });
  } catch (err) {
    if (usedPassword && isEncryptedError(err)) {
      return PDFDocument.load(bytes, { ignoreEncryption: true });
    }
    throw err;
  }
}

/**
 * Returns the number of pages in a PDF without fully processing it.
 * Uses pdf-lib; fast way to get page count for progress UI.
 * When password is provided, decrypts via PDF.js first then uses pdf-lib on the result.
 */
export async function getPdfPageCount(
  pdfBuffer: Uint8Array | ArrayBuffer,
  options?: { password?: string },
): Promise<number> {
  const bytes =
    pdfBuffer instanceof ArrayBuffer ? new Uint8Array(pdfBuffer) : pdfBuffer;
  const usedPassword =
    options?.password !== undefined && options.password !== "";
  if (usedPassword) {
    return getPdfPageCountWithPassword(bytes, options.password!);
  }
  const doc = await loadPdfDoc(bytes, false);
  return doc.getPageCount();
}

/**
 * Loads a PDF from buffer and splits it into one PDF per page.
 * Returns an array of buffers, each containing a single-page PDF.
 * Works in Node and browser (Uint8Array / ArrayBuffer).
 * When password is provided, decrypts via PDF.js then uses pdf-lib (with ignoreEncryption fallback if needed).
 * Optional onProgress(current, total) is called after each page is split.
 */
export async function splitPdfByPages(
  pdfBuffer: Uint8Array | ArrayBuffer,
  options?: { password?: string; onProgress?: SplitProgressCallback },
): Promise<Uint8Array[]> {
  const bytes =
    pdfBuffer instanceof ArrayBuffer ? new Uint8Array(pdfBuffer) : pdfBuffer;
  const usedPassword =
    options?.password !== undefined && options.password !== "";
  const onProgress = options?.onProgress;

  if (usedPassword) {
    try {
      return await splitEncryptedPdfByPagesInBrowser(
        bytes,
        options.password!,
        onProgress,
      );
    } catch (err) {
      // In browser, getData() returns encrypted bytes so fallback produces blank pages; only fall back in Node.
      if (isBrowser()) throw err;
      // No DOM (Node): fall back to getData + pdf-lib.
    }
  }

  let loadBytes = bytes;
  if (usedPassword) {
    loadBytes = await getDecryptedPdfBytes(bytes, options.password!);
  }
  const sourceDoc = await loadPdfDoc(loadBytes, usedPassword);
  const pageCount = sourceDoc.getPageCount();
  const result: Uint8Array[] = [];

  for (let i = 0; i < pageCount; i++) {
    const newDoc = await PDFDocument.create();
    const [copiedPage] = await newDoc.copyPages(sourceDoc, [i]);
    newDoc.addPage(copiedPage);
    const pdfBytes = await newDoc.save({ useObjectStreams: false });
    result.push(new Uint8Array(pdfBytes));
    onProgress?.(i + 1, pageCount);
  }

  return result;
}
