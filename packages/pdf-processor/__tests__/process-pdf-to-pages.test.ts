/**
 * Unit tests for processPdfToPages (orchestration only; split and extract-text are mocked).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { processPdfToPages } from "../src/process-pdf-to-pages.js";

const mockSplitPdfByPages = vi.fn();
const mockExtractTextFromPdf = vi.fn();

vi.mock("../src/split.js", () => ({
  splitPdfByPages: (...args: unknown[]) => mockSplitPdfByPages(...args),
  getPdfPageCount: vi.fn(),
}));

vi.mock("../src/extract-text.js", () => ({
  extractTextFromPdf: (...args: unknown[]) => mockExtractTextFromPdf(...args),
  getDecryptedPdfBytes: vi.fn(),
  setPdfWorkerSrc: vi.fn(),
}));

function fakePdfBuffer(byte: number): Uint8Array {
  const buf = new Uint8Array(10);
  buf[0] = 0x25; // %
  buf[1] = 0x50; // P
  buf[2] = 0x44; // D
  buf[3] = 0x46; // F
  buf[4] = 0x2d; // -
  buf[5] = byte;
  return buf;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processPdfToPages", () => {
  it("returns one ProcessedPage per page buffer with buffer, filename, pageIndex", async () => {
    const page1 = fakePdfBuffer(1);
    const page2 = fakePdfBuffer(2);
    mockSplitPdfByPages.mockResolvedValue([page1, page2]);
    mockExtractTextFromPdf
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce("Name: Max Mustermann\n12345 Berlin");

    const pdfBuffer = new Uint8Array(100);
    const result = await processPdfToPages(pdfBuffer);

    expect(mockSplitPdfByPages).toHaveBeenCalledTimes(1);
    expect(mockSplitPdfByPages).toHaveBeenCalledWith(pdfBuffer, {
      password: undefined,
      onProgress: expect.any(Function),
    });
    expect(mockExtractTextFromPdf).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      buffer: page1,
      filename: "Seite_01.pdf",
      pageIndex: 0,
    });
    expect(result[1]).toEqual({
      buffer: page2,
      filename: "Mustermann_Max_12345_Berlin.pdf",
      pageIndex: 1,
    });
  });

  it("passes password to splitPdfByPages", async () => {
    mockSplitPdfByPages.mockResolvedValue([fakePdfBuffer(1)]);
    mockExtractTextFromPdf.mockResolvedValue("");

    await processPdfToPages(new Uint8Array(10), { password: "secret" });

    expect(mockSplitPdfByPages).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.objectContaining({ password: "secret" }),
    );
  });

  it("calls onProgress with phase 'splitting' then 'processing' in order", async () => {
    mockSplitPdfByPages.mockImplementation(async (_buf, opts) => {
      opts?.onProgress?.(1, 2);
      opts?.onProgress?.(2, 2);
      return [fakePdfBuffer(1), fakePdfBuffer(2)];
    });
    mockExtractTextFromPdf.mockResolvedValue("");

    const progressCalls: [string, number, number][] = [];
    await processPdfToPages(new Uint8Array(10), {
      onProgress: (phase, current, total) =>
        progressCalls.push([phase, current, total]),
    });

    expect(progressCalls).toEqual([
      ["splitting", 1, 2],
      ["splitting", 2, 2],
      ["processing", 0, 2],
      ["processing", 1, 2],
      ["processing", 2, 2],
    ]);
  });

  it("does not throw when onProgress is omitted", async () => {
    mockSplitPdfByPages.mockResolvedValue([fakePdfBuffer(1)]);
    mockExtractTextFromPdf.mockResolvedValue("");

    const result = await processPdfToPages(new Uint8Array(10));
    expect(result).toHaveLength(1);
    expect(result[0]!.filename).toBe("Seite_01.pdf");
  });
});
