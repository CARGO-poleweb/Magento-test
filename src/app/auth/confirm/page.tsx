"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

/**
 * Retour du lien magique — entièrement côté navigateur, et c'est volontaire.
 *
 * L'échange se faisait avant côté serveur : le cookie de session devait être
 * écrit depuis un Route Handler, l'opération pouvait échouer en silence, et
 * l'utilisateur retombait sur l'écran de connexion sans un mot. Ici, c'est le
 * navigateur qui pose le cookie — ce qui marche toujours — et toute panne
 * s'affiche en clair.
 *
 * Trois formats de retour sont acceptés :
 *  - `#access_token=…` : flux implicite, celui des liens envoyés par e-mail.
 *    Le jeton voyage dans le lien, donc le lien fonctionne depuis n'importe
 *    quel navigateur (Gmail iOS ouvre dans Chrome, pas dans Safari) ;
 *  - `?token_hash=…&type=…` : liens fabriqués par le Président ;
 *  - `?code=…` : flux PKCE, pour les liens émis avant ce changement.
 */
type Diagnostic = { source: string; message: string };

function explain({ source, message }: Diagnostic): { title: string; hint: string } {
  if (/expired|invalid|already|not found/i.test(message)) {
    return {
      title: "Ce lien n’est plus valable",
      hint: "Un lien de connexion ne sert qu’une fois, et il expire. Certaines messageries l’ouvrent aussi d’elles-mêmes pour l’analyser, ce qui le consomme avant toi. Demandes-en un nouveau et clique dessus directement depuis l’e-mail.",
    };
  }
  if (/code verifier|flow state/i.test(message)) {
    return {
      title: "Lien ouvert dans un autre navigateur",
      hint: "Ce lien-là devait s’ouvrir dans le navigateur qui l’a demandé. Redemandes-en un : les nouveaux liens fonctionnent depuis n’importe quel navigateur.",
    };
  }
  if (source === "aucun") {
    return {
      title: "Lien incomplet",
      hint: "L’adresse ouverte ne contenait aucun jeton de connexion. C’est en général un copier-coller qui a tronqué la fin du lien — elle fait plusieurs centaines de caractères. Clique sur le lien plutôt que de le recopier.",
    };
  }
  return {
    title: "La connexion n’a pas abouti",
    hint: "Redemande un lien de connexion. Si ça recommence, montre cette page au Président.",
  };
}

export default function ConfirmPage() {
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      // Lu avant toute création de client : celui-ci consomme le fragment.
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const query = new URLSearchParams(window.location.search);
      const next = query.get("next") ?? "/";
      const supabase = createClient();

      const fail = (source: string, message: string) => {
        if (!cancelled) setDiagnostic({ source, message });
      };
      const done = () => window.location.replace(next);

      // 1. Flux implicite : les jetons sont dans le fragment.
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (cancelled) return;
        if (error) return fail("fragment", error.message);
        return done();
      }

      // 2. Lien fabriqué par le Président (valable partout).
      const tokenHash = query.get("token_hash");
      const type = query.get("type");
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          type: type as "magiclink" | "invite" | "email" | "recovery" | "signup",
          token_hash: tokenHash,
        });
        if (cancelled) return;
        if (error) return fail("token_hash", error.message);
        return done();
      }

      // 3. Anciens liens PKCE.
      const code = query.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) return fail("code", error.message);
        return done();
      }

      // 4. Déjà connecté (le client a pu absorber le fragment tout seul).
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) return done();

      const reported = hash.get("error_description") ?? query.get("error_description");
      fail(reported ? "supabase" : "aucun", reported ?? "");
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
