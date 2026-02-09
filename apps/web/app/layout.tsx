import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Splitter – Lohn/Gehaltsrechnungen",
  description: "PDF in Einzeldokumente splitten und als ZIP herunterladen",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased min-h-screen bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  );
}
