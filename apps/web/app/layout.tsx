import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { getBaseUrl } from "@/lib/site-url";
import "./globals.css";

const title = "PDF Splitter – Abrechnungen Seite für Seite teilen | Kostenlos";
const description =
  "Lohn- und Gehaltsabrechnungen kostenlos aufteilen: Jede Seite wird ein eigenes PDF, Download als ZIP. Ohne Anmeldung, ohne Speicherung Ihrer Daten.";

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();
  // Absolute image URL required for Discord and other crawlers (they often ignore relative URLs)
  const ogImageUrl = `${baseUrl.replace(/\/$/, "")}/opengraph-image`;
  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "de_DE",
      url: baseUrl,
      siteName: "PDF Splitter",
      title,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: "PDF Splitter – Abrechnungen in Einzel-PDFs aufteilen, Download als ZIP",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const baseUrl = getBaseUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "PDF Splitter",
    description:
      "Lohn- und Gehaltsabrechnungen in Einzel-PDFs aufteilen – jede Seite ein eigenes Dokument, Download als ZIP. Kostenlos und ohne Anmeldung.",
    url: baseUrl,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    },
  };

  return (
    <html lang="de">
      <body className="antialiased min-h-screen bg-zinc-950 text-zinc-100">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
