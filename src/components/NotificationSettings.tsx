"use client";

import { useEffect, useState, useTransition } from "react";
import {
  deletePushSubscription,
  saveNotificationSettings,
  savePushSubscription,
} from "@/app/actions";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type Status = "loading" | "unsupported" | "ios_not_installed" | "off" | "denied" | "on";

export function NotificationSettings({
  vapidPublicKey,
  initialVestiaire,
  initialJeu,
}: {
  vapidPublicKey: string | null;
  initialVestiaire: boolean;
  initialJeu: boolean;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    async function detect() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapidPublicKey) {
        const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const installed = window.matchMedia("(display-mode: standalone)").matches;
        setStatus(isIos && !installed ? "ios_not_installed" : "unsupported");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const sub = await registration.pushManager.getSubscription();
      if (sub) setStatus("on");
      else setStatus(Notification.permission === "denied" ? "denied" : "off");
    }
    detect().catch(() => setStatus("unsupported"));
  }, [vapidPublicKey]);

  function enable() {
    setError(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus("denied");
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!) as BufferSource,
        });
        const json = sub.toJSON();
        await savePushSubscription({
          endpoint: sub.endpoint,
          keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
        });
        setStatus("on");
      } catch {
        setError("Impossible d'activer les notifications sur cet appareil.");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    });
  }

  return (
    <div className="rounded-xl border border-[#e2e9dd] bg-white p-4">
      <h2 className="font-bold">🔔 Notifications</h2>
      <p className="mt-1 text-xs text-[#75897a]">
        Sois prévenu quand une journée est publiée, quand les points tombent, quand la Commission
        tranche — et quand ça cause au Vestiaire.
      </p>

      <div className="mt-3">
        {status === "loading" && <p className="text-xs text-[#8b9c8d]">Vérification…</p>}
        {status === "ios_not_installed" && (
          <p className="rounded-lg bg-[#fdf1dc] px-3 py-2 text-xs text-amber-700">
            Sur iPhone, installe d’abord l’app : Safari → Partager → « Sur l’écran d’accueil »,
            puis reviens ici activer les notifications.
          </p>
        )}
        {status === "unsupported" && (
          <p className="text-xs text-[#8b9c8d]">
            Notifications indisponibles sur ce navigateur{!vapidPublicKey && " (clés VAPID non configurées)"}.
          </p>
        )}
        {status === "denied" && (
          <p className="rounded-lg bg-[#fde9e6] px-3 py-2 text-xs text-red-600">
            Notifications refusées dans les réglages du navigateur — réautorise-les puis reviens.
          </p>
        )}
        {status === "off" && (
          <button
            onClick={enable}
            disabled={pending}
            className="rounded-lg bg-green-600 text-white px-3 py-2 text-sm font-semibold hover:bg-green-500 disabled:opacity-50"
          >
            {pending ? "Activation…" : "Activer les notifications sur cet appareil"}
          </button>
        )}
        {status === "on" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-green-700">✅ Notifications actives sur cet appareil.</p>
            <form action={saveNotificationSettings} className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="jeu" defaultChecked={initialJeu} />
                Le jeu : journée publiée, points, décisions de la Commission
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="vestiaire" defaultChecked={initialVestiaire} />
                Le Vestiaire : chaque message du chat
              </label>
              <div className="flex gap-2">
                <button className="rounded-lg bg-[#e6eee2] px-3 py-1.5 text-xs font-semibold hover:bg-[#d8e5d2]">
                  Enregistrer mes préférences
                </button>
                <button
                  type="button"
                  onClick={disable}
                  disabled={pending}
                  className="rounded-lg border border-[#bcd9c2] px-3 py-1.5 text-xs text-[#5c7263] hover:text-[#2a3b30]"
                >
                  Désactiver sur cet appareil
                </button>
              </div>
            </form>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
