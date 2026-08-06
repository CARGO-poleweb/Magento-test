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
          className="min-w-0 flex-1 rounded-lg border border-[#bcd9c2] bg-white px-3 py-2 text-sm outline-none focus:border-green-600"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-green-600 text-white px-3 py-2 text-sm font-semibold hover:bg-green-500 disabled:opacity-50"
        >
          {pending ? "…" : "Parier"}
        </button>
      </form>
      {result && (
        <p
          className={`rounded-lg px-3 py-2 text-xs ${
            !result.ok
              ? "bg-[#fde9e6] text-red-700"
              : result.title.includes("Commission")
                ? "bg-[#fdf1dc] text-amber-800"
                : "bg-[#dcf5e0] text-green-800"
          }`}
        >
          <span className="font-semibold">{result.title}</span>
          {result.detail && <span className="block text-[#5c7263]">{result.detail}</span>}
        </p>
      )}
    </div>
  );
}
