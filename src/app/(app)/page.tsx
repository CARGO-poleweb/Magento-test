import Link from "next/link";
import { getSessionProfile } from "@/lib/data";
import { standings } from "@/lib/scoring";
import type {
  Fixture,
  Matchday,
  PointAdjustment,
  Prediction,
  Profile,
  Season,
} from "@/lib/types";

export default async function ClassementPage({
  searchParams,
}: {
  searchParams: Promise<{ saison?: string }>;
}) {
  const { saison } = await searchParams;
  const { supabase, profile } = await getSessionProfile();

  const { data: seasonsData } = await supabase
    .from("seasons")
    .select("*")
    .order("created_at", { ascending: false });
  const seasons = (seasonsData ?? []) as Season[];
  const currentSeason = seasons.find((s) => s.is_current) ?? null;
  const viewedSeason =
    (saison && seasons.find((s) => s.id === Number(saison))) || currentSeason || seasons[0];

  if (!viewedSeason) {
    return (
      <p className="rounded-xl border border-neutral-800 p-4 text-sm text-neutral-500">
        Aucune saison configurée — le Président doit en créer une.
      </p>
    );
  }

  const [{ data: profiles }, { data: matchdays }, { data: adjustments }] = await Promise.all([
    supabase.from("profiles").select("*").order("display_name"),
    supabase
      .from("matchdays")
      .select("*, fixtures(*)")
      .eq("season_id", viewedSeason.id)
      .neq("status", "brouillon")
      .order("number"),
    supabase.from("point_adjustments").select("*").eq("season_id", viewedSeason.id),
  ]);

  const days = (matchdays ?? []) as (Matchday & { fixtures: Fixture[] })[];
  const fixtureIds = days.flatMap((d) => d.fixtures.map((f) => f.id));
  const { data: predictions } =
    fixtureIds.length > 0
      ? await supabase.from("predictions").select("*").in("fixture_id", fixtureIds)
      : { data: [] as Prediction[] };

  const members = (profiles ?? []) as Profile[];
  const preds = (predictions ?? []) as Prediction[];

  const predictionsByMember = new Map<string, Prediction[]>();
  for (const p of preds) {
    const list = predictionsByMember.get(p.member_id) ?? [];
    list.push(p);
    predictionsByMember.set(p.member_id, list);
  }

  const rows = standings(
    members.map((m) => m.id),
    days.map((d) => ({ fixtures: d.fixtures, finished: d.status === "terminee" })),
    predictionsByMember,
    (adjustments ?? []) as PointAdjustment[],
  );

  const byId = new Map(members.map((m) => [m.id, m]));
  const medals = ["🥇", "🥈", "🥉"];
  const isArchive = !viewedSeason.is_current;

  const nextDay = isArchive
    ? undefined
    : days.filter((d) => d.status === "publiee").sort((a, b) => a.number - b.number)[0];

  return (
    <div className="flex flex-col gap-6">
      {seasons.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {seasons.map((s) => (
            <Link
              key={s.id}
              href={s.is_current ? "/" : `/?saison=${s.id}`}
              className={`rounded-full border px-3 py-1 text-xs ${
                s.id === viewedSeason.id
                  ? "border-green-700 bg-green-950/60 text-green-300"
                  : "border-neutral-700 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {s.name}
              {s.is_current && " · en cours"}
            </Link>
          ))}
        </div>
      )}

      {isArchive && (
        <p className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3 text-xs text-neutral-400">
          📜 Archive : classement final de la saison {viewedSeason.name}.
        </p>
      )}

      {nextDay && (
        <Link
          href={`/journees/${nextDay.number}`}
          className="rounded-xl border border-green-900 bg-green-950/40 p-4 text-sm hover:bg-green-950/70"
        >
          ⚽ <span className="font-semibold">Journée {nextDay.number}</span>
          {nextDay.type === "multiplex" && " (MULTIPLEX)"} — journée en cours, à toi de jouer →
        </Link>
      )}

      <section>
        <h1 className="mb-3 text-xl font-bold">
          Classement général <span className="text-sm font-normal text-neutral-500">· {viewedSeason.name}</span>
        </h1>
        <div className="overflow-hidden rounded-xl border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Membre</th>
                <th className="px-3 py-2 text-right">Journées</th>
                <th className="px-3 py-2 text-right">Sanctions</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const member = byId.get(row.memberId);
                if (!member) return null;
                const isMe = member.id === profile.id;
                return (
                  <tr
                    key={row.memberId}
                    className={`border-t border-neutral-800 ${isMe ? "bg-green-950/30" : ""} ${member.is_radie ? "opacity-40" : ""}`}
                  >
                    <td className="px-3 py-2">{medals[i] ?? i + 1}</td>
                    <td className="px-3 py-2 font-medium">
                      {member.display_name}
                      {member.is_radie && " ⛔"}
                      {isMe && <span className="ml-1 text-xs text-green-500">(toi)</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.matchdayPoints}</td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${row.adjustments < 0 ? "text-red-400" : "text-neutral-500"}`}
                    >
                      {row.adjustments !== 0 ? row.adjustments : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{row.total}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                    Personne au classement pour l’instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-neutral-600">
          Barème : score exact 4 pts · bonne différence de buts 3 pts · bon vainqueur 2 pts · tous
          les résultats +3 · tous les scores +10 · journée blanche −2.
        </p>
      </section>
    </div>
  );
}
