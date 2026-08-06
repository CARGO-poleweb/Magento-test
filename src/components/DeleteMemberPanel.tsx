"use client";

import { useActionState, useState } from "react";
import { deleteMember, type ActionResult } from "@/app/actions";
import { AlertTriangle, Trash2 } from "@/components/icons";

type Member = { id: string; display_name: string };

/**
 * Suppression définitive, pour le ménage des comptes de test. Irréversible :
 * on demande de recopier le nom, une liste déroulante seule se déclenche trop
 * facilement du pouce.
 */
export function DeleteMemberPanel({ members }: { members: Member[] }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    deleteMember,
    null,
  );
  const [selected, setSelected] = useState("");

  const target = members.find((m) => m.id === selected);

  return (
    <form action={action} className="flex flex-col gap-2">
      <select
        name="member_id"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-base sm:text-sm"
      >
        <option value="">Compte à supprimer…</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.display_name}
          </option>
        ))}
      </select>

      {target && (
        <>
          <p className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-xs leading-relaxed text-danger">
            <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Définitif. Ses pronostics, bonus cachés, lignes de cagnotte, messages et photos du
              Vestiaire disparaissent avec lui. Pour garder l’historique, radie-le plutôt
              (article 3).
            </span>
          </p>
          <input
            name="confirmation"
            required
            autoComplete="off"
            placeholder={`Recopie « ${target.display_name} » pour confirmer`}
            className="w-full rounded-lg border border-danger-line bg-surface px-3 py-2 text-base sm:text-sm"
          />
          <button
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-50 sm:w-auto sm:self-start"
          >
            <Trash2 size={16} strokeWidth={2} aria-hidden />
            {pending ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </>
      )}

      {result && (
        <p
          className={`rounded-lg px-3 py-2 text-xs ${
            result.ok ? "bg-accent-soft text-accent-strong" : "bg-danger-soft text-danger"
          }`}
        >
          <span className="font-semibold">{result.title}</span>
          {result.detail && <span className="block text-muted">{result.detail}</span>}
        </p>
      )}
    </form>
  );
}
