"use client";
import { useState, useTransition } from "react";
import { actionSauverJellyfin, actionTesterJellyfin, actionSyncJellyfin } from "@/app/actions";

export function JellyfinReglages({
  initial,
}: {
  initial: { url: string; token: string; userId: string; auto: boolean };
}) {
  const [url, setUrl] = useState(initial.url);
  const [token, setToken] = useState(initial.token);
  const [userId, setUserId] = useState(initial.userId);
  const [auto, setAuto] = useState(initial.auto);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const cfg = () => ({ url: url.trim(), token: token.trim(), userId: userId.trim() });

  const sauver = () =>
    start(async () => {
      await actionSauverJellyfin({ ...cfg(), auto });
      setMsg("Réglages Jellyfin enregistrés.");
    });
  const tester = () =>
    start(async () => {
      const r = await actionTesterJellyfin(cfg());
      setMsg(r.ok ? `Connecté à ${r.nom ?? "Jellyfin"} ✓` : `Échec : ${r.erreur}`);
    });
  const sync = () =>
    start(async () => {
      await actionSauverJellyfin({ ...cfg(), auto });
      const r = await actionSyncJellyfin();
      setMsg(
        r.erreur
          ? `Erreur : ${r.erreur}`
          : `Synchro : ${r.ajoutes} ajouté(s) · ${r.appariees} apparié(s) · ${r.nonAppariees} non apparié(s).`
      );
    });

  return (
    <div className="jf-form">
      <label className="jf-champ">
        <span>URL du serveur</span>
        <input className="search" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://jellyfin.exemple.fr" />
      </label>
      <label className="jf-champ">
        <span>Clé API</span>
        <input className="search" value={token} onChange={(e) => setToken(e.target.value)} placeholder="clé API Jellyfin" />
      </label>
      <label className="jf-champ">
        <span>ID utilisateur</span>
        <input className="search" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="userId Jellyfin" />
      </label>
      <label className="jf-auto">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        Synchroniser automatiquement à chaque mise à jour
      </label>
      <div className="jf-actions">
        <button className="notifs-btn secondaire" onClick={tester} disabled={pending}>
          Tester la connexion
        </button>
        <button className="notifs-btn secondaire" onClick={sauver} disabled={pending}>
          Enregistrer
        </button>
        <button className="notifs-btn" onClick={sync} disabled={pending}>
          {pending ? "…" : "Synchroniser maintenant"}
        </button>
      </div>
      {msg && <p className="muted jf-msg">{msg}</p>}
    </div>
  );
}
