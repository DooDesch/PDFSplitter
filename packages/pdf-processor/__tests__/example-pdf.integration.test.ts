/**
 * Regression test: example PDF must always produce the same page count and filenames.
 * Uses examples/Muster-Baulohnabrechnung.pdf and __tests__/fixtures/expected-muster-baulohnabrechnung.json.
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";
import { processPdfToPages } from "@pdf-splitter/pdf-processor";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Repo root: packages/pdf-processor/__tests__ -> pdf-processor -> packages -> root
const repoRoot = join(__dirname, "..", "..", "..");
const examplePdfPath = join(repoRoot, "examples", "Muster-Baulohnabrechnung.pdf");
const expectedPath = join(__dirname, "fixtures", "expected-muster-baulohnabrechnung.json");

describe("example PDF (Muster-Baulohnabrechnung.pdf)", () => {
  it("processPdfToPages produces expected page count and filenames", async () => {
    if (!existsSync(examplePdfPath)) {
      throw new Error(`Example PDF not found at ${examplePdfPath}. Run tests from repo root.`);
    }
    if (!existsSync(expectedPath)) {
      throw new Error(
        `Expected fixture not found at ${expectedPath}. Run: pnpm test:generate-expected`
      );
    }

    const expected = JSON.parse(readFileSync(expectedPath, "utf-8")) as {
      pageCount: number;
      filenames: string[];
    };
    const pdfBuffer = new Uint8Array(readFileSync(examplePdfPath));
    const pages = await processPdfToPages(pdfBuffer);

    expect(pages.length).toBe(expected.pageCount);
    expect(pages.map((p) => p.filename)).toEqual(expected.filenames);
  });

  it("each non-empty page buffer is valid PDF", async () => {
    if (!existsSync(examplePdfPath)) return;
    const pdfBuffer = new Uint8Array(readFileSync(examplePdfPath));
    const pages = await processPdfToPages(pdfBuffer);

    for (const { buffer } of pages) {
      if (buffer.length > 0) {
        const header = String.fromCharCode(...buffer.slice(0, 5));
        expect(header).toBe("%PDF-");
      }
    }
  });
});
