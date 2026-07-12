import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = { title: "MonSuivi" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <nav>
          <Link href="/">À suivre</Link>
          <Link href="/a-venir">À venir</Link>
          <Link href="/mes-series">Mes séries</Link>
          <Link href="/films">Films</Link>
          <Link href="/stats">Statistiques</Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
