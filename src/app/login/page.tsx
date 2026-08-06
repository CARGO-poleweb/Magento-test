"use client";

import { useState } from "react";
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
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <p className="text-5xl">🏆</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">La Ligue des Copains</h1>
        <p className="mt-1 text-sm text-neutral-400">Ligue 1 · Plaisir !!!</p>
      </div>

      {state === "sent" ? (
        <div className="w-full max-w-sm rounded-xl border border-green-900 bg-green-950/50 p-4 text-center text-sm">
          📬 Lien de connexion envoyé à <span className="font-semibold">{email}</span>.
          <br />
          Ouvre l’e-mail depuis ton téléphone et clique sur le lien.
        </div>
      ) : (
        <form onSubmit={sendMagicLink} className="flex w-full max-w-sm flex-col gap-3">
          <label htmlFor="email" className="text-sm text-neutral-300">
            Ton e-mail (pas de mot de passe, on t’envoie un lien magique)
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="greg@exemple.fr"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-base outline-none focus:border-green-600"
          />
          <button
            type="submit"
            disabled={state === "sending"}
            className="rounded-lg bg-green-700 px-4 py-3 font-semibold hover:bg-green-600 disabled:opacity-50"
          >
            {state === "sending" ? "Envoi…" : "Recevoir mon lien de connexion"}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      )}

      <p className="max-w-sm text-center text-xs text-neutral-500">
        Article 4 : 20 membres maximum. Si la ligue est pleine, l’inscription sera refusée — voir
        avec le Président (qui a toujours raison).
      </p>
    </main>
  );
}
