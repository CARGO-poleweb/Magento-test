import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Ligue des Copains",
  description: "Ligue 1 — pronostics, bonus cachés et Commission de discipline",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "La Ligue",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f9f6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={GeistSans.className}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
