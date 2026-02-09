import { NextResponse } from "next/server";
import JSZip from "jszip";
import { processPdfToPages } from "@pdf-splitter/pdf-processor";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("pdf") as File | null;

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

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `Datei zu groß. Maximal ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB erlaubt.`,
        },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

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

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="rechnungen.zip"',
        "Content-Length": String(body.length),
        "X-Page-Count": String(pages.length),
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
