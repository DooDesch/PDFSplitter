import { NextResponse } from "next/server";
import JSZip from "jszip";
import { processPdfToPages } from "@pdf-splitter/pdf-processor";
import { MAX_PDF_FILE_SIZE_BYTES, MAX_PDF_FILE_SIZE_MB } from "@/lib/constants";

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;
const rateLimitMap = new Map<string, number[]>();

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Returns true if the request is within rate limit. */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  let times = rateLimitMap.get(ip) ?? [];
  times = times.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (times.length >= RATE_LIMIT_MAX_REQUESTS) return false;
  times.push(now);
  rateLimitMap.set(ip, times);
  return true;
}

const PDF_MAGIC_BYTES = Buffer.from("%PDF", "ascii");

function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES);
}

/** Builds a safe ZIP filename from the original PDF name. */
function buildZipFilename(originalName: string | null): string {
  if (!originalName || typeof originalName !== "string") return "rechnungen.zip";
  const base = originalName.replace(/\.pdf$/i, "").trim();
  const safe = base.replace(/[^\wäöüÄÖÜß\-_.\s]/g, "_").slice(0, 80) || "rechnungen";
  return `${safe}_rechnungen.zip`;
}

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("pdf") as File | null;
    const originalFilename = (formData.get("filename") as string | null)?.trim() || null;

    if (!file) {
      return NextResponse.json(
        { error: "Keine Datei hochgeladen. Bitte eine PDF-Datei auswählen." },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Nur PDF-Dateien sind erlaubt." },
        { status: 400 }
      );
    }

    if (file.size > MAX_PDF_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `Datei zu groß. Maximal ${MAX_PDF_FILE_SIZE_MB} MB erlaubt.`,
        },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    if (!isPdfBuffer(pdfBuffer)) {
      return NextResponse.json(
        { error: "Die Datei ist kein gültiges PDF (Magic-Bytes-Prüfung fehlgeschlagen)." },
        { status: 400 }
      );
    }

    const pages = await processPdfToPages(pdfBuffer);

    const zip = new JSZip();
    const usedNames = new Set<string>();

    for (const { buffer, filename } of pages) {
      let uniqueName = filename;
      let counter = 1;
      while (usedNames.has(uniqueName)) {
        const base = filename.replace(/\.pdf$/i, "");
        uniqueName = `${base}_${counter}.pdf`;
        counter++;
      }
      usedNames.add(uniqueName);
      zip.file(uniqueName, buffer);
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const body = new Uint8Array(zipBuffer);
    const zipFilename = buildZipFilename(originalFilename);
    const encodedFilename = encodeURIComponent(zipFilename);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="rechnungen.zip"; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": String(body.length),
        "X-Page-Count": String(pages.length),
        "X-Zip-Filename": zipFilename,
      },
    });
  } catch (err) {
    console.error("process-pdf error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Verarbeitung fehlgeschlagen.",
      },
      { status: 500 }
    );
  }
}
