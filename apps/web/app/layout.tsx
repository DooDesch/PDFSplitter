import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { getBaseUrl } from "@/lib/site-url";
import "./globals.css";

const title = "PDF Splitter – Lohn- & Gehaltsabrechnungen teilen | Kostenlos";
const description =
  "PDF teilen: Lohn- und Gehaltsabrechnungen kostenlos in Einzeldokumente aufteilen. Eine Seite = ein PDF. Download als ZIP.";

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();
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
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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
      "Kostenloser PDF Splitter für Lohn- und Gehaltsabrechnungen. Eine Seite pro Dokument, Download als ZIP.",
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
