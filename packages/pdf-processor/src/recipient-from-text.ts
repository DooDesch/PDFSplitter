export interface Recipient {
  vorname: string;
  nachname: string;
  wohnort: string;
}

const MAX_FILENAME_LENGTH = 120;
const SAFE_FILENAME_REGEX = /[^\wäöüÄÖÜß\-_.]/g;

/**
 * Tries to extract recipient (first name, last name, city) from invoice text
 * using common German patterns. Returns null if nothing useful is found.
 */
export function parseRecipientFromText(text: string): Recipient | null {
  if (!text || text.trim().length === 0) return null;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let vorname = "";
  let nachname = "";
  let wohnort = "";

  // Look for "Name:", "An:", "Rechnungsempfänger", "Rechnungsadresse" etc.
  const namePatterns = [
    /^(?:Name|An|Rechnungsempfänger|Empfänger|Rechnungsadresse)\s*:?\s*(.*)$/i,
    /^(?:Name|An)\s*:?\s*$/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of namePatterns) {
      const match = line.match(pattern);
      if (match) {
        const rest = match[1]?.trim();
        if (rest) {
          // "Vorname Nachname" or "Nachname, Vorname"
          const comma = rest.indexOf(",");
          if (comma > 0) {
            nachname = rest.slice(0, comma).trim();
            vorname = rest.slice(comma + 1).trim();
          } else {
            const parts = rest.split(/\s+/).filter(Boolean);
            if (parts.length >= 2) {
              vorname = parts[0] ?? "";
              nachname = parts.slice(1).join(" ");
            } else if (parts.length === 1) {
              nachname = parts[0] ?? "";
            }
          }
        } else {
          // Label only; take next 1–2 lines as name
          const nextLine = lines[i + 1]?.trim() ?? "";
          const nextNext = lines[i + 2]?.trim() ?? "";
          const combined = [nextLine, nextNext].filter(Boolean).join(" ");
          const parts = combined.split(/\s+/).filter(Boolean);
          if (parts.length >= 2) {
            vorname = parts[0] ?? "";
            nachname = parts.slice(1).join(" ");
          } else if (parts.length === 1) {
            nachname = parts[0] ?? "";
          }
        }
        break;
      }
    }

    // Wohnort: "12345 Stadt" or "Wohnort: Stadt" or "PLZ Ort"
    const wohnortMatch = line.match(
      /(?:Wohnort|Ort|Adresse)\s*:?\s*(.+)$/i
    ) ?? line.match(/^(\d{5})\s+(\S.+)$/);
    if (wohnortMatch) {
      if (wohnortMatch[2] !== undefined) {
        wohnort = `${wohnortMatch[1]} ${wohnortMatch[2]}`.trim();
      } else {
        wohnort = (wohnortMatch[1] ?? "").trim();
      }
    }
    if (!wohnort && /^\d{5}\s+.+/.test(line)) {
      wohnort = line.trim();
    }
  }

  const hasName = (vorname + nachname).replace(/\s/g, "").length > 0;
  const hasOrt = wohnort.length > 0;
  if (!hasName && !hasOrt) return null;

  return { vorname, nachname, wohnort };
}

/**
 * Builds a safe filename for a PDF from recipient data or page index.
 * Format: Nachname_Vorname_Wohnort.pdf or Seite_NN.pdf
 */
export function buildSafeFilename(
  recipient: Recipient | null,
  pageIndex: number
): string {
  if (recipient) {
    const parts = [
      recipient.nachname,
      recipient.vorname,
      recipient.wohnort,
    ].filter(Boolean);
    const base = parts.join("_").replace(SAFE_FILENAME_REGEX, "_");
    const trimmed =
      base.length > MAX_FILENAME_LENGTH
        ? base.slice(0, MAX_FILENAME_LENGTH)
        : base;
    if (trimmed.length > 0) return `${trimmed}.pdf`;
  }
  const num = String(pageIndex + 1).padStart(2, "0");
  return `Seite_${num}.pdf`;
}
