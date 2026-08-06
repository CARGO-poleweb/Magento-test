"use client";

import { useState } from "react";
import { Mail } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

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
      setError(error.message);
      setState("error");
    } else {
      setState("sent");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-10 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">La Ligue des Copains</h1>
        <p className="mt-2 text-sm text-muted">
          Pronostics, bonus cachés et Commission de discipline. Ligue 1.
        </p>
      </div>

      {state === "sent" ? (
        <div className="flex items-start gap-3 rounded-card border border-accent-line bg-accent-soft p-4 text-sm">
          <Mail size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <p>
            Lien envoyé à <span className="font-medium">{email}</span>. Ouvre l’e-mail depuis ton
            téléphone et clique sur le lien.
          </p>
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
            disabled={state === "sending"}
            className="rounded-xl bg-accent px-4 py-3 font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {state === "sending" ? "Envoi…" : "Recevoir mon lien"}
          </button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>
      )}

      <p className="text-xs leading-relaxed text-faint">
        Article 4 : 20 membres maximum. Si la ligue est pleine, l’inscription sera refusée — voir
        avec le Président, qui a toujours raison.
      </p>
    </main>
  );
}
