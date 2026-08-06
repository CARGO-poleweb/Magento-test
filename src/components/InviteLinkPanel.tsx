"use client";

import { useActionState, useState } from "react";
import { createInviteLink, type ActionResult } from "@/app/actions";
import { Copy, Mail } from "@/components/icons";

/**
 * Fabrique un lien de connexion à coller dans un e-mail : un clic et le
 * destinataire est dans l'app, sans mot de passe.
 */
export function InviteLinkPanel() {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    createInviteLink,
    null,
  );
  const [copied, setCopied] = useState(false);
  const link = result?.ok ? result.detail : null;

  return (
    <div className="flex flex-col gap-2">
      <form action={action} className="flex flex-wrap gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="president@exemple.fr"
          className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
        />
        <input
          name="display_name"
          placeholder="Prénom affiché"
          className="w-36 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
        />
        <button
          disabled={pending}
          className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition-transform hover:bg-accent-strong active:scale-95 disabled:opacity-50"
        >
          <Mail size={16} strokeWidth={2} aria-hidden />
          {pending ? "Génération…" : "Générer le lien"}
        </button>
      </form>

      {result && !result.ok && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          <span className="font-semibold">{result.title}</span>
          {result.detail && <span className="block text-muted">{result.detail}</span>}
        </p>
      )}

      {link && (
        <div className="rounded-lg bg-accent-soft p-3">
          <p className="text-xs font-semibold text-accent-strong">{result?.title}</p>
          <textarea
            readOnly
            value={link}
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-2 w-full rounded border border-accent-line bg-surface px-2 py-1 font-mono text-[11px] break-all"
          />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(link).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="mt-1 flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-line"
          >
            <Copy size={14} strokeWidth={2} aria-hidden />
            {copied ? "Copié !" : "Copier le lien"}
          </button>
          <p className="mt-1 text-[11px] text-faint">
            À coller dans l’e-mail. Usage unique et durée limitée (réglage « Email OTP expiration »
            dans Supabase) : génère-le juste avant d’envoyer.
          </p>
        </div>
      )}
    </div>
  );
}
