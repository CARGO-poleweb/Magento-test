"use client";

import { useActionState } from "react";
import { importCalendar, type ActionResult } from "@/app/actions";

const PLACEHOLDER = `1 ; TFC ; NANTES ; 15/08/2026 21:00
1 ; PSG ; ANGERS ; 16/08/2026 17:00
1 ; OM ; BREST ; 16/08/2026 21:05
2 ; MONACO ; TFC ; 22/08/2026 19:00
…`;

export function ImportCalendarForm() {
  const [result, formAction, pending] = useActionState<ActionResult | null, FormData>(
    importCalendar,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <textarea
        name="calendar"
        rows={8}
        placeholder={PLACEHOLDER}
        spellCheck={false}
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-xs outline-none focus:border-green-600"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-green-700 px-3 py-1.5 text-sm font-semibold hover:bg-green-600 disabled:opacity-50"
      >
        {pending ? "Import…" : "Importer le calendrier"}
      </button>
      {result && (
        <p
          className={`rounded-lg px-3 py-2 text-xs ${
            result.ok ? "bg-green-950/60 text-green-300" : "bg-red-950/60 text-red-300"
          }`}
        >
          <span className="font-semibold">{result.title}</span>
          {result.detail && <span className="block text-neutral-400">{result.detail}</span>}
        </p>
      )}
    </form>
  );
}
