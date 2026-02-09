"use client";

import { useCallback, useState } from "react";

type Status = "idle" | "uploading" | "success" | "error";

const MAX_FILE_SIZE_MB = 50;

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`Datei zu groß. Maximal ${MAX_FILE_SIZE_MB} MB.`);
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
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`Datei zu groß. Maximal ${MAX_FILE_SIZE_MB} MB.`);
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
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      const res = await fetch("/api/process-pdf", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Fehler ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "rechnungen.zip";
      a.click();
      URL.revokeObjectURL(url);
      const count = res.headers.get("X-Page-Count");
      setPageCount(count ? parseInt(count, 10) : null);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verarbeitung fehlgeschlagen.");
      setStatus("error");
    }
  }, [file]);

  const handleReset = useCallback(() => {
    setFile(null);
    setStatus("idle");
    setError(null);
    setPageCount(null);
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <h1 className="text-2xl font-semibold text-center text-zinc-100">
          PDF Splitter
        </h1>
        <p className="text-sm text-zinc-400 text-center">
          Lohn- und Gehaltsrechnungen in Einzeldokumente aufteilen. Eine Seite = ein Dokument.
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
              PDF hier ablegen oder <span className="text-emerald-400 underline">durchsuchen</span>
            </label>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3">
            {error}
          </div>
        )}

        {status === "uploading" && (
          <div className="flex items-center justify-center gap-2 text-zinc-400">
            <span className="inline-block w-5 h-5 border-2 border-zinc-500 border-t-emerald-500 rounded-full animate-spin" />
            <span>PDF wird verarbeitet …</span>
          </div>
        )}

        {status === "success" && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm p-3 text-center">
            Fertig. {pageCount != null ? `${pageCount} Dokumente – ` : ""}ZIP-Download wurde gestartet.
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
