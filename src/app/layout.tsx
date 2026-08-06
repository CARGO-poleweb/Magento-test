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
  themeColor: "#15803d",
  width: "device-width",
  initialScale: 1,
  // Nécessaire pour que la zone de sécurité (barre « home » iPhone) soit gérée.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh text-[#14251b] antialiased">{children}</body>
    </html>
  );
}
