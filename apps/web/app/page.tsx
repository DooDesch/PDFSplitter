"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LARGE_FILE_WARNING_MB } from "@/lib/constants";

// PDF.js worker (must be set before first getDocument). Served from public/ to avoid CORS.
const PDF_WORKER_URL = "/pdf.worker.min.mjs";

function buildZipFilename(originalName: string | null): string {
  if (!originalName || typeof originalName !== "string")
    return "rechnungen.zip";
  const base = originalName.replace(/\.pdf$/i, "").trim();
  const safe =
    base.replace(/[^\wäöüÄÖÜß\-_.\s]/g, "_").slice(0, 80) || "rechnungen";
  return `${safe}_rechnungen.zip`;
}

type Status = "idle" | "uploading" | "success" | "error";
type ProgressPhase = "splitting" | "processing";

function normalizePdfError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes("password") &&
    (lower.includes("required") || lower.includes("needed"))
  )
    return "Dieses PDF ist passwortgeschützt. Bitte Passwort eingeben.";
  if (
    lower.includes("wrong password") ||
    lower.includes("invalid password") ||
    lower.includes("incorrect password")
  )
    return "Falsches Passwort.";
  if (lower.includes("password"))
    return "Passwortfehler. Bitte prüfen Sie das Passwort.";
  return msg || "Verarbeitung fehlgeschlagen.";
}

