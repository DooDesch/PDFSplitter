/**
 * Golden PDF integration test: build a 2-page PDF with known content via pdf-lib,
 * run processPdfToPages, and assert exact filenames and valid buffers.
 * Verifies the full pipeline: split → extract text → parse recipient → build filename.
 */
import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { processPdfToPages } from "@pdf-splitter/pdf-processor";

const MIN_PAGE_PDF_BYTES = 500;

async function createGoldenPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = doc.embedStandardFont(StandardFonts.Helvetica);

  // Page 1: text without recipient pattern → expect "Seite_01.pdf"
  const page1 = doc.addPage([600, 800]);
  page1.drawText("Rechnung", { x: 50, y: 750, size: 12, font });

  // Page 2: "Name: Max Mustermann" and "12345 Berlin" (extracted as one line by pdfjs)
  // → parseRecipientFromText yields vorname "Max", nachname "Mustermann 12345 Berlin", wohnort ""
  // → buildSafeFilename → "Mustermann_12345_Berlin_Max.pdf"
  const page2 = doc.addPage([600, 800]);
  page2.drawText("Name: Max Mustermann", { x: 50, y: 750, size: 12, font });
  page2.drawText("12345 Berlin", { x: 50, y: 730, size: 12, font });

  const bytes = await doc.save();
  return new Uint8Array(bytes);
}

describe("golden PDF (programmatic 2-page)", () => {
  it("processPdfToPages returns exact filenames and valid single-page PDFs", async () => {
    const pdfBuffer = await createGoldenPdf();
    const result = await processPdfToPages(new Uint8Array(pdfBuffer));

    expect(result).toHaveLength(2);

    // Page 1: no recipient pattern → Seite_01.pdf
    expect(result[0]!.pageIndex).toBe(0);
    expect(result[0]!.filename).toBe("Seite_01.pdf");
    expect(result[0]!.buffer.length).toBeGreaterThanOrEqual(MIN_PAGE_PDF_BYTES);
    expect(String.fromCharCode(...result[0]!.buffer.slice(0, 5))).toBe("%PDF-");

    // Page 2: Name + PLZ Ort on one extracted line → Mustermann_12345_Berlin_Max.pdf
    expect(result[1]!.pageIndex).toBe(1);
    expect(result[1]!.filename).toBe("Mustermann_12345_Berlin_Max.pdf");
    expect(result[1]!.buffer.length).toBeGreaterThanOrEqual(MIN_PAGE_PDF_BYTES);
    expect(String.fromCharCode(...result[1]!.buffer.slice(0, 5))).toBe("%PDF-");
  });
});
