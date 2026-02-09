import type { Metadata } from "next";
import { getBaseUrl } from "@/lib/site-url";
import "./globals.css";

const baseUrl = getBaseUrl();
const title = "PDF Splitter – Lohn- & Gehaltsabrechnungen teilen | Kostenlos";
const description =
  "PDF teilen: Lohn- und Gehaltsabrechnungen kostenlos in Einzeldokumente aufteilen. Eine Seite = ein PDF. Download als ZIP.";

export const metadata: Metadata = {
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased min-h-screen bg-zinc-950 text-zinc-100">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