/** True when the error indicates "password required" (encrypted PDF), not "wrong password". */
function isPasswordRequiredError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes("wrong password") ||
    lower.includes("invalid password") ||
    lower.includes("incorrect password")
  )
    return false;
  if (/encrypted/i.test(msg)) return true;
  if (
    lower.includes("password") &&
    (lower.includes("required") || lower.includes("needed"))
  )
    return true;
  return false;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progressPhase, setProgressPhase] = useState<ProgressPhase | null>(
    null,
  );
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [modalPassword, setModalPassword] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const passwordDialogRef = useRef<HTMLDialogElement>(null);

  const runProcessing = useCallback(
    async (
      file: File,
      password: string | undefined,
    ): Promise<{ pageCount: number }> => {
      const [
        { processPdfToPages, getPdfPageCount, setPdfWorkerSrc },
        { default: JSZip },
      ] = await Promise.all([
        import("@pdf-splitter/pdf-processor"),
        import("jszip"),
      ]);
      setPdfWorkerSrc(PDF_WORKER_URL);

      const arrayBuffer = await file.arrayBuffer();
      const pdfBuffer = new Uint8Array(arrayBuffer);
      const pdfPassword = password?.trim() || undefined;

      // Pass a copy for page count so PDF.js worker transfer cannot detach the buffer used below.
      const total = await getPdfPageCount(new Uint8Array(pdfBuffer), {
        password: pdfPassword,
      });
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
      return { pageCount: pages.length };
    },
    [],
  );

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

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
    },
    [],
  );

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setStatus("uploading");
    setError(null);
    setProgressPhase(null);
    setProgressCurrent(0);
    setProgressTotal(0);
    try {
      const result = await runProcessing(file, password.trim() || undefined);
      setPageCount(result.pageCount);
      setStatus("success");
    } catch (err) {
      if (isPasswordRequiredError(err)) {
        setShowPasswordModal(true);
        setModalPassword(password);
        setModalError(null);
        setStatus("idle");
        return;
      }
      setError(normalizePdfError(err));
      setStatus("error");
    }
  }, [file, password, runProcessing]);

  const handleReset = useCallback(() => {
    setFile(null);
    setPassword("");
    setStatus("idle");
    setError(null);
    setPageCount(null);
    setProgressPhase(null);
    setProgressCurrent(0);
    setProgressTotal(0);
    setShowPasswordModal(false);
    setModalPassword("");
    setModalError(null);
  }, []);

  const handlePasswordModalCancel = useCallback(() => {
    setShowPasswordModal(false);
    setModalPassword("");
    setModalError(null);
    handleReset();
  }, [handleReset]);

  const loadSampleEncryptedPdf = useCallback(async () => {
    setError(null);
    setStatus("idle");
    try {
      const res = await fetch("/samples/encrypted.pdf");
      if (!res.ok) throw new Error("Beispiel-PDF konnte nicht geladen werden.");
      const blob = await res.blob();
      const f = new File([blob], "encrypted.pdf", { type: "application/pdf" });
      setFile(f);
      setPassword("");
    } catch (e) {
      setError(normalizePdfError(e));
    }
  }, []);

  const handlePasswordModalSubmit = useCallback(async () => {
    if (!file) return;
    setModalError(null);
    setShowPasswordModal(false);
    setStatus("uploading");
    setProgressPhase(null);
    setProgressCurrent(0);
    setProgressTotal(0);
    try {
      const result = await runProcessing(
        file,
        modalPassword.trim() || undefined,
      );
      setPageCount(result.pageCount);
      setStatus("success");
      setPassword(modalPassword);
      setModalPassword("");
    } catch (err) {
      setModalError(normalizePdfError(err));
      setShowPasswordModal(true);
      setStatus("idle");
    }
  }, [file, modalPassword, runProcessing]);

  // Auto-detect encrypted PDF when file is set (Chrome-like: show password modal immediately).
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    (async () => {
      try {
        const { checkPdfNeedsPassword, setPdfWorkerSrc } = await import(
          "@pdf-splitter/pdf-processor"
        );
        setPdfWorkerSrc(PDF_WORKER_URL);
        const buf = new Uint8Array(await file.arrayBuffer());
        const needsPassword = await checkPdfNeedsPassword(buf);
        if (!cancelled && needsPassword) {
          setShowPasswordModal(true);
          setModalPassword("");
          setModalError(null);
        }
      } catch {
        // Non-encryption errors (e.g. corrupted): do nothing; user will see error on "Verarbeiten".
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    if (showPasswordModal) {
      passwordDialogRef.current?.showModal();
    }
  }, [showPasswordModal]);

  const isLargeFile =
    file != null && file.size > LARGE_FILE_WARNING_MB * 1024 * 1024;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      {showPasswordModal && (
        <dialog
          ref={passwordDialogRef}
          className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-600 bg-zinc-800 p-6 shadow-xl backdrop:bg-black/50"
          onCancel={handlePasswordModalCancel}
        >
          <h2 className="text-lg font-semibold text-zinc-100 mb-2">
            Passwortgeschütztes PDF
          </h2>
          <p className="text-sm text-zinc-400 mb-4">
            Dieses PDF ist passwortgeschützt. Bitte Passwort eingeben oder
            abbrechen.
          </p>
          <input
            type="password"
            value={modalPassword}
            onChange={(e) => setModalPassword(e.target.value)}
            placeholder="Passwort"
            className="w-full py-2 px-3 rounded-lg bg-zinc-700 border border-zinc-600 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-2"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handlePasswordModalSubmit();
            }}
          />
          {modalError && (
            <p className="text-sm text-red-400 mb-4">{modalError}</p>
          )}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handlePasswordModalCancel}
              className="py-2 px-4 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-700"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => void handlePasswordModalSubmit()}
              className="py-2 px-4 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500"
            >
              Entsperren
            </button>
          </div>
        </dialog>
      )}

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
        {process.env.NODE_ENV === "development" && (
          <p className="text-center">
            <button
              type="button"
              onClick={loadSampleEncryptedPdf}
              className="text-sm text-emerald-400 hover:text-emerald-300 underline"
            >
              Beispiel: verschlüsseltes PDF laden
            </button>
          </p>
        )}

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
              <p
                className="text-zinc-200 font-medium truncate"
                title={file.name}
              >
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
                {progressPhase === "processing" &&
                  (progressCurrent >= progressTotal
                    ? "ZIP wird erstellt …"
                    : `Seite ${progressCurrent + 1} von ${progressTotal} wird verarbeitet …`)}
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
            Fertig. {pageCount != null ? `${pageCount} Dokumente – ` : ""}
            ZIP-Download wurde gestartet.
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
