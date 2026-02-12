// Lazy-loaded in Node (legacy build) vs browser (default build) to avoid DOMMatrix etc. in Node.
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

interface GetDocumentOpts {
  data: Uint8Array;
  standardFontDataUrl?: string;
  password?: string;
  disableFontFace?: boolean;
  /** 0 = errors only, 1 = warnings (default). In Node we use 0 to avoid font-load stderr. */
  verbosity?: number;
}

interface PdfJsLib {
  getDocument(opts: GetDocumentOpts): { promise: Promise<PdfDocument> };
  GlobalWorkerOptions?: { workerSrc: string };
}
interface PdfDocument {
  numPages: number;
  getPage(
    i: number,
  ): Promise<{ getTextContent(): Promise<{ items: Array<{ str?: string }> }> }>;
}

let pdfjsModule: PdfJsLib | null = null;
let pendingWorkerSrc: string | null = null;
let nodeStandardFontDataUrl: string | null = null;

export function isBrowser(): boolean {
  return typeof globalThis !== "undefined" && "window" in globalThis;
}

/** File URL to pdfjs-dist standard_fonts/ for Node (trailing slash). Used with disableFontFace so fonts are not actually fetched. */
async function getNodeStandardFontDataUrl(): Promise<string> {
  if (nodeStandardFontDataUrl) return nodeStandardFontDataUrl;
  let pdfjsPkgPath: string;
  const g =
    typeof globalThis !== "undefined"
      ? globalThis
      : typeof global !== "undefined"
        ? (global as object)
        : {};
  const req = (g as { require?: NodeRequire }).require;
  if (typeof req?.resolve === "function") {
    pdfjsPkgPath = req.resolve("pdfjs-dist/package.json");
  } else if (typeof globalThis !== "undefined" && !("window" in globalThis)) {
    const { createRequire } = await import("node:module");
    pdfjsPkgPath = createRequire(import.meta.url).resolve(
      "pdfjs-dist/package.json",
    );
  } else {
    throw new Error("getNodeStandardFontDataUrl is Node-only");
  }
  const standardFontsDir = join(dirname(pdfjsPkgPath), "standard_fonts");
  nodeStandardFontDataUrl = pathToFileURL(standardFontsDir).href + "/";
  return nodeStandardFontDataUrl;
}

export async function getPdfJs(): Promise<PdfJsLib> {
  if (pdfjsModule) return pdfjsModule;
  if (!isBrowser()) {
    pdfjsModule = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as PdfJsLib;
  } else {
    pdfjsModule = (await import("pdfjs-dist")) as PdfJsLib;
  }
  if (pendingWorkerSrc && pdfjsModule.GlobalWorkerOptions) {
    pdfjsModule.GlobalWorkerOptions.workerSrc = pendingWorkerSrc;
  }
  return pdfjsModule;
}

// Call this from the app before processPdfToPages (e.g. in browser: set worker URL from public/ or CDN).
export function setPdfWorkerSrc(src: string): void {
  pendingWorkerSrc = src;
  if (pdfjsModule?.GlobalWorkerOptions) {
    pdfjsModule.GlobalWorkerOptions.workerSrc = src;
  }
}

/** Returns page count for a password-protected PDF by loading it with PDF.js (decrypted in memory). */
export async function getPdfPageCountWithPassword(
  pdfBuffer: Uint8Array,
  password: string,
): Promise<number> {
  const pdfjs = await getPdfJs();
  const opts: GetDocumentOpts = { data: new Uint8Array(pdfBuffer), password };
  if (!isBrowser()) {
    opts.disableFontFace = true;
    opts.standardFontDataUrl = await getNodeStandardFontDataUrl();
    opts.verbosity = 0;
  }
  const doc = await pdfjs.getDocument(opts).promise;
  return doc.numPages;
}

/** True if opening the PDF without a password fails with "password required" / encrypted. Call setPdfWorkerSrc() before use in browser. */
export async function checkPdfNeedsPassword(pdfBuffer: Uint8Array): Promise<boolean> {
  const pdfjs = await getPdfJs();
  const opts: GetDocumentOpts = { data: new Uint8Array(pdfBuffer) };
  if (!isBrowser()) {
    opts.disableFontFace = true;
    opts.standardFontDataUrl = await getNodeStandardFontDataUrl();
    opts.verbosity = 0;
  }
  try {
    await pdfjs.getDocument(opts).promise;
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    const wrongPw =
      lower.includes("wrong password") ||
      lower.includes("invalid password") ||
      lower.includes("incorrect password");
    const encrypted = /encrypted/i.test(msg);
    const required =
      lower.includes("password") &&
      (lower.includes("required") ||
        lower.includes("needed") ||
        lower.includes("given") ||
        lower.includes("no password"));
    return wrongPw || encrypted || required;
  }
}

/**
 * Loads a password-protected PDF with PDF.js and returns bytes for pdf-lib.
 * In PDF.js, getData() is on the loading task (not the document). It returns
 * the raw data of the document; after successful password unlock the transport
 * may expose decrypted data. Throws if password is wrong or getData is not available.
 */
export async function getDecryptedPdfBytes(
  pdfBuffer: Uint8Array,
  password: string,
): Promise<Uint8Array> {
  const pdfjs = await getPdfJs();
  // Pass a copy so PDF.js worker transfer does not detach the caller's buffer.
  const opts: GetDocumentOpts = { data: new Uint8Array(pdfBuffer), password };
  if (!isBrowser()) {
    opts.disableFontFace = true;
    opts.standardFontDataUrl = await getNodeStandardFontDataUrl();
    opts.verbosity = 0;
  }
  const loadingTask = pdfjs.getDocument(opts);
  await loadingTask.promise;
  const task = loadingTask as unknown as {
    getData?: () => Promise<Uint8Array>;
  };
  if (typeof task.getData !== "function") {
    throw new Error(
      "Password-protected PDFs cannot be split: getData is not available in this build.",
    );
  }
  const out = await task.getData();
  return out;
}

/**
 * Extracts raw text from a single PDF buffer (e.g. one page).
 * Uses pdfjs-dist; in browser, call setPdfWorkerSrc() once before first use.
 * In Node, uses pdfjs-dist legacy build (no worker required).
 */
export async function extractTextFromPdf(
  pdfBuffer: Uint8Array,
  options?: { password?: string },
): Promise<string> {
  const pdfjs = await getPdfJs();
  // Pass a copy so PDF.js worker transfer does not detach the caller's buffer.
  const getDocumentOpts: GetDocumentOpts = {
    data: new Uint8Array(pdfBuffer),
    ...(options?.password !== undefined && options.password !== ""
      ? { password: options.password }
      : {}),
  };
  if (!isBrowser()) {
    getDocumentOpts.disableFontFace = true;
    getDocumentOpts.standardFontDataUrl = await getNodeStandardFontDataUrl();
    getDocumentOpts.verbosity = 0;
  }
  const doc = await pdfjs.getDocument(getDocumentOpts).promise;
  const numPages = doc.numPages;
  const parts: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    parts.push(pageText);
  }

  return parts.join("\n");
}
