import { redirect } from "next/navigation";
import {
  addFixture,
  createMatchday,
  enterResult,
  finishMatchday,
  publishMatchday,
  revealBonuses,
  setRadiation,
} from "@/app/actions";
import { formatKickoff, getSessionProfile } from "@/lib/data";
import type { Fixture, Matchday, Profile, Team } from "@/lib/types";

const STATUS_LABELS = { brouillon: "brouillon", publiee: "publiée", terminee: "terminée" } as const;

export default async function AdminPage() {
  const { supabase, profile } = await getSessionProfile();
  if (profile.role !== "president") redirect("/");

  const [{ data: matchdays }, { data: teams }, { data: profiles }, { data: season }] =
    await Promise.all([
      supabase.from("matchdays").select("*, fixtures(*)").order("number"),
      supabase.from("teams").select("*").order("short_name"),
      supabase.from("profiles").select("*").order("display_name"),
      supabase.from("season_settings").select("*").eq("id", 1).single(),
    ]);

  const days = (matchdays ?? []) as (Matchday & { fixtures: Fixture[] })[];
  const allTeams = (teams ?? []) as Team[];
  const teamById = new Map(allTeams.map((t) => [t.id, t]));
  const members = (profiles ?? []) as Profile[];

  const TeamSelect = ({ name, label }: { name: string; label: string }) => (
    <select
      name={name}
      required
      className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm"
    >
      <option value="">{label}</option>
      {allTeams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.short_name}
          {t.tracked ? " ★" : ""}
        </option>
      ))}
    </select>
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-bold">🎩 Espace du Président</h1>
        <p className="text-xs text-neutral-500">
          Article 1 : le Président a toujours raison. Article 10 : les membres ne voient une journée
          qu’une fois publiée. ★ = équipes concernées.
        </p>
      </header>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="mb-2 font-bold">Créer une journée</h2>
        <form action={createMatchday} className="flex gap-2">
          <input
            name="number"
            type="number"
            min={1}
            max={34}
            required
            placeholder="N°"
            className="w-20 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          />
          <select
            name="type"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          >
            <option value="classique">Classique (5 matchs)</option>
            <option value="multiplex">Multiplex — J1 & J34 (9 matchs)</option>
          </select>
          <button className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold hover:bg-green-600">
            Créer
          </button>
        </form>
      </section>

      {days.map((day) => (
        <section key={day.id} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-bold">
              Journée {day.number}
              {day.type === "multiplex" && " (multiplex)"}
              <span className="ml-2 rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-400">
                {STATUS_LABELS[day.status]}
              </span>
            </h2>
            <div className="flex gap-2">
              {day.status === "brouillon" && day.fixtures.length > 0 && (
                <form action={publishMatchday}>
                  <input type="hidden" name="matchday_id" value={day.id} />
                  <button className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold hover:bg-green-600">
                    📣 Publier
                  </button>
                </form>
              )}
              {day.status === "publiee" && (
                <form action={finishMatchday}>
                  <input type="hidden" name="matchday_id" value={day.id} />
                  <button
                    className="rounded-lg bg-neutral-700 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-600"
                    title="Possible uniquement quand tous les résultats sont saisis"
                  >
                    🏁 Clôturer
                  </button>
                </form>
              )}
            </div>
          </div>

          <ul className="flex flex-col gap-2">
            {[...day.fixtures]
              .sort((a, b) => a.position - b.position)
              .map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-4 text-xs text-neutral-600">{f.position}.</span>
                  <span className="min-w-32 font-medium">
                    {teamById.get(f.home_team_id)?.short_name} vs{" "}
                    {teamById.get(f.away_team_id)?.short_name}
                  </span>
                  <span className="text-xs text-neutral-500">{formatKickoff(f.kickoff_at)}</span>
                  {f.home_score !== null ? (
                    <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-xs font-bold">
                      {f.home_score}-{f.away_score}
                    </span>
                  ) : (
                    <form action={enterResult} className="flex items-center gap-1">
                      <input type="hidden" name="fixture_id" value={f.id} />
                      <input
                        name="home_score"
                        type="number"
                        min={0}
                        required
                        className="w-12 rounded border border-neutral-700 bg-neutral-900 px-1 py-1 text-center text-xs"
                      />
                      <span className="text-neutral-600">-</span>
                      <input
                        name="away_score"
                        type="number"
                        min={0}
                        required
                        className="w-12 rounded border border-neutral-700 bg-neutral-900 px-1 py-1 text-center text-xs"
                      />
                      <button className="rounded bg-neutral-700 px-2 py-1 text-xs hover:bg-neutral-600">
                        OK
                      </button>
                    </form>
                  )}
                </li>
              ))}
          </ul>

          {day.status !== "terminee" && (
            <form action={addFixture} className="mt-3 flex flex-wrap gap-2 border-t border-neutral-800 pt-3">
              <input type="hidden" name="matchday_id" value={day.id} />
              <TeamSelect name="home_team_id" label="Domicile…" />
              <TeamSelect name="away_team_id" label="Extérieur…" />
              <input
                name="kickoff_at"
                type="datetime-local"
                required
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm"
              />
              <button className="rounded-lg bg-neutral-700 px-3 py-2 text-sm font-semibold hover:bg-neutral-600">
                + Match
              </button>
              <p className="w-full text-[11px] text-neutral-600">
                Heure de Paris. L’ordre d’ajout = ordre de la programmation (article 10).
              </p>
            </form>
          )}
        </section>
      ))}

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="mb-2 font-bold">Membres ({members.length}/20)</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2">
              <span className={m.is_radie ? "line-through opacity-50" : ""}>{m.display_name}</span>
              {m.id !== profile.id && (
                <form action={setRadiation}>
                  <input type="hidden" name="member_id" value={m.id} />
                  <input type="hidden" name="radie" value={m.is_radie ? "false" : "true"} />
                  <button
                    className={`rounded-lg border px-2 py-1 text-xs ${
                      m.is_radie
                        ? "border-green-800 text-green-400 hover:bg-green-950"
                        : "border-red-900 text-red-400 hover:bg-red-950"
                    }`}
                  >
                    {m.is_radie ? "Réintégrer" : "Radier (article 3)"}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-neutral-600">
          Les rôles (Premier Ministre, Commission…) s’attribuent dans Supabase — voir le README.
        </p>
      </section>

      {!season?.bonus_reveles && (
        <section className="rounded-xl border border-amber-900 bg-amber-950/30 p-4">
          <h2 className="mb-1 font-bold">Bonus cachés</h2>
          <p className="mb-2 text-xs text-neutral-400">
            Révèle les bonus de tout le monde (irréversible) — à faire après la deadline du 30/09.
          </p>
          <form action={revealBonuses}>
            <button className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-semibold hover:bg-amber-600">
              🔓 Révéler tous les bonus cachés
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
