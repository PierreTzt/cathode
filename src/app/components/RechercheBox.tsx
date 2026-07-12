"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function RechercheBox({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form
      className="recherche-form"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/recherche?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <input
        className="search"
        type="search"
        placeholder="Chercher une série, un épisode…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      <button type="submit">Chercher</button>
    </form>
  );
}
