/**
 * Splits a password-protected PDF by rendering each page to an image and
 * creating a new PDF per page. Used in the browser because PDF.js getData()
 * returns raw (encrypted) bytes, so pdf-lib cannot produce visible content.
 * Call setPdfWorkerSrc() before using.
 * Uses globalThis for DOM APIs so the package builds without "dom" lib.
 */
import { PDFDocument } from "pdf-lib";
import { getPdfJs } from "./extract-text.js";

const RENDER_SCALE = 2;

export interface SplitEncryptedProgressCallback {
  (current: number, total: number): void;
}

interface CanvasLike {
  toBlob(
    callback: (blob: unknown) => void,
    type: string,
    quality: number,
  ): void;
}

function canvasToPngBytes(canvas: CanvasLike): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob: unknown) => {
        if (!blob || typeof (blob as { size: number }).size !== "number") {
          reject(new Error("canvas.toBlob failed"));
          return;
        }
        const FileReaderConstructor = (globalThis as Record<string, unknown>)
          .FileReader;
        if (typeof FileReaderConstructor !== "function") {
          reject(new Error("FileReader not available"));
          return;
        }
        const r = new (FileReaderConstructor as new () => {
          readAsArrayBuffer(blob: unknown): void;
          result: ArrayBuffer | null;
          onload: () => void;
          onerror: () => void;
          error: unknown;
        })();
        r.onload = () =>
          resolve(
            new Uint8Array((r.result as ArrayBuffer) ?? new ArrayBuffer(0)),
          );
        r.onerror = () => reject(r.error);
        r.readAsArrayBuffer(blob);
      },
      "image/png",
      0.95,
    );
  });
}

export async function splitEncryptedPdfByPagesInBrowser(
  pdfBuffer: Uint8Array,
  password: string,
  onProgress?: SplitEncryptedProgressCallback,
): Promise<Uint8Array[]> {
  const pdfjs = await getPdfJs();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    password,
  }).promise;
  const numPages = doc.numPages;
  const result: Uint8Array[] = [];

  const g = globalThis as Record<string, unknown>;
  const docEl = g.document as { createElement: (tag: string) => unknown } | null;
  if (
    docEl == null ||
    typeof docEl.createElement !== "function"
  ) {
    throw new Error("document.createElement not available");
  }

  for (let i = 1; i <= numPages; i++) {
    const page = (await doc.getPage(i)) as unknown as {
      getViewport: (opts: { scale: number }) => {
        width: number;
        height: number;
      };
      render: (opts: unknown) => { promise: Promise<void> };
    };
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    // Call createElement on docEl so 'this' is document (avoids "Illegal invocation").
    const canvas = docEl.createElement("canvas") as CanvasLike & {
      width: number;
      height: number;
      getContext: (id: string) => unknown;
    };
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas 2d context");
    const renderTask = page.render({
      canvasContext: ctx,
      viewport,
      intent: "print",
    });
    await renderTask.promise;
    const pngBytes = await canvasToPngBytes(canvas);
    const pdfDoc = await PDFDocument.create();
    const pageWidth = viewport.width / RENDER_SCALE;
    const pageHeight = viewport.height / RENDER_SCALE;
    const pdfPage = pdfDoc.addPage([pageWidth, pageHeight]);
    const image = await pdfDoc.embedPng(pngBytes);
    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });
    const bytes = await pdfDoc.save({ useObjectStreams: false });
    result.push(new Uint8Array(bytes));
    onProgress?.(i, numPages);
  }

  return result;
}
