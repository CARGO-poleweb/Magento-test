import Link from "next/link";
import { formatKickoff, getCurrentSeason, getSessionProfile } from "@/lib/data";
import type { Fixture, Matchday } from "@/lib/types";

const STATUS_LABELS = {
  brouillon: "En préparation",
  publiee: "Ouverte",
  terminee: "Terminée",
} as const;

export default async function JourneesPage() {
  const { supabase } = await getSessionProfile();
  const season = await getCurrentSeason(supabase);

  const { data } = season
    ? await supabase
        .from("matchdays")
        .select("*, fixtures(*)")
        .eq("season_id", season.id)
        .neq("status", "brouillon")
        .order("number", { ascending: false })
    : { data: [] };

  const days = (data ?? []) as (Matchday & { fixtures: Fixture[] })[];

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">Journées</h2>
      {days.length === 0 && (
        <p className="rounded-xl border border-line p-4 text-sm text-muted">
          Aucune journée publiée. Article 10 : on ne joue pas avant que la programmation ne soit
          diffusée par le Président.
        </p>
      )}
      {days.map((day) => {
        const first = [...day.fixtures].sort(
          (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
        )[0];
        return (
          <Link
            key={day.id}
            href={`/journees/${day.number}`}
            className="flex items-center justify-between rounded-xl border border-line bg-surface p-4 hover:bg-subtle"
          >
            <div>
              <p className="font-semibold">
                Journée {day.number}
                {day.type === "multiplex" && (
                  <span className="ml-2 rounded bg-warn-line px-1.5 py-0.5 text-xs text-warn">
                    MULTIPLEX
                  </span>
                )}
              </p>
              <p className="text-xs text-muted">
                {day.fixtures.length} match{day.fixtures.length > 1 ? "s" : ""}
                {first && ` · 1er coup d'envoi ${formatKickoff(first.kickoff_at)}`}
              </p>
            </div>
            <span className="text-xs text-muted">{STATUS_LABELS[day.status]}</span>
          </Link>
        );
      })}
    </div>
  );
}
