import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { BottomNav } from "@/app/components/BottomNav";
import { RegisterSW } from "@/app/components/RegisterSW";

// Next ne préfixe PAS le basePath aux URLs de metadata → on le fait à la main.
// (Les fichiers de public/ sont servis sous le basePath, mais les <link> non préfixés
// pointeraient vers la racine du domaine, pas vers /monsuivi.)
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "MonSuivi",
  applicationName: "MonSuivi",
  manifest: `${BASE}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: "MonSuivi", statusBarStyle: "black-translucent" },
  icons: { icon: `${BASE}/icon-192.png`, apple: `${BASE}/apple-touch-icon.png` },
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <nav className="top-nav">
          <Link href="/">À suivre</Link>
          <Link href="/a-venir">À venir</Link>
          <Link href="/mes-series">Mes séries</Link>
          <Link href="/journal">Journal</Link>
          <Link href="/recherche">Rechercher</Link>
          <Link href="/films">Films</Link>
          <Link href="/stats">Statistiques</Link>
          <Link href="/plus">Plus</Link>
        </nav>
        <main>{children}</main>
        <BottomNav />
        <RegisterSW />
      </body>
    </html>
  );
}
