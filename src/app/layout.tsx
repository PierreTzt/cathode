import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "MonSuivi" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <nav>
          <a href="/">À suivre</a>
          <a href="/mes-series">Mes séries</a>
          <a href="/stats">Statistiques</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
