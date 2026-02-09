/**
 * One-time script to generate expected output for the example PDF.
 * Run: pnpm test:generate-expected (from repo root or from packages/pdf-processor).
 * Writes __tests__/fixtures/expected-muster-baulohnabrechnung.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { pathToFileURL } from "url";
import { processPdfToPages, setPdfWorkerSrc } from "../src/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Repo root: packages/pdf-processor/scripts -> packages/pdf-processor -> packages -> root
const repoRoot = join(__dirname, "..", "..", "..");
const examplePdfPath = join(repoRoot, "examples", "Muster-Baulohnabrechnung.pdf");
const outDir = join(__dirname, "..", "__tests__", "fixtures");
const outPath = join(outDir, "expected-muster-baulohnabrechnung.json");

async function main(): Promise<void> {
  if (!existsSync(examplePdfPath)) {
    console.error("Example PDF not found at:", examplePdfPath);
    process.exit(1);
  }

  // In Node, set worker to the pdfjs-dist worker file (file URL so it can be loaded)
  const workerPath = join(
    __dirname,
    "..",
    "node_modules",
    "pdfjs-dist",
    "build",
    "pdf.worker.mjs"
  );
  if (existsSync(workerPath)) {
    setPdfWorkerSrc(pathToFileURL(workerPath).href);
  }

  const pdfBuffer = new Uint8Array(readFileSync(examplePdfPath));
  try {
    const pages = await processPdfToPages(pdfBuffer);
    const expected = {
      pageCount: pages.length,
      filenames: pages.map((p) => p.filename),
    };
    mkdirSync(outDir, { recursive: true });
    writeFileSync(outPath, JSON.stringify(expected, null, 2) + "\n", "utf-8");
    console.log("Wrote", outPath);
    console.log("pageCount:", expected.pageCount);
    console.log("filenames:", expected.filenames);
  } catch (err) {
    console.error("Failed to process PDF:", err);
    process.exit(1);
  }
}

main();
