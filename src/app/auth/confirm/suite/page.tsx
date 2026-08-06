"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

type Diagnostic = { source: string; message: string };

/**
 * Dernier recours du retour de lien magique.
 *
 * 1. Le flux implicite renvoie les jetons dans le fragment (#access_token=…),
 *    que le serveur ne voit jamais : on les récupère ici et on ouvre la session.
 * 2. Sinon on explique pourquoi ça a échoué, en clair. Un lien magique qui
 *    ramène à l'écran de connexion sans un mot est indébogable.
 */
function explain({ source, message }: Diagnostic): { title: string; hint: string } {
  if (/expired|invalid|already been used|not found/i.test(message)) {
    return {
      title: "Ce lien n’est plus valable",
      hint: "Un lien de connexion ne sert qu’une fois, et il expire. Certaines messageries l’ouvrent aussi automatiquement pour l’analyser, ce qui le consomme avant toi. Demande-en un nouveau et clique dessus directement depuis l’e-mail, sans copier-coller.",
    };
  }
  if (/code verifier|flow state/i.test(message)) {
    return {
      title: "Lien ouvert dans un autre navigateur",
      hint: "Ce lien doit être ouvert dans le navigateur qui l’a demandé. Redemande un lien depuis ce navigateur-ci, puis clique dessus depuis l’e-mail ouvert sur le même téléphone.",
    };
  }
  if (source === "aucun") {
    return {
      title: "Lien incomplet",
      hint: "L’adresse ouverte ne contenait aucun jeton de connexion. C’est en général que l’adresse de retour n’est pas autorisée côté Supabase (Authentication → URL Configuration → Redirect URLs), ou que le copier-coller a tronqué la fin du lien.",
    };
  }
  return {
    title: "La connexion n’a pas abouti",
    hint: "Redemande un lien de connexion. Si ça recommence, envoie cette page en capture au Président.",
  };
}

export default function ConfirmSuitePage() {
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const query = new URLSearchParams(window.location.search);

      // Flux implicite : les jetons sont dans le fragment.
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await createClient().auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (cancelled) return;
        if (!error) {
          window.location.replace("/");
          return;
        }
        setDiagnostic({ source: "fragment", message: error.message });
        return;
      }

      if (cancelled) return;
      setDiagnostic({
        source: query.get("source") ?? "aucun",
        message:
          query.get("message") ??
          hash.get("error_description") ??
          hash.get("error") ??
          "",
      });
    }

    finish();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!diagnostic) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
        <p className="text-sm text-muted">Connexion en cours…</p>
      </main>
    );
  }

  const { title, hint } = explain(diagnostic);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <div className="flex items-start gap-3 rounded-card border border-warn-line bg-warn-soft p-4">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>
        </div>
      </div>

      <a
        href="/login"
        className="rounded-xl bg-accent px-4 py-3 text-center font-medium text-white hover:bg-accent-strong"
      >
        Redemander un lien
      </a>

      <details className="text-xs text-faint">
        <summary className="cursor-pointer">Détail technique</summary>
        <p className="mt-1 font-mono break-all">
          source : {diagnostic.source}
          {diagnostic.message && ` · ${diagnostic.message}`}
        </p>
      </details>
    </main>
  );
}
