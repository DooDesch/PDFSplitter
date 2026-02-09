// Lazy-loaded in Node (legacy build) vs browser (default build) to avoid DOMMatrix etc. in Node.
declare const require: NodeRequire;
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

interface PdfJsLib {
  getDocument(opts: { data: Uint8Array; standardFontDataUrl?: string }): {
    promise: Promise<PdfDocument>;
  };
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

function isBrowser(): boolean {
  return typeof globalThis !== "undefined" && "window" in globalThis;
}

/** Resolve file:// URL to pdfjs-dist/standard_fonts/ for Node (trailing slash required). */
function getNodeStandardFontDataUrl(): string {
  if (nodeStandardFontDataUrl) return nodeStandardFontDataUrl;
  const pdfjsPkgPath = require.resolve("pdfjs-dist/package.json");
  const standardFontsDir = join(dirname(pdfjsPkgPath), "standard_fonts");
  nodeStandardFontDataUrl = pathToFileURL(join(standardFontsDir, "/")).href;
  return nodeStandardFontDataUrl;
}

async function getPdfJs(): Promise<PdfJsLib> {
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

/**
 * Extracts raw text from a single PDF buffer (e.g. one page).
 * Uses pdfjs-dist; in browser, call setPdfWorkerSrc() once before first use.
 * In Node, uses pdfjs-dist legacy build (no worker required).
 */
export async function extractTextFromPdf(
  pdfBuffer: Uint8Array,
): Promise<string> {
  const pdfjs = await getPdfJs();
  const getDocumentOpts: { data: Uint8Array; standardFontDataUrl?: string } = {
    data: pdfBuffer,
  };
  if (!isBrowser()) {
    getDocumentOpts.standardFontDataUrl = getNodeStandardFontDataUrl();
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
