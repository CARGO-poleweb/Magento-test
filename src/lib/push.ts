import "server-only";
import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Envoi de notifications Web Push. Sans clés VAPID configurées, tout est
 * silencieusement désactivé — l'app fonctionne, juste sans notifications.
 *
 * `kind` respecte les préférences par membre :
 *   - "vestiaire" : messages du chat (les bavards se coupent sans perdre le jeu)
 *   - "jeu"       : journée publiée, clôture, décisions de la Commission
 */
export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type PushOptions = {
  /** Membres à ne pas notifier (ex. l'auteur du message). */
  exclude?: string[];
  /** Si présent, seuls ces membres sont notifiés. */
  only?: string[];
};

export async function sendPush(
  kind: "vestiaire" | "jeu",
  payload: PushPayload,
  opts: PushOptions = {},
): Promise<void> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:president@liguedescopains.fr",
    publicKey,
    privateKey,
  );

  const service = createServiceClient();
  const [{ data: settings }, { data: subs }] = await Promise.all([
    service.from("notification_settings").select("*"),
    service.from("push_subscriptions").select("*"),
  ]);

  const muted = new Set(
    ((settings ?? []) as { member_id: string; vestiaire: boolean; jeu: boolean }[])
      .filter((s) => !s[kind])
      .map((s) => s.member_id),
  );

  const targets = ((subs ?? []) as {
    endpoint: string;
    member_id: string;
    p256dh: string;
    auth: string;
  }[])
    .filter((s) => !muted.has(s.member_id))
    .filter((s) => !opts.exclude?.includes(s.member_id))
    .filter((s) => !opts.only || opts.only.includes(s.member_id));

  const body = JSON.stringify(payload);
  await Promise.allSettled(
    targets.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
      } catch (error) {
        // Abonnement mort (app désinstallée, permissions révoquées) : on purge.
        const status = (error as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await service.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }),
  );
}
