"use client";

import { useState } from "react";
import { Mail } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

/**
 * Supabase répond en anglais et sans nuance : un délai anti-spam a la même
 * tête qu'une vraie panne. On traduit, et surtout on distingue « patiente
 * quelques secondes » de « ça a cassé ».
 */
function frenchError(message: string): { text: string; seconds: number } {
  const wait = message.match(/after (\d+) seconds?/i);
  if (wait) {
    return {
      text: `Un lien vient déjà de partir. Patiente ${wait[1]} secondes avant d’en redemander un — et pense à regarder dans les spams.`,
      seconds: Number(wait[1]),
    };
  }
  if (/rate limit/i.test(message)) {
    return {
      text: "Trop de liens demandés dans l’heure. Réessaie plus tard, ou demande au Président de te fabriquer un lien d’accès direct.",
      seconds: 60,
    };
  }
  if (/signups? not allowed|not authorized/i.test(message)) {
    return {
      text: "Cette adresse n’est pas encore inscrite à la ligue. Demande ton accès au Président (article 4).",
      seconds: 0,
    };
  }
  if (/invalid format|validate email/i.test(message)) {
    return { text: "Cette adresse e-mail ne semble pas valide.", seconds: 0 };
  }
  return { text: `Échec de l’envoi : ${message}`, seconds: 0 };
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  function startCooldown(seconds: number) {
    if (seconds <= 0) return;
    setCooldown(seconds);
    const id = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    if (error) {
      const translated = frenchError(error.message);
      setError(translated.text);
      setState("error");
      startCooldown(translated.seconds);
    } else {
      setState("sent");
      startCooldown(60);
    }
  }

  const busy = state === "sending" || cooldown > 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-10 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">La Ligue des Copains</h1>
        <p className="mt-2 text-sm text-muted">
          Pronostics, bonus cachés et Commission de discipline. Ligue 1.
        </p>
      </div>

      {state === "sent" ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 rounded-card border border-accent-line bg-accent-soft p-4 text-sm">
            <Mail size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <p>
              Lien envoyé à <span className="font-medium">{email}</span>. Ouvre l’e-mail depuis ton
              téléphone et clique sur le lien. Regarde dans les spams s’il se fait attendre.
            </p>
          </div>
          <button
            type="button"
            disabled={cooldown > 0}
            onClick={() => {
              setState("idle");
              setError(null);
            }}
            className="self-start text-xs font-semibold text-muted underline disabled:no-underline disabled:opacity-60"
          >
            {cooldown > 0 ? `Renvoyer un lien dans ${cooldown} s` : "Renvoyer un lien"}
          </button>
        </div>
      ) : (
        <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm text-muted">
            Ton e-mail — pas de mot de passe, on t’envoie un lien
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="greg@exemple.fr"
            className="rounded-xl border border-line-strong bg-surface px-4 py-3 text-base outline-none transition-colors focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-accent px-4 py-3 font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {state === "sending"
              ? "Envoi…"
              : cooldown > 0
                ? `Patiente ${cooldown} s`
                : "Recevoir mon lien"}
          </button>
          {error && (
            <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm leading-relaxed text-warn">
              {error}
            </p>
          )}
        </form>
      )}

      <p className="text-xs leading-relaxed text-faint">
        Article 4 : 20 membres maximum. Si la ligue est pleine, l’inscription sera refusée — voir
        avec le Président, qui a toujours raison.
      </p>
    </main>
  );
}
