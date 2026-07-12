"use client";
import { useEffect, useState } from "react";
import { actionAbonnerPush, actionDesabonnerPush, actionClePush } from "@/app/actions";

type Etat = "inconnu" | "non-supporte" | "pas-de-cle" | "active" | "inactive" | "refuse";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function NotifsToggle() {
  const [etat, setEtat] = useState<Etat>("inconnu");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (
        typeof window === "undefined" ||
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        setEtat("non-supporte");
        return;
      }
      if (Notification.permission === "denied") {
        setEtat("refuse");
        return;
      }
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setEtat(sub ? "active" : "inactive");
    })();
  }, []);

  const activer = async () => {
    setBusy(true);
    try {
      const cle = await actionClePush();
      if (!cle) {
        setEtat("pas-de-cle");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setEtat("refuse");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cle) as BufferSource,
      });
      const j = sub.toJSON();
      await actionAbonnerPush({
        endpoint: sub.endpoint,
        p256dh: j.keys?.p256dh ?? "",
        auth: j.keys?.auth ?? "",
      });
      setEtat("active");
    } catch {
      /* silencieux */
    } finally {
      setBusy(false);
    }
  };

  const desactiver = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await actionDesabonnerPush(sub.endpoint);
        await sub.unsubscribe();
      }
      setEtat("inactive");
    } catch {
      /* silencieux */
    } finally {
      setBusy(false);
    }
  };

  if (etat === "inconnu") return null;
  if (etat === "non-supporte")
    return <p className="muted">Les notifications ne sont pas supportées sur cet appareil.</p>;
  if (etat === "pas-de-cle")
    return <p className="muted">Notifications non configurées côté serveur (clé VAPID manquante).</p>;
  if (etat === "refuse")
    return (
      <p className="muted">
        Notifications bloquées — autorise-les dans les réglages du navigateur pour ce site.
      </p>
    );
  if (etat === "active")
    return (
      <div className="notifs">
        <span className="notifs-ok">✓ Notifications activées</span>
        <button className="notifs-btn secondaire" onClick={desactiver} disabled={busy}>
          Désactiver
        </button>
      </div>
    );
  return (
    <div className="notifs">
      <button className="notifs-btn" onClick={activer} disabled={busy}>
        {busy ? "…" : "Activer les notifications"}
      </button>
      <span className="muted">Sur iPhone : ajoute d&apos;abord l&apos;appli à l&apos;écran d&apos;accueil.</span>
    </div>
  );
}
