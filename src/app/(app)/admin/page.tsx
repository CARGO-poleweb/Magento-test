import { redirect } from "next/navigation";
import {
  activateSeason,
  addFixture,
  createMatchday,
  createSeason,
  createTeam,
  enterResult,
  finishMatchday,
  publishMatchday,
  revealBonuses,
  saveSeasonTeams,
  setRadiation,
  updateKickoff,
} from "@/app/actions";
import { ImportCalendarForm } from "@/components/ImportCalendarForm";
import { formatKickoff, getCurrentSeason, getSessionProfile } from "@/lib/data";
import type { Fixture, Matchday, Profile, Season, Team } from "@/lib/types";

const STATUS_LABELS = { brouillon: "brouillon", publiee: "publiée", terminee: "terminée" } as const;

export default async function AdminPage() {
  const { supabase, profile } = await getSessionProfile();
  if (profile.role !== "president") redirect("/");

  const season = await getCurrentSeason(supabase);

  const [{ data: matchdays }, { data: teams }, { data: seasonTeams }, { data: profiles }, { data: seasons }] =
    await Promise.all([
      season
        ? supabase
            .from("matchdays")
            .select("*, fixtures(*)")
            .eq("season_id", season.id)
            .order("number")
        : Promise.resolve({ data: [] }),
      supabase.from("teams").select("*").order("short_name"),
      supabase.from("season_teams").select("*"),
      supabase.from("profiles").select("*").order("display_name"),
      supabase.from("seasons").select("*").order("created_at"),
    ]);

  const days = (matchdays ?? []) as (Matchday & { fixtures: Fixture[] })[];
  const allTeams = (teams ?? []) as Team[];
  const teamById = new Map(allTeams.map((t) => [t.id, t]));
  const members = (profiles ?? []) as Profile[];
  const allSeasons = (seasons ?? []) as Season[];
  const memberships = (seasonTeams ?? []) as { season_id: number; team_id: number; tracked: boolean }[];

  const currentMemberships = season ? memberships.filter((m) => m.season_id === season.id) : [];
  const currentTeams = currentMemberships
    .map((m) => ({ team: teamById.get(m.team_id), tracked: m.tracked }))
    .filter((x): x is { team: Team; tracked: boolean } => Boolean(x.team))
    .sort((a, b) => a.team.short_name.localeCompare(b.team.short_name));

  const TeamSelect = ({ name, label }: { name: string; label: string }) => (
    <select
      name={name}
      required
      className="min-w-0 flex-1 rounded-lg border border-[#bcd9c2] bg-white px-2 py-2 text-sm"
    >
      <option value="">{label}</option>
      {currentTeams.map(({ team, tracked }) => (
        <option key={team.id} value={team.id}>
          {team.short_name}
          {tracked ? " ★" : ""}
        </option>
      ))}
    </select>
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-bold">🎩 Espace du Président</h1>
        <p className="text-xs text-[#75897a]">
          Article 1 : le Président a toujours raison.{" "}
          {season ? `Saison en cours : ${season.name}.` : "Aucune saison en cours !"} Les membres ne
          voient une journée qu’une fois publiée (article 10). ★ = équipes concernées.
        </p>
      </header>

      {season && (
        <section className="rounded-xl border border-[#e2e9dd] bg-white p-4">
          <h2 className="mb-1 font-bold">Importer le calendrier · {season.name}</h2>
          <p className="mb-2 text-xs text-[#75897a]">
            Le calendrier de la Ligue 1 est connu à l’avance : collez-le une fois pour toute la
            saison, une ligne par match au format{" "}
            <code className="rounded bg-[#eef2ea] px-1">
              journée ; DOMICILE ; EXTÉRIEUR ; jj/mm/aaaa hh:mm
            </code>{" "}
            (heure de Paris). Les journées sont créées en brouillon — il ne restera qu’à publier
            chaque semaine et corriger les horaires quand la TV les déplace. J1 et J34 passent
            automatiquement en multiplex.
          </p>
          <ImportCalendarForm />
        </section>
      )}

      {season && (
        <section className="rounded-xl border border-[#e2e9dd] bg-white p-4">
          <h2 className="mb-2 font-bold">Créer une journée à la main · {season.name}</h2>
          <form action={createMatchday} className="flex gap-2">
            <input
              name="number"
              type="number"
              min={1}
              max={34}
              required
              placeholder="N°"
              className="w-20 rounded-lg border border-[#bcd9c2] bg-white px-3 py-2 text-sm"
            />
            <select
              name="type"
              className="rounded-lg border border-[#bcd9c2] bg-white px-3 py-2 text-sm"
            >
              <option value="classique">Classique (5 matchs)</option>
              <option value="multiplex">Multiplex — J1 & J34 (9 matchs)</option>
            </select>
            <button className="rounded-lg bg-green-600 text-white px-3 py-2 text-sm font-semibold hover:bg-green-500">
              Créer
            </button>
          </form>
        </section>
      )}

      {days.map((day) => (
        <section key={day.id} className="rounded-xl border border-[#e2e9dd] bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-bold">
              Journée {day.number}
              {day.type === "multiplex" && " (multiplex)"}
              <span className="ml-2 rounded bg-[#eef2ea] px-1.5 py-0.5 text-xs text-[#5c7263]">
                {STATUS_LABELS[day.status]}
              </span>
            </h2>
            <div className="flex gap-2">
              {day.status === "brouillon" && day.fixtures.length > 0 && (
                <form action={publishMatchday}>
                  <input type="hidden" name="matchday_id" value={day.id} />
                  <button className="rounded-lg bg-green-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-green-500">
                    📣 Publier
                  </button>
                </form>
              )}
              {day.status === "publiee" && (
                <form action={finishMatchday}>
                  <input type="hidden" name="matchday_id" value={day.id} />
                  <button
                    className="rounded-lg bg-[#e6eee2] px-3 py-1.5 text-xs font-semibold hover:bg-[#d8e5d2]"
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
                  <span className="w-4 text-xs text-[#8b9c8d]">{f.position}.</span>
                  <span className="min-w-32 font-medium">
                    {teamById.get(f.home_team_id)?.short_name} vs{" "}
                    {teamById.get(f.away_team_id)?.short_name}
                  </span>
                  {f.home_score !== null ? (
                    <span className="text-xs text-[#75897a]">{formatKickoff(f.kickoff_at)}</span>
                  ) : (
                    <details className="text-xs text-[#75897a]">
                      <summary
                        className="cursor-pointer list-none hover:text-[#3a4d40]"
                        title="Corriger le coup d'envoi (reprogrammation TV)"
                      >
                        🕓 {formatKickoff(f.kickoff_at)}
                      </summary>
                      <form action={updateKickoff} className="mt-1 flex items-center gap-1">
                        <input type="hidden" name="fixture_id" value={f.id} />
                        <input
                          name="kickoff_at"
                          type="datetime-local"
                          required
                          className="rounded border border-[#bcd9c2] bg-white px-1 py-0.5 text-xs"
                        />
                        <button className="rounded bg-[#e6eee2] px-2 py-0.5 text-xs hover:bg-[#d8e5d2]">
                          OK
                        </button>
                      </form>
                    </details>
                  )}
                  {f.home_score !== null ? (
                    <span className="rounded bg-[#eef2ea] px-2 py-0.5 font-mono text-xs font-bold">
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
                        className="w-12 rounded border border-[#bcd9c2] bg-white px-1 py-1 text-center text-xs"
                      />
                      <span className="text-[#8b9c8d]">-</span>
                      <input
                        name="away_score"
                        type="number"
                        min={0}
                        required
                        className="w-12 rounded border border-[#bcd9c2] bg-white px-1 py-1 text-center text-xs"
                      />
                      <button className="rounded bg-[#e6eee2] px-2 py-1 text-xs hover:bg-[#d8e5d2]">
                        OK
                      </button>
                    </form>
                  )}
                </li>
              ))}
          </ul>

          {day.status !== "terminee" && (
            <form action={addFixture} className="mt-3 flex flex-wrap gap-2 border-t border-[#e2e9dd] pt-3">
              <input type="hidden" name="matchday_id" value={day.id} />
              <TeamSelect name="home_team_id" label="Domicile…" />
              <TeamSelect name="away_team_id" label="Extérieur…" />
              <input
                name="kickoff_at"
                type="datetime-local"
                required
                className="rounded-lg border border-[#bcd9c2] bg-white px-2 py-2 text-sm"
              />
              <button className="rounded-lg bg-[#e6eee2] px-3 py-2 text-sm font-semibold hover:bg-[#d8e5d2]">
                + Match
              </button>
              <p className="w-full text-[11px] text-[#8b9c8d]">
                Heure de Paris. L’ordre d’ajout = ordre de la programmation (article 10).
              </p>
            </form>
          )}
        </section>
      ))}

      <section className="rounded-xl border border-[#e2e9dd] bg-white p-4">
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
                        ? "border-[#9fdcb0] text-green-700 hover:bg-[#dcf5e0]"
                        : "border-[#f6c9c2] text-red-600 hover:bg-[#fde9e6]"
                    }`}
                  >
                    {m.is_radie ? "Réintégrer" : "Radier (article 3)"}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-[#8b9c8d]">
          Les rôles (Premier Ministre, Commission…) s’attribuent dans Supabase — voir le README.
        </p>
      </section>

      {season && !season.bonus_reveles && (
        <section className="rounded-xl border border-[#f0d9a8] bg-[#fdf3e0] p-4">
          <h2 className="mb-1 font-bold">Bonus cachés · {season.name}</h2>
          <p className="mb-2 text-xs text-[#5c7263]">
            Révèle les bonus de tout le monde (irréversible) — à faire après la deadline de dépôt.
          </p>
          <form action={revealBonuses}>
            <button className="rounded-lg bg-amber-500 text-white px-3 py-1.5 text-sm font-semibold hover:bg-amber-400">
              🔓 Révéler tous les bonus cachés
            </button>
          </form>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Saisons : préparer 2026-2027 et les suivantes                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-xl border border-[#bcd7f0] bg-[#eaf3fc] p-4">
        <h2 className="mb-1 font-bold">📆 Saisons</h2>
        <p className="mb-3 text-xs text-[#5c7263]">
          Prépare la saison suivante pendant que l’actuelle se joue : compose la Ligue 1
          (promus/relégués), coche les 5 équipes concernées (dont celle tirée au sort et celle
          choisie par le vainqueur sortant), règle mise et échéances, puis bascule. L’ancienne
          saison reste consultable en archive depuis le classement.
        </p>

        <ul className="mb-4 flex flex-col gap-3">
          {allSeasons.map((s) => {
            const composition = memberships.filter((m) => m.season_id === s.id);
            const trackedCount = composition.filter((m) => m.tracked).length;
            return (
              <li key={s.id} className="rounded-lg border border-[#e2e9dd] bg-[#f5f9f2]/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {s.name}{" "}
                    {s.is_current ? (
                      <span className="rounded bg-green-900/60 px-1.5 py-0.5 text-[11px] text-green-800">
                        en cours
                      </span>
                    ) : (
                      <span className="rounded bg-[#eef2ea] px-1.5 py-0.5 text-[11px] text-[#5c7263]">
                        {composition.length} clubs · {trackedCount}/5 ★
                      </span>
                    )}
                  </p>
                  {!s.is_current && (
                    <form action={activateSeason}>
                      <input type="hidden" name="season_id" value={s.id} />
                      <button className="rounded-lg bg-sky-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-sky-500">
                        🔁 Basculer la ligue sur cette saison
                      </button>
                    </form>
                  )}
                </div>

                {!s.is_current && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-[#5c7263]">
                      Composer la Ligue 1 de cette saison
                    </summary>
                    <form action={saveSeasonTeams} className="mt-2">
                      <input type="hidden" name="season_id" value={s.id} />
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                        {allTeams.map((t) => {
                          const m = composition.find((c) => c.team_id === t.id);
                          return (
                            <div key={t.id} className="flex items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                id={`in_${s.id}_${t.id}`}
                                name={`in_${t.id}`}
                                defaultChecked={Boolean(m)}
                              />
                              <label htmlFor={`in_${s.id}_${t.id}`} className="flex-1">
                                {t.short_name}
                              </label>
                              <input
                                type="checkbox"
                                id={`tracked_${s.id}_${t.id}`}
                                name={`tracked_${t.id}`}
                                defaultChecked={Boolean(m?.tracked)}
                                title="Équipe concernée"
                              />
                              <label htmlFor={`tracked_${s.id}_${t.id}`}>★</label>
                            </div>
                          );
                        })}
                      </div>
                      <button className="mt-2 rounded-lg bg-[#e6eee2] px-3 py-1.5 text-xs font-semibold hover:bg-[#d8e5d2]">
                        Enregistrer la composition
                      </button>
                      <p className="mt-1 text-[11px] text-[#8b9c8d]">
                        1ʳᵉ case = club en Ligue 1 cette saison-là · ★ = équipe concernée (5 max).
                      </p>
                    </form>
                  </details>
                )}
              </li>
            );
          })}
        </ul>

        <details className="mb-3">
          <summary className="cursor-pointer text-sm font-semibold">
            ➕ Préparer une nouvelle saison (ex. 2026-2027)
          </summary>
          <form action={createSeason} className="mt-2 flex flex-col gap-2">
            <input
              name="name"
              required
              placeholder="Ligue 1 2026-2027"
              className="rounded-lg border border-[#bcd9c2] bg-white px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2 text-sm">
              <label className="flex items-center gap-1 text-xs text-[#5c7263]">
                Mise (€)
                <input
                  name="mise"
                  defaultValue="20"
                  inputMode="decimal"
                  className="w-16 rounded-lg border border-[#bcd9c2] bg-white px-2 py-1.5"
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-[#5c7263]">
                Part vainqueur (€)
                <input
                  name="part_vainqueur"
                  defaultValue="15"
                  inputMode="decimal"
                  className="w-16 rounded-lg border border-[#bcd9c2] bg-white px-2 py-1.5"
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-[#5c7263]">
                Part Ballon d’Or (€)
                <input
                  name="part_ballon_or"
                  defaultValue="5"
                  inputMode="decimal"
                  className="w-16 rounded-lg border border-[#bcd9c2] bg-white px-2 py-1.5"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-1 text-xs text-[#5c7263]">
                Virement avant le
                <input
                  name="paiement_deadline"
                  type="date"
                  required
                  className="rounded-lg border border-[#bcd9c2] bg-white px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-[#5c7263]">
                Bonus cachés avant le
                <input
                  name="bonus_deadline"
                  type="datetime-local"
                  required
                  className="rounded-lg border border-[#bcd9c2] bg-white px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            <button className="self-start rounded-lg bg-sky-600 text-white px-3 py-1.5 text-sm font-semibold hover:bg-sky-500">
              Créer la saison
            </button>
            <p className="text-[11px] text-[#8b9c8d]">
              La composition démarre avec les clubs de la saison en cours (équipes concernées
              décochées) — ajuste ensuite promus, relégués et ★.
            </p>
          </form>
        </details>

        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            ➕ Ajouter un club au référentiel (promu absent de la liste)
          </summary>
          <form action={createTeam} className="mt-2 flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                name="short_name"
                required
                placeholder="Nom court (ex. ASSE)"
                className="w-40 rounded-lg border border-[#bcd9c2] bg-white px-3 py-2 text-sm"
              />
              <input
                name="full_name"
                required
                placeholder="Nom complet (ex. AS Saint-Étienne)"
                className="min-w-0 flex-1 rounded-lg border border-[#bcd9c2] bg-white px-3 py-2 text-sm"
              />
            </div>
            <input
              name="aliases"
              placeholder="Alias acceptés par le parseur, séparés par des virgules (ex. SAINT-ETIENNE, SAINTE, LES VERTS)"
              className="rounded-lg border border-[#bcd9c2] bg-white px-3 py-2 text-sm"
            />
            <button className="self-start rounded-lg bg-[#e6eee2] px-3 py-1.5 text-sm font-semibold hover:bg-[#d8e5d2]">
              Ajouter le club
            </button>
          </form>
        </details>
      </section>
    </div>
  );
}
