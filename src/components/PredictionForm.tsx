"use client";

import { useActionState } from "react";
import { submitPrediction, type ActionResult } from "@/app/actions";

/**
 * Saisie libre : on tape son pronostic comme sur WhatsApp (« TFC 3-0 OM »).
 * L'app n'autocorrige rien — texte brut horodaté, la Commission tranche les cas
 * douteux.
 */
export function PredictionForm({
  fixtureId,
  placeholder,
}: {
  fixtureId: number;
  placeholder: string;
}) {
  const [result, formAction, pending] = useActionState<ActionResult | null, FormData>(
    submitPrediction,
    null,
  );

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction} className="flex gap-2">
        <input type="hidden" name="fixture_id" value={fixtureId} />
        <input
          name="raw_text"
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-accent text-white transition-transform active:scale-95 px-3 py-2 text-sm font-semibold hover:bg-accent-strong disabled:opacity-50"
        >
          {pending ? "…" : "Parier"}
        </button>
      </form>
      {result && (
        <p
          className={`rounded-lg px-3 py-2 text-xs ${
            !result.ok
              ? "bg-danger-soft text-danger"
              : result.title.includes("Commission")
                ? "bg-warn-soft text-warn"
                : "bg-accent-soft text-accent-strong"
          }`}
        >
          <span className="font-semibold">{result.title}</span>
          {result.detail && <span className="block text-muted">{result.detail}</span>}
        </p>
      )}
    </div>
  );
}
