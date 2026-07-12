"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Barre d'onglets fixe en bas, visible uniquement sur mobile (CSS < 768px).
// `usePathname` renvoie le chemin sans le basePath (Next le retire) → comparaison directe.

interface Onglet {
  href: string;
  label: string;
  icone: ReactNode;
}

const I = (d: string) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const ONGLETS: Onglet[] = [
  { href: "/", label: "À suivre", icone: I("M4 6h16M4 12h16M4 18h10") },
  { href: "/a-venir", label: "À venir", icone: I("M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z") },
  { href: "/mes-series", label: "Mes séries", icone: I("M2 7h20v13H2zM2 7l3-4h14l3 4M12 3v4") },
  { href: "/journal", label: "Journal", icone: I("M12 8v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z") },
  { href: "/plus", label: "Plus", icone: I("M4 6h16M4 12h16M4 18h16") },
];

export function BottomNav() {
  const path = usePathname();
  const estActif = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);
  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {ONGLETS.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          className={`bottom-nav-item${estActif(o.href) ? " actif" : ""}`}
          aria-current={estActif(o.href) ? "page" : undefined}
        >
          {o.icone}
          <span>{o.label}</span>
        </Link>
      ))}
    </nav>
  );
}
