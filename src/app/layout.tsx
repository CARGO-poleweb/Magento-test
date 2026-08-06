import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Ligue des Copains",
  description: "Ligue 1 2025-2026 — pronostics, bonus cachés et Commission de discipline",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Ligue des Copains",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh bg-neutral-950 text-neutral-100 antialiased">{children}</body>
    </html>
  );
}
