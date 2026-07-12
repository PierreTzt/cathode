import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import { BottomNav } from "@/app/components/BottomNav";

export const metadata = { title: "MonSuivi" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <nav className="top-nav">
          <Link href="/">À suivre</Link>
          <Link href="/a-venir">À venir</Link>
          <Link href="/mes-series">Mes séries</Link>
          <Link href="/journal">Journal</Link>
          <Link href="/films">Films</Link>
          <Link href="/stats">Statistiques</Link>
          <Link href="/plus">Plus</Link>
        </nav>
        <main>{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
