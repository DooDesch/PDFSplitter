/**
 * Regression test: example PDF must produce one valid, non-empty PDF per page.
 *
 * Expected page count comes from pdf-lib only (getPdfPageCount), not from our
 * processing logic – so we never "bake in" broken results. Every page buffer must
 * be non-empty and a valid PDF; otherwise the test fails.
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";
import {
  processPdfToPages,
  getPdfPageCount,
} from "@pdf-splitter/pdf-processor";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Repo root: packages/pdf-processor/__tests__ -> pdf-processor -> packages -> root
const repoRoot = join(__dirname, "..", "..", "..");
const examplePdfPath = join(
  repoRoot,
  "examples",
  "Muster-Baulohnabrechnung.pdf",
);

/** Minimum size for a single-page PDF (avoids "empty" or placeholder output). */
const MIN_PAGE_PDF_BYTES = 500;

describe("example PDF (Muster-Baulohnabrechnung.pdf)", () => {
  it("produces one non-empty, valid PDF per page (expected count from pdf-lib)", async () => {
    if (!existsSync(examplePdfPath)) {
      throw new Error(
        `Example PDF not found at ${examplePdfPath}. Run tests from repo root.`,
      );
    }

    const pdfBuffer = new Uint8Array(readFileSync(examplePdfPath));

    // Independent source of truth: page count from pdf-lib only, not our processing.
    // Use copies so buffers are not transferred/mutated by pdf-lib or pdfjs.
    const expectedPageCount = await getPdfPageCount(new Uint8Array(pdfBuffer));
    expect(expectedPageCount).toBeGreaterThan(0);

    const pages = await processPdfToPages(new Uint8Array(pdfBuffer));

    // #region agent log
    const lengths = pages.map((p) => p.buffer.length);
    fetch('http://127.0.0.1:7245/ingest/e3185b0b-ed05-469a-9e26-71acea8e6545',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'example-pdf.integration.test.ts',message:'integration test page buffer lengths',data:{expectedPageCount,pagesLength:pages.length,bufferLengths:lengths},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    expect(pages.length).toBe(expectedPageCount);

    for (let i = 0; i < pages.length; i++) {
      const { buffer, filename } = pages[i]!;
      expect(
        buffer.length,
        `Page ${i + 1} must not be 0 bytes (got ${buffer.length})`,
      ).toBeGreaterThan(0);
      expect(
        buffer.length,
        `Page ${i + 1} must be a real PDF (min ${MIN_PAGE_PDF_BYTES} bytes, got ${buffer.length})`,
      ).toBeGreaterThanOrEqual(MIN_PAGE_PDF_BYTES);

      const header = String.fromCharCode(...buffer.slice(0, 5));
      expect(header, `Page ${i + 1} buffer must start with %PDF-`).toBe(
        "%PDF-",
      );

      expect(filename.length).toBeGreaterThan(0);
      expect(filename.endsWith(".pdf")).toBe(true);
    }
  });
});
