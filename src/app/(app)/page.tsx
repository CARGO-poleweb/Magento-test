import Link from "next/link";
import { getSessionProfile } from "@/lib/data";
import { standings } from "@/lib/scoring";
import type { Fixture, Matchday, PointAdjustment, Prediction, Profile } from "@/lib/types";

export default async function ClassementPage() {
  const { supabase, profile } = await getSessionProfile();

  const [{ data: profiles }, { data: matchdays }, { data: predictions }, { data: adjustments }] =
    await Promise.all([
      supabase.from("profiles").select("*").order("display_name"),
      supabase
        .from("matchdays")
        .select("*, fixtures(*)")
        .neq("status", "brouillon")
        .order("number"),
      supabase.from("predictions").select("*"),
      supabase.from("point_adjustments").select("*"),
    ]);

  const members = (profiles ?? []) as Profile[];
  const days = (matchdays ?? []) as (Matchday & { fixtures: Fixture[] })[];
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

  const nextDay = days
    .filter((d) => d.status === "publiee")
    .sort((a, b) => a.number - b.number)[0];

  return (
    <div className="flex flex-col gap-6">
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
        <h1 className="mb-3 text-xl font-bold">Classement général</h1>
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
