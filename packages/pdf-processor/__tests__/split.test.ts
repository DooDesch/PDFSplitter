/**
 * Unit tests for splitPdfByPages and getPdfPageCount.
 */
import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  splitPdfByPages,
  getPdfPageCount,
} from "@pdf-splitter/pdf-processor";

async function createPdfWithPageCount(n: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) {
    doc.addPage([600, 800]);
  }
  return new Uint8Array(await doc.save());
}

describe("splitPdfByPages", () => {
  it("splits a 1-page PDF into one buffer", async () => {
    const pdf = await createPdfWithPageCount(1);
    const result = await splitPdfByPages(pdf);
    expect(result).toHaveLength(1);
    expect(result[0]!.length).toBeGreaterThan(0);
    expect(String.fromCharCode(...result[0]!.slice(0, 5))).toBe("%PDF-");
  });

  it("splits a 3-page PDF into three buffers", async () => {
    const pdf = await createPdfWithPageCount(3);
    const result = await splitPdfByPages(pdf);
    expect(result).toHaveLength(3);
    for (const buf of result) {
      expect(buf.length).toBeGreaterThan(0);
      expect(String.fromCharCode(...buf.slice(0, 5))).toBe("%PDF-");
    }
  });

  it("calls onProgress when provided", async () => {
    const pdf = await createPdfWithPageCount(2);
    const progressCalls: [number, number][] = [];
    await splitPdfByPages(pdf, {
      onProgress: (current, total) => progressCalls.push([current, total]),
    });
    expect(progressCalls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it("splits same result with no options vs empty password (unencrypted PDF)", async () => {
    const pdf = await createPdfWithPageCount(2);
    const [resultNoOpts, resultEmptyPass] = await Promise.all([
      splitPdfByPages(pdf),
      splitPdfByPages(pdf, { password: "" }),
    ]);
    expect(resultNoOpts).toHaveLength(2);
    expect(resultEmptyPass).toHaveLength(2);
    expect(resultNoOpts[0]!.length).toBe(resultEmptyPass[0]!.length);
    expect(resultNoOpts[1]!.length).toBe(resultEmptyPass[1]!.length);
  });
});

describe("getPdfPageCount", () => {
  it("returns page count for unencrypted PDF", async () => {
    const pdf = await createPdfWithPageCount(3);
    expect(await getPdfPageCount(pdf)).toBe(3);
  });

  it("returns same count with no options vs empty password", async () => {
    const pdf = await createPdfWithPageCount(2);
    const [a, b, c] = await Promise.all([
      getPdfPageCount(pdf),
      getPdfPageCount(pdf, {}),
      getPdfPageCount(pdf, { password: "" }),
    ]);
    expect(a).toBe(2);
    expect(b).toBe(2);
    expect(c).toBe(2);
  });
});
