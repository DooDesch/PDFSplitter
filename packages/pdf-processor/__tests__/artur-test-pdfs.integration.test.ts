/**
 * Integration tests using ArturT/Test-PDF-Files:
 * not_encrypted.pdf, encrypted.pdf (password: kanbanery), corrupted.pdf.
 * Tests are skipped if the fixture files are missing (e.g. not downloaded).
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";
import {
  processPdfToPages,
  getPdfPageCount,
  splitPdfByPages,
  getDecryptedPdfBytes,
} from "@pdf-splitter/pdf-processor";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const repoRoot = join(__dirname, "..", "..", "..");
const testPdfsDir = join(repoRoot, "examples", "test-pdfs");

const MIN_PAGE_PDF_BYTES = 500;

function pdfPath(name: string): string {
  return join(testPdfsDir, name);
}

describe("ArturT test PDFs (not_encrypted.pdf)", () => {
  const path = pdfPath("not_encrypted.pdf");

  it("getPdfPageCount and processPdfToPages succeed without password", async () => {
    if (!existsSync(path)) return;
    const pdfBuffer = new Uint8Array(readFileSync(path));
    const pageCount = await getPdfPageCount(new Uint8Array(pdfBuffer));
    expect(pageCount).toBeGreaterThan(0);

    const pages = await processPdfToPages(new Uint8Array(pdfBuffer));
    expect(pages.length).toBe(pageCount);
    for (let i = 0; i < pages.length; i++) {
      const { buffer, filename } = pages[i]!;
      expect(buffer.length).toBeGreaterThanOrEqual(MIN_PAGE_PDF_BYTES);
      expect(String.fromCharCode(...buffer.slice(0, 5))).toBe("%PDF-");
      expect(filename.endsWith(".pdf")).toBe(true);
    }
  });
});

describe("ArturT test PDFs (encrypted.pdf)", () => {
  const path = pdfPath("encrypted.pdf");
  const password = "kanbanery";

  it("getPdfPageCount and splitPdfByPages succeed with correct password", async () => {
    if (!existsSync(path)) return;
    const pdfBuffer = new Uint8Array(readFileSync(path));
    const pageCount = await getPdfPageCount(new Uint8Array(pdfBuffer), {
      password,
    });
    expect(pageCount).toBeGreaterThan(0);

    const result = await splitPdfByPages(new Uint8Array(pdfBuffer), {
      password,
    });
    expect(result.length).toBe(pageCount);
    for (const buf of result) {
      expect(buf.length).toBeGreaterThan(0);
      expect(String.fromCharCode(...buf.slice(0, 5))).toBe("%PDF-");
    }
  });

  it("getDecryptedPdfBytes throws with wrong password", async () => {
    if (!existsSync(path)) return;
    const pdfBuffer = new Uint8Array(readFileSync(path));
    await expect(
      getDecryptedPdfBytes(new Uint8Array(pdfBuffer), "wrongpassword"),
    ).rejects.toThrow();
  });
});

describe("ArturT test PDFs (corrupted.pdf)", () => {
  const path = pdfPath("corrupted.pdf");

  it("getPdfPageCount throws on corrupted PDF", async () => {
    if (!existsSync(path)) return;
    const pdfBuffer = new Uint8Array(readFileSync(path));
    await expect(getPdfPageCount(new Uint8Array(pdfBuffer))).rejects.toThrow();
  });
});
