import * as pdfjs from "pdfjs-dist";

// Call this from the app before processPdfToPages (e.g. in browser: set worker URL from public/ or CDN).
export function setPdfWorkerSrc(src: string): void {
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = src;
  }
}

/**
 * Extracts raw text from a single PDF buffer (e.g. one page).
 * Uses pdfjs-dist; in browser, call setPdfWorkerSrc() once before first use.
 */
export async function extractTextFromPdf(pdfBuffer: Uint8Array): Promise<string> {
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
