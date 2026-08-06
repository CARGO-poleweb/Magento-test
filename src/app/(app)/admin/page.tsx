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
import { ApiSyncPanel } from "@/components/ApiSyncPanel";
import { ImportCalendarForm } from "@/components/ImportCalendarForm";
import { DeleteMemberPanel } from "@/components/DeleteMemberPanel";
import { InviteLinkPanel } from "@/components/InviteLinkPanel";
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

  // Une journée clôturée n'appelle plus aucune action : on la replie pour que la
  // configuration reste atteignable même en fin de saison (34 journées).
  const actionDays = days.filter((d) => d.status !== "terminee");
  const doneDays = days.filter((d) => d.status === "terminee");

  const trackedOf = (seasonId: number) =>
    memberships.filter((m) => m.season_id === seasonId && m.tracked).length;
  const currentTracked = season ? trackedOf(season.id) : 0;

  const currentMemberships = season ? memberships.filter((m) => m.season_id === season.id) : [];
  const currentTeams = currentMemberships
    .map((m) => ({ team: teamById.get(m.team_id), tracked: m.tracked }))
    .filter((x): x is { team: Team; tracked: boolean } => Boolean(x.team))
    .sort((a, b) => a.team.short_name.localeCompare(b.team.short_name));

  const TeamSelect = ({ name, label }: { name: string; label: string }) => (
    <select
      name={name}
      required
      className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-2 py-2 text-sm"
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

  const DayCard = ({ day }: { day: Matchday & { fixtures: Fixture[] } }) => (
    <section className="rounded-card border border-line bg-surface p-4 shadow-[0_2px_8px_-4px_rgba(18,33,26,0.12)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-bold">
          Journée {day.number}
          {day.type === "multiplex" && " (multiplex)"}
          <span className="ml-2 rounded bg-subtle px-1.5 py-0.5 text-xs text-muted">
            {STATUS_LABELS[day.status]}
          </span>
        </h2>
        <div className="flex gap-2">
          {day.status === "brouillon" && day.fixtures.length > 0 && (
            <form action={publishMatchday}>
              <input type="hidden" name="matchday_id" value={day.id} />
              <button className="rounded-lg bg-accent text-white transition-transform active:scale-95 px-3 py-1.5 text-xs font-semibold hover:bg-accent-strong">
                Publier
              </button>
            </form>
          )}
          {day.status === "publiee" && (
            <form action={finishMatchday}>
              <input type="hidden" name="matchday_id" value={day.id} />
              <button
                className="rounded-lg bg-subtle px-3 py-1.5 text-xs font-semibold hover:bg-line"
                title="Possible uniquement quand tous les résultats sont saisis"
              >
                Clôturer
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
              <span className="w-4 text-xs text-faint">{f.position}.</span>
              <span className="min-w-32 font-medium">
                {teamById.get(f.home_team_id)?.short_name} vs{" "}
                {teamById.get(f.away_team_id)?.short_name}
              </span>
              {f.home_score !== null ? (
                <span className="text-xs text-muted">{formatKickoff(f.kickoff_at)}</span>
              ) : (
                <details className="text-xs text-muted">
                  <summary
                    className="cursor-pointer list-none hover:text-ink"
                    title="Corriger le coup d'envoi (reprogrammation TV)"
                  >
                    {formatKickoff(f.kickoff_at)}
                  </summary>
                  <form action={updateKickoff} className="mt-1 flex items-center gap-1">
                    <input type="hidden" name="fixture_id" value={f.id} />
                    <input
                      name="kickoff_at"
                      type="datetime-local"
                      required
                      className="rounded border border-line-strong bg-surface px-1 py-0.5 text-xs"
                    />
                    <button className="rounded bg-subtle px-2 py-0.5 text-xs hover:bg-line">
                      OK
                    </button>
                  </form>
                </details>
              )}
              {f.home_score !== null ? (
                <span className="rounded bg-subtle px-2 py-0.5 font-mono text-xs font-bold">
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
                    className="w-12 rounded border border-line-strong bg-surface px-1 py-1 text-center text-xs"
                  />
                  <span className="text-faint">-</span>
                  <input
                    name="away_score"
                    type="number"
                    min={0}
                    required
                    className="w-12 rounded border border-line-strong bg-surface px-1 py-1 text-center text-xs"
                  />
                  <button className="rounded bg-subtle px-2 py-1 text-xs hover:bg-line">OK</button>
                </form>
              )}
            </li>
          ))}
      </ul>

      {day.status !== "terminee" && (
        <form action={addFixture} className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          <input type="hidden" name="matchday_id" value={day.id} />
          <TeamSelect name="home_team_id" label="Domicile…" />
          <TeamSelect name="away_team_id" label="Extérieur…" />
          <input
            name="kickoff_at"
            type="datetime-local"
            required
            className="rounded-lg border border-line-strong bg-surface px-2 py-2 text-sm"
          />
          <button className="rounded-lg bg-subtle px-3 py-2 text-sm font-semibold hover:bg-line">
            + Match
          </button>
          <p className="w-full text-[11px] text-faint">
            Heure de Paris. L’ordre d’ajout = ordre de la programmation (article 10).
          </p>
        </form>
      )}
    </section>
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-lg font-semibold tracking-tight">Espace du Président</h2>
        <p className="text-xs text-muted">
          Article 1 : le Président a toujours raison.{" "}
          {season ? `Saison en cours : ${season.name}.` : "Aucune saison en cours !"} Les membres ne
          voient une journée qu’une fois publiée (article 10). ★ = équipes concernées.
        </p>
        <nav className="mt-3 flex flex-wrap gap-2 text-xs">
          {[
            { href: "#saisons", label: "Saisons ★" },
            { href: "#membres", label: "Membres" },
            { href: "#journees", label: "Journées" },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full border border-line bg-surface px-3 py-1 font-semibold text-muted hover:border-accent-line hover:text-accent-strong"
            >
              {l.label}
            </a>
          ))}
        </nav>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Configuration : ce qui se règle une fois, avant les journées        */}
      {/* ------------------------------------------------------------------ */}
      <section id="saisons" className="scroll-mt-20 rounded-xl border border-line bg-subtle p-4">
        <h2 className="mb-1 text-sm font-semibold">Saisons et équipes concernées ★</h2>
        <p className="mb-3 text-xs text-muted">
          Compose la Ligue 1 (promus/relégués) et coche les 5 équipes concernées : les 3 fixes, celle
          tirée au sort et celle choisie par le vainqueur sortant. Règle mise et échéances, puis
          bascule quand la saison démarre. L’ancienne saison reste consultable en archive depuis le
          classement.
        </p>
        {season && currentTracked < 5 && (
          <p className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
            {currentTracked}/5 équipes concernées désignées sur {season.name}. Ouvre la saison
            ci-dessous, coche la colonne ★ des équipes manquantes puis « Enregistrer la composition ».
          </p>
        )}

        <ul className="mb-4 flex flex-col gap-3">
          {allSeasons.map((s) => {
            const composition = memberships.filter((m) => m.season_id === s.id);
            const trackedCount = composition.filter((m) => m.tracked).length;
            return (
              <li key={s.id} className="rounded-lg border border-line bg-canvas/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {s.name}{" "}
                    {s.is_current ? (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
                        en cours · {trackedCount}/5 ★
                      </span>
                    ) : (
                      <span className="rounded bg-subtle px-1.5 py-0.5 text-[11px] text-muted">
                        {composition.length} clubs · {trackedCount}/5 ★
                      </span>
                    )}
                  </p>
                  {!s.is_current && (
                    <form action={activateSeason}>
                      <input type="hidden" name="season_id" value={s.id} />
                      <button className="rounded-lg bg-ink text-white px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                        Basculer la ligue sur cette saison
                      </button>
                    </form>
                  )}
                </div>

                <details className="mt-2" open={s.is_current && trackedCount < 5}>
                  <summary className="cursor-pointer text-xs text-muted">
                    {s.is_current
                      ? `Équipes concernées ★ : ${trackedCount}/5 — ajuster la composition`
                      : "Composer la Ligue 1 de cette saison"}
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
                    <button className="mt-2 rounded-lg bg-subtle px-3 py-1.5 text-xs font-semibold hover:bg-line">
                      Enregistrer la composition
                    </button>
                    <p className="mt-1 text-[11px] text-faint">
                      1ʳᵉ case = club en Ligue 1 cette saison-là · ★ = équipe concernée (5 max). Un
                      club déjà programmé dans une journée reste dans la composition.
                    </p>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>

        <details className="mb-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Préparer une nouvelle saison
          </summary>
          <form action={createSeason} className="mt-2 flex flex-col gap-2">
            <input
              name="name"
              required
              placeholder="Ligue 1 2026-2027"
              className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2 text-sm">
              <label className="flex items-center gap-1 text-xs text-muted">
                Mise (€)
                <input
                  name="mise"
                  defaultValue="20"
                  inputMode="decimal"
                  className="w-16 rounded-lg border border-line-strong bg-surface px-2 py-1.5"
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-muted">
                Part vainqueur (€)
                <input
                  name="part_vainqueur"
                  defaultValue="15"
                  inputMode="decimal"
                  className="w-16 rounded-lg border border-line-strong bg-surface px-2 py-1.5"
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-muted">
                Part Ballon d’Or (€)
                <input
                  name="part_ballon_or"
                  defaultValue="5"
                  inputMode="decimal"
                  className="w-16 rounded-lg border border-line-strong bg-surface px-2 py-1.5"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-1 text-xs text-muted">
                Virement avant le
                <input
                  name="paiement_deadline"
                  type="date"
                  required
                  className="rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-muted">
                Bonus cachés avant le
                <input
                  name="bonus_deadline"
                  type="datetime-local"
                  required
                  className="rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            <button className="self-start rounded-lg bg-ink text-white px-3 py-1.5 text-sm font-semibold hover:bg-muted">
              Créer la saison
            </button>
            <p className="text-[11px] text-faint">
              La composition démarre avec les clubs de la saison en cours (équipes concernées
              décochées) — ajuste ensuite promus, relégués et ★.
            </p>
          </form>
        </details>

        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            Ajouter un club au référentiel
          </summary>
          <form action={createTeam} className="mt-2 flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                name="short_name"
                required
                placeholder="Nom court (ex. ASSE)"
                className="w-40 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
              />
              <input
                name="full_name"
                required
                placeholder="Nom complet (ex. AS Saint-Étienne)"
                className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
              />
            </div>
            <input
              name="aliases"
              placeholder="Alias acceptés par le parseur, séparés par des virgules (ex. SAINT-ETIENNE, SAINTE, LES VERTS)"
              className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
            />
            <button className="self-start rounded-lg bg-subtle px-3 py-1.5 text-sm font-semibold hover:bg-line">
              Ajouter le club
            </button>
          </form>
        </details>
      </section>

      <section id="membres" className="scroll-mt-20 rounded-card border border-line bg-surface p-4 shadow-[0_2px_8px_-4px_rgba(18,33,26,0.12)]">
        <h2 className="mb-2 text-sm font-semibold">Membres ({members.length}/20)</h2>
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
                        ? "border-accent-line text-accent hover:bg-accent-soft"
                        : "border-danger-line text-danger hover:bg-danger-soft"
                    }`}
                  >
                    {m.is_radie ? "Réintégrer" : "Radier (article 3)"}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-faint">
          Les rôles (Premier Ministre, Commission…) s’attribuent dans Supabase — voir le README.
        </p>

        <h3 className="mt-4 mb-1 text-sm font-semibold">Inviter quelqu’un</h3>
        <p className="mb-2 text-xs text-muted">
          Génère un lien de connexion à coller dans un e-mail : le destinataire clique et il est
          dans l’app, sans mot de passe. S’il n’a pas encore de compte, il est créé au passage.
        </p>
        <InviteLinkPanel />

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-danger">
            Supprimer un compte définitivement
          </summary>
          <p className="mt-1 mb-2 text-xs text-muted">
            Pour faire le ménage des comptes de test. Rien à voir avec la radiation
            (article 3), qui garde l’historique : ici tout disparaît, sans retour possible.
          </p>
          <DeleteMemberPanel
            members={members
              .filter((m) => m.id !== profile.id)
              .map((m) => ({ id: m.id, display_name: m.display_name }))}
          />
        </details>
      </section>

      {season && !season.bonus_reveles && (
        <section className="rounded-xl border border-warn-line bg-warn-soft p-4">
          <h2 className="mb-1 text-sm font-semibold">Bonus cachés · {season.name}</h2>
          <p className="mb-2 text-xs text-muted">
            Révèle les bonus de tout le monde (irréversible) — à faire après la deadline de dépôt.
          </p>
          <form action={revealBonuses}>
            <button className="rounded-lg bg-warn text-white px-3 py-1.5 text-sm font-semibold hover:bg-warn">
              Révéler tous les bonus cachés
            </button>
          </form>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Journées : le travail de la semaine, puis les archives repliées     */}
      {/* ------------------------------------------------------------------ */}
      {season && (
        <section
          id="journees"
          className="scroll-mt-20 rounded-card border border-accent-line bg-accent-soft p-4"
        >
          <h2 className="mb-1 text-sm font-semibold">Calendrier et résultats automatiques</h2>
          <p className="mb-3 text-xs text-muted">
            Les données viennent de football-data.org. « Importer le calendrier » crée les journées
            manquantes (multiplex en J1 et J34, matchs des équipes concernées ★ le reste du temps) et
            rafraîchit les horaires des matchs pas encore joués. « Récupérer les résultats » remplit
            les scores manquants — c’est aussi fait automatiquement chaque soir. La saisie à la main
            reste possible : le Président garde le dernier mot (article 1).
          </p>
          <ApiSyncPanel configured={Boolean(process.env.FOOTBALL_DATA_TOKEN)} />
        </section>
      )}

      {actionDays.map((day) => (
        <DayCard key={day.id} day={day} />
      ))}

      {doneDays.length > 0 && (
        <details className="rounded-card border border-line bg-surface p-4 shadow-[0_2px_8px_-4px_rgba(18,33,26,0.12)]">
          <summary className="cursor-pointer text-sm font-semibold">
            Journées terminées ({doneDays.length})
          </summary>
          <div className="mt-3 flex flex-col gap-4">
            {doneDays.map((day) => (
              <DayCard key={day.id} day={day} />
            ))}
          </div>
        </details>
      )}

      {season && (
        <details className="rounded-card border border-line bg-surface p-4 shadow-[0_2px_8px_-4px_rgba(18,33,26,0.12)]">
          <summary className="cursor-pointer text-sm font-semibold">
            Outils manuels (secours)
          </summary>

          <h3 className="mt-3 text-sm font-semibold">Créer une journée à la main</h3>
          <form action={createMatchday} className="mt-2 flex flex-wrap gap-2">
            <input
              name="number"
              type="number"
              min={1}
              max={34}
              required
              placeholder="N°"
              className="w-20 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
            />
            <select
              name="type"
              className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
            >
              <option value="classique">Classique (5 matchs)</option>
              <option value="multiplex">Multiplex — J1 &amp; J34 (9 matchs)</option>
            </select>
            <button className="rounded-lg bg-accent text-white transition-transform active:scale-95 px-3 py-2 text-sm font-semibold hover:bg-accent-strong">
              Créer
            </button>
          </form>

          <h3 className="mt-4 text-sm font-semibold">Importer un calendrier collé</h3>
          <p className="mb-2 text-xs text-muted">
            Une ligne par match au format{" "}
            <code className="rounded bg-subtle px-1">
              journée ; DOMICILE ; EXTÉRIEUR ; jj/mm/aaaa hh:mm
            </code>{" "}
            (heure de Paris). Les journées sont créées en brouillon ; J1 et J34 passent
            automatiquement en multiplex.
          </p>
          <ImportCalendarForm />
        </details>
      )}
    </div>
  );
}
