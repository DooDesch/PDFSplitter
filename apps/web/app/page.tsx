"use client";

import { useCallback, useState } from "react";
import { LARGE_FILE_WARNING_MB } from "@/lib/constants";

// PDF.js worker (must be set before first getDocument). Served from public/ to avoid CORS.
const PDF_WORKER_URL = "/pdf.worker.min.mjs";

function buildZipFilename(originalName: string | null): string {
  if (!originalName || typeof originalName !== "string") return "rechnungen.zip";
  const base = originalName.replace(/\.pdf$/i, "").trim();
  const safe = base.replace(/[^\wäöüÄÖÜß\-_.\s]/g, "_").slice(0, 80) || "rechnungen";
  return `${safe}_rechnungen.zip`;
}

type Status = "idle" | "uploading" | "success" | "error";
type ProgressPhase = "splitting" | "processing";

function normalizePdfError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("password") && (lower.includes("required") || lower.includes("needed")))
    return "Dieses PDF ist passwortgeschützt. Bitte Passwort eingeben.";
  if (lower.includes("wrong password") || lower.includes("invalid password") || lower.includes("incorrect password"))
    return "Falsches Passwort.";
  if (lower.includes("password"))
    return "Passwortfehler. Bitte prüfen Sie das Passwort.";
  return msg || "Verarbeitung fehlgeschlagen.";
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progressPhase, setProgressPhase] = useState<ProgressPhase | null>(null);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError("Nur PDF-Dateien sind erlaubt.");
      setFile(null);
      setStatus("error");
      return;
    }
    setError(null);
    setFile(f);
    setStatus("idle");
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError("Nur PDF-Dateien sind erlaubt.");
      setFile(null);
      setStatus("error");
      return;
    }
    setError(null);
    setFile(f);
    setStatus("idle");
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setStatus("uploading");
    setError(null);
    setProgressPhase(null);
    setProgressCurrent(0);
    setProgressTotal(0);
    try {
      const [
        {
          processPdfToPages,
          getPdfPageCount,
          setPdfWorkerSrc,
        },
        { default: JSZip },
      ] = await Promise.all([
        import("@pdf-splitter/pdf-processor"),
        import("jszip"),
      ]);
      setPdfWorkerSrc(PDF_WORKER_URL);

      const arrayBuffer = await file.arrayBuffer();
      const pdfBuffer = new Uint8Array(arrayBuffer);
      const pdfPassword = password.trim() || undefined;

      const total = await getPdfPageCount(pdfBuffer, { password: pdfPassword });
      setProgressTotal(total);
      setProgressPhase("splitting");
      setProgressCurrent(0);

      const pages = await processPdfToPages(pdfBuffer, {
        password: pdfPassword,
        onProgress: (phase, current, total) => {
          setProgressPhase(phase);
          setProgressCurrent(current);
          setProgressTotal(total);
        },
      });

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

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildZipFilename(file.name);
      a.click();
      URL.revokeObjectURL(url);

      setPageCount(pages.length);
      setStatus("success");
    } catch (err) {
      setError(normalizePdfError(err));
      setStatus("error");
    }
  }, [file, password]);

  const handleReset = useCallback(() => {
    setFile(null);
    setPassword("");
    setStatus("idle");
    setError(null);
    setPageCount(null);
    setProgressPhase(null);
    setProgressCurrent(0);
    setProgressTotal(0);
  }, []);

  const isLargeFile =
    file != null && file.size > LARGE_FILE_WARNING_MB * 1024 * 1024;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <h1 className="text-2xl font-semibold text-center text-zinc-100">
          PDF Splitter
        </h1>
        <p className="text-sm text-zinc-400 text-center">
          Lohn- und Gehaltsabrechnungen: Jede Seite wird ein eigenes PDF –
          sauber getrennt, fertig als ZIP.
        </p>
        <p className="text-xs text-zinc-500 text-center max-w-md mx-auto">
          Verarbeitung erfolgt vollständig auf Ihrem Gerät – keine Daten werden
          hochgeladen. Kostenlos, ohne Anmeldung.
        </p>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            border-2 border-dashed rounded-xl p-10 text-center transition-colors
            ${isDragging ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-600 hover:border-zinc-500"}
            ${file ? "bg-zinc-800/50" : ""}
          `}
        >
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileInput}
            className="hidden"
            id="pdf-input"
          />
          {file ? (
            <div className="space-y-2">
              <p className="text-zinc-200 font-medium truncate" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-zinc-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              {isLargeFile && (
                <p className="text-xs text-amber-400">
                  Sehr große Dateien können den Browser verlangsamen.
                </p>
              )}
              <label
                htmlFor="pdf-input"
                className="inline-block text-sm text-emerald-400 hover:text-emerald-300 cursor-pointer underline"
              >
                Andere Datei wählen
              </label>
            </div>
          ) : (
            <label
              htmlFor="pdf-input"
              className="cursor-pointer block text-zinc-400 hover:text-zinc-300"
            >
              PDF hier ablegen oder{" "}
              <span className="text-emerald-400 underline">durchsuchen</span>
            </label>
          )}
        </div>

        {file && (
          <div className="space-y-1">
            <label
              htmlFor="pdf-password"
              className="block text-sm text-zinc-400"
            >
              Passwort (falls PDF geschützt)
            </label>
            <input
              id="pdf-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leer lassen wenn ungeschützt"
              className="w-full py-2 px-3 rounded-lg bg-zinc-800 border border-zinc-600 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              autoComplete="off"
            />
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3">
            {error}
          </div>
        )}

        {status === "uploading" && (
          <div className="flex flex-col gap-3 w-full">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-zinc-300 text-center">
                {progressPhase === "splitting" &&
                  `Seiten werden getrennt … ${progressCurrent} von ${progressTotal}`}
                {progressPhase === "processing" && (
                  progressCurrent >= progressTotal
                    ? "ZIP wird erstellt …"
                    : `Seite ${progressCurrent + 1} von ${progressTotal} wird verarbeitet …`
                )}
                {!progressPhase && progressTotal === 0 && "PDF wird geladen …"}
              </p>
              {progressTotal > 0 && (
                <div className="h-2 w-full rounded-full bg-zinc-700 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                    style={{
                      width: `${
                        progressTotal
                          ? Math.round((progressCurrent / progressTotal) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              )}
            </div>
            {progressTotal === 0 && (
              <div className="flex items-center justify-center gap-2 text-zinc-500">
                <span className="inline-block w-4 h-4 border-2 border-zinc-500 border-t-emerald-500 rounded-full animate-spin" />
                <span className="text-xs">Seitenanzahl wird ermittelt …</span>
              </div>
            )}
          </div>
        )}

        {status === "success" && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm p-3 text-center">
            Fertig.{" "}
            {pageCount != null ? `${pageCount} Dokumente – ` : ""}ZIP-Download
            wurde gestartet.
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || status === "uploading"}
            className="flex-1 py-3 px-4 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-500"
          >
            Verarbeiten und ZIP herunterladen
          </button>
          {file && status !== "uploading" && (
            <button
              type="button"
              onClick={handleReset}
              className="py-3 px-4 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800"
            >
              Zurücksetzen
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
