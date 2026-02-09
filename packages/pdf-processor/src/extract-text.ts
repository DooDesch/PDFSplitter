// Lazy-loaded in Node (legacy build) vs browser (default build) to avoid DOMMatrix etc. in Node.
interface PdfJsLib {
  getDocument(opts: { data: Uint8Array }): { promise: Promise<PdfDocument> };
  GlobalWorkerOptions?: { workerSrc: string };
}
interface PdfDocument {
  numPages: number;
  getPage(i: number): Promise<{ getTextContent(): Promise<{ items: Array<{ str?: string }> }> }>;
}

let pdfjsModule: PdfJsLib | null = null;
let pendingWorkerSrc: string | null = null;

function isBrowser(): boolean {
  return typeof globalThis !== "undefined" && "window" in globalThis;
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
export async function extractTextFromPdf(pdfBuffer: Uint8Array): Promise<string> {
  const pdfjs = await getPdfJs();
  const doc = await pdfjs.getDocument({ data: pdfBuffer }).promise;
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
