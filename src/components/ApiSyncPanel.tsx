"use client";

import { useActionState } from "react";
import { importSeasonFromApiForm, syncResultsFromApiForm, type ActionResult } from "@/app/actions";
import { CalendarPlus, Repeat } from "@/components/icons";

function Result({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p
      className={`rounded-lg px-3 py-2 text-xs ${
        result.ok ? "bg-accent-soft text-accent-strong" : "bg-danger-soft text-danger"
      }`}
    >
      <span className="font-semibold">{result.title}</span>
      {result.detail && <span className="block text-muted">{result.detail}</span>}
    </p>
  );
}

export function ApiSyncPanel({ configured }: { configured: boolean }) {
  const [importResult, importAction, importing] = useActionState<ActionResult | null, FormData>(
    importSeasonFromApiForm,
    null,
  );
  const [syncResult, syncAction, syncing] = useActionState<ActionResult | null, FormData>(
    syncResultsFromApiForm,
    null,
  );

  if (!configured) {
    return (
      <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
        Clé football-data.org absente : ajoutez <code>FOOTBALL_DATA_TOKEN</code> dans Vercel puis
        redéployez. En attendant, le calendrier et les scores se saisissent à la main.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <form action={importAction}>
          <button
            disabled={importing}
            className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition-transform hover:bg-accent-strong active:scale-95 disabled:opacity-50"
          >
            <CalendarPlus size={16} strokeWidth={2} aria-hidden />
            {importing ? "Import en cours…" : "Importer le calendrier"}
          </button>
        </form>
        <form action={syncAction}>
          <button
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg bg-subtle px-3 py-2 text-sm font-semibold transition-transform hover:bg-line active:scale-95 disabled:opacity-50"
          >
            <Repeat size={16} strokeWidth={2} aria-hidden />
            {syncing ? "Récupération…" : "Récupérer les résultats"}
          </button>
        </form>
      </div>
      <Result result={importResult} />
      <Result result={syncResult} />
    </div>
  );
}
