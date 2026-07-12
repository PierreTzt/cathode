"use client";
import { useState } from "react";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function Restauration() {
  const [fichier, setFichier] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const restaurer = async () => {
    if (!fichier) return;
    if (
      !confirm(
        "Cela va remplacer TOUTE ta base actuelle par ce fichier. Une sauvegarde de l'état actuel sera faite avant. Continuer ?"
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("fichier", fichier);
      const res = await fetch(`${BASE}/api/restore`, { method: "POST", body: fd });
      const j = (await res.json()) as { ok?: boolean; erreur?: string };
      if (j.ok) {
        setMsg("Restauration réussie. Rechargement…");
        setTimeout(() => location.reload(), 1200);
      } else {
        setMsg(`Échec : ${j.erreur ?? "inconnu"}`);
      }
    } catch {
      setMsg("Échec de l'envoi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="restore">
      <input
        type="file"
        accept=".db,application/octet-stream"
        onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
        className="restore-input"
      />
      <button className="notifs-btn secondaire" onClick={restaurer} disabled={busy || !fichier}>
        {busy ? "Restauration…" : "Restaurer"}
      </button>
      {msg && <p className="muted restore-msg">{msg}</p>}
    </div>
  );
}
