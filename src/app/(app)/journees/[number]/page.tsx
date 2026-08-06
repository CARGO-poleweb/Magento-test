import Link from "next/link";
import { ChevronLeft, Lock, Unlock } from "@/components/icons";
import { notFound } from "next/navigation";
import { PredictionForm } from "@/components/PredictionForm";
import { formatKickoff, getCurrentSeason, getSessionProfile } from "@/lib/data";
import { effectivePrediction, matchdayBreakdown } from "@/lib/scoring";
import {
  isFixtureLocked,
  type Fixture,
  type Matchday,
  type Prediction,
  type Profile,
  type Team,
} from "@/lib/types";

const STATUS_CHIPS: Record<Prediction["status"], { label: string; className: string }> = {
  auto_valide: { label: "pris en compte", className: "bg-accent-soft text-accent-strong" },
  a_examiner: { label: "examen Commission", className: "bg-warn-soft text-warn" },
  comptabilise: { label: "validé par la Commission", className: "bg-accent-soft text-accent-strong" },
  non_comptabilise: { label: "non comptabilisé", className: "bg-danger-soft text-danger" },
};

export default async function JourneePage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const { supabase, profile } = await getSessionProfile();
  const season = await getCurrentSeason(supabase);
  if (!season) notFound();

  const { data: day } = await supabase
    .from("matchdays")
    .select("*, fixtures(*)")
    .eq("season_id", season.id)
    .eq("number", Number(number))
    .single<Matchday & { fixtures: Fixture[] }>();
  if (!day) notFound();

  const fixtures = [...day.fixtures].sort((a, b) => a.position - b.position);
  const fixtureIds = fixtures.map((f) => f.id);

  const [{ data: teams }, { data: profiles }, { data: predictions }] = await Promise.all([
    supabase.from("teams").select("*"),
    supabase.from("profiles").select("*").order("display_name"),
    fixtureIds.length > 0
      ? supabase.from("predictions").select("*").in("fixture_id", fixtureIds)
      : Promise.resolve({ data: [] as Prediction[] }),
  ]);

  const teamById = new Map(((teams ?? []) as Team[]).map((t) => [t.id, t]));
  const members = (profiles ?? []) as Profile[];
  const preds = (predictions ?? []) as Prediction[];

  const finished = day.status === "terminee";
  const hasResults = fixtures.some((f) => f.home_score !== null);

  const dayRanking = hasResults
    ? members
        .map((m) => ({
          member: m,
          breakdown: matchdayBreakdown(
            fixtures,
            preds.filter((p) => p.member_id === m.id),
            { finished },
          ),
        }))
        .sort((a, b) => b.breakdown.total - a.breakdown.total)
    : [];

  return (
    <div className="flex flex-col gap-5">
      {/* Pas de bouton « retour » navigateur en PWA installée : on le fournit. */}
      <Link href="/journees" className="text-xs text-muted hover:text-ink">
        <ChevronLeft size={14} className="mr-0.5 inline align-[-2px]" aria-hidden />
        Toutes les journées
      </Link>
      <header>
        <h1 className="text-xl font-bold">
          Journée {day.number}
          {day.type === "multiplex" && (
            <span className="ml-2 rounded bg-warn-line px-1.5 py-0.5 text-xs text-warn">
              MULTIPLEX
            </span>
          )}
        </h1>
        <p className="text-xs text-muted">
          Article 6 : chaque match se verrouille 30 minutes avant son coup d’envoi. Article 10 : on
          joue dans l’ordre de la programmation.
          {day.type === "multiplex" && " Article 18 : aucun bonus utilisable sur cette journée."}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        {fixtures.map((fixture) => {
          const home = teamById.get(fixture.home_team_id);
          const away = teamById.get(fixture.away_team_id);
          if (!home || !away) return null;

          const locked = isFixtureLocked(fixture);
          const fixturePreds = preds.filter((p) => p.fixture_id === fixture.id);
          const mine = fixturePreds
            .filter((p) => p.member_id === profile.id)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          const canBet = day.status === "publiee" && !locked && !profile.is_radie;

          const othersEffective = members
            .filter((m) => m.id !== profile.id)
            .map((m) => ({
              member: m,
              pred: fixturePreds
                .filter((p) => p.member_id === m.id)
                .sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                ),
            }))
            .filter(({ pred }) => pred.length > 0);

          const myEffective = effectivePrediction(mine);
          const result =
            fixture.home_score !== null && fixture.away_score !== null
              ? { home: fixture.home_score, away: fixture.away_score }
              : null;

          return (
            <article
              key={fixture.id}
              className="rounded-xl border border-line bg-surface p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold">
                  <span className="mr-2 text-xs text-faint">{fixture.position}.</span>
                  {home.short_name} <span className="text-muted">vs</span> {away.short_name}
                </h2>
                {result ? (
                  <span className="rounded bg-subtle px-2 py-0.5 font-mono text-sm font-bold">
                    {result.home}-{result.away}
                  </span>
                ) : (
                  <span className="text-xs text-muted">
                    {locked ? (
                      <>
                        <Lock size={12} className="mr-1 inline align-[-1px]" aria-hidden />
                        verrouillé
                      </>
                    ) : (
                      <>
                        <Unlock size={12} className="mr-1 inline align-[-1px]" aria-hidden />
                        {formatKickoff(fixture.kickoff_at)}
                      </>
                    )}
                  </span>
                )}
              </div>

              {mine.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1">
                  {mine.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono">« {p.raw_text} »</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] ${STATUS_CHIPS[p.status].className}`}
                      >
                        {STATUS_CHIPS[p.status].label}
                      </span>
                      {p.flag_reason && (
                        <span className="text-xs text-muted">{p.flag_reason}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {canBet && (
                <div className="mt-3">
                  <PredictionForm
                    fixtureId={fixture.id}
                    placeholder={`${home.short_name} 2-1 ${away.short_name}`}
                  />
                  {mine.length > 0 && (
                    <p className="mt-1 text-[11px] text-warn">
                      Article 6 : le premier pari est accepté — reparier ce match part en
                      Commission (carton jaune possible).
                    </p>
                  )}
                </div>
              )}

              {result && myEffective && (
                <p className="mt-2 text-xs text-muted">
                  Ton pronostic comptabilisé : {myEffective.home_score_parsed}-
                  {myEffective.away_score_parsed}
                </p>
              )}

              {othersEffective.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-xs text-muted">
                    Les paris des copains ({othersEffective.length})
                  </summary>
                  <ul className="mt-2 flex flex-col gap-1">
                    {othersEffective.map(({ member, pred }) => (
                      <li key={member.id} className="flex flex-wrap items-center gap-2">
                        <span className="text-muted">{member.display_name}</span>
                        {pred.map((p) => (
                          <span key={p.id} className="font-mono text-xs">
                            « {p.raw_text} »
                            <span
                              className={`ml-1 rounded px-1 text-[10px] ${STATUS_CHIPS[p.status].className}`}
                            >
                              {STATUS_CHIPS[p.status].label}
                            </span>
                          </span>
                        ))}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
          );
        })}
        {fixtures.length === 0 && (
          <p className="rounded-xl border border-line p-4 text-sm text-muted">
            Aucun match dans cette journée pour l’instant.
          </p>
        )}
      </section>

      {dayRanking.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold">
            Points de la journée {finished ? "(définitifs)" : "(provisoires — bonus/malus à la clôture)"}
          </h2>
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Membre</th>
                  <th className="px-3 py-2 text-right">Matchs</th>
                  <th className="px-3 py-2 text-right">Bonus</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {dayRanking.map(({ member, breakdown }) => (
                  <tr
                    key={member.id}
                    className={`border-t border-line ${member.id === profile.id ? "bg-accent-soft" : ""}`}
                  >
                    <td className="px-3 py-2">{member.display_name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{breakdown.basePoints}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted">
                      {breakdown.allExact && "tous les scores +10 · "}
                      {breakdown.allOutcomes && "tous les résultats +3"}
                      {breakdown.blankDay && "journée blanche −2"}
                      {!breakdown.allExact && !breakdown.allOutcomes && !breakdown.blankDay && "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">
                      {breakdown.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
