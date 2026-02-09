import { ImageResponse } from "next/og";

export const alt = "PDF Splitter – Lohn- und Gehaltsabrechnungen Seite für Seite in Einzel-PDFs aufteilen, Download als ZIP";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 48,
          background: "#18181b",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 12 }}>PDF Splitter</div>
        <div style={{ fontSize: 28, color: "#a1a1aa" }}>
          Jede Seite ein eigenes PDF · Abrechnungen sauber getrennt · Kostenlos
        </div>
        <div
          style={{
            marginTop: 24,
            padding: "12px 20px",
            background: "#059669",
            borderRadius: 8,
            fontSize: 22,
            fontWeight: 500,
          }}
        >
          Download als ZIP
        </div>
      </div>
    ),
    { ...size }
  );
}
