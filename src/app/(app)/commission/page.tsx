import { redirect } from "next/navigation";
import { addAdjustment, decidePrediction } from "@/app/actions";
import { canJudge, getCurrentSeason, getSessionProfile } from "@/lib/data";
import type { Matchday, PointAdjustment, Profile } from "@/lib/types";

type PredictionRow = {
  id: string;
  raw_text: string;
  flag_reason: string | null;
  status: string;
  created_at: string;
  decided_at: string | null;
  member: { display_name: string } | null;
  decided: { display_name: string } | null;
  fixture: {
    kickoff_at: string;
    home: { short_name: string } | null;
    away: { short_name: string } | null;
    matchday: { number: number } | null;
  } | null;
};

const PREDICTION_SELECT = `id, raw_text, flag_reason, status, created_at, decided_at,
  member:member_id(display_name),
  decided:decided_by(display_name),
  fixture:fixture_id(kickoff_at, home:home_team_id(short_name), away:away_team_id(short_name), matchday:matchday_id(number))`;

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "short",
  timeStyle: "short",
});

export default async function CommissionPage() {
  const { supabase, profile } = await getSessionProfile();
  if (!canJudge(profile.role)) redirect("/");
  const season = await getCurrentSeason(supabase);

  const [{ data: pending }, { data: decided }, { data: profiles }, { data: matchdays }, { data: adjustments }] =
    await Promise.all([
      supabase
        .from("predictions")
        .select(PREDICTION_SELECT)
        .eq("status", "a_examiner")
        .order("created_at"),
      supabase
        .from("predictions")
        .select(PREDICTION_SELECT)
        .in("status", ["comptabilise", "non_comptabilise"])
        .order("decided_at", { ascending: false })
        .limit(15),
      supabase.from("profiles").select("*").order("display_name"),
      season
        ? supabase
            .from("matchdays")
            .select("*")
            .eq("season_id", season.id)
            .neq("status", "brouillon")
            .order("number")
        : Promise.resolve({ data: [] }),
      season
        ? supabase
            .from("point_adjustments")
            .select("*, member:member_id(display_name)")
            .eq("season_id", season.id)
            .order("created_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
    ]);

  const pendingRows = (pending ?? []) as unknown as PredictionRow[];
  const decidedRows = (decided ?? []) as unknown as PredictionRow[];
  const members = ((profiles ?? []) as Profile[]).filter((m) => !m.is_radie);
  const days = (matchdays ?? []) as Matchday[];
  const adjRows = (adjustments ?? []) as unknown as (PointAdjustment & {
    member: { display_name: string } | null;
  })[];

  const FixtureLabel = ({ row }: { row: PredictionRow }) => (
    <span className="text-xs text-[#75897a]">
      J{row.fixture?.matchday?.number ?? "?"} · {row.fixture?.home?.short_name} vs{" "}
      {row.fixture?.away?.short_name} · parié le {dateFmt.format(new Date(row.created_at))}
    </span>
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-bold">⚖️ Commission de discipline</h1>
        <p className="text-xs text-[#75897a]">
          Articles 6, 7 et 8 : la Commission se réserve le droit de ne pas comptabiliser un
          pronostic fautif, ambigu ou en doublon. Le texte brut horodaté fait foi.
        </p>
      </header>

      <section>
        <h2 className="mb-2 font-bold">À juger ({pendingRows.length})</h2>
        <div className="flex flex-col gap-3">
          {pendingRows.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-[#f0d9a8] bg-[#fdf3e0] p-4"
            >
              <p className="text-sm">
                <span className="font-semibold">{row.member?.display_name ?? "?"}</span> a écrit{" "}
                <span className="font-mono">« {row.raw_text} »</span>
              </p>
              <FixtureLabel row={row} />
              <p className="mt-1 text-xs text-amber-700">⚠️ {row.flag_reason}</p>
              <div className="mt-3 flex gap-2">
                <form action={decidePrediction}>
                  <input type="hidden" name="prediction_id" value={row.id} />
                  <input type="hidden" name="decision" value="comptabilise" />
                  <button className="rounded-lg bg-green-800 px-3 py-1.5 text-xs font-semibold hover:bg-green-600 text-white">
                    ✅ Comptabiliser
                  </button>
                </form>
                <form action={decidePrediction}>
                  <input type="hidden" name="prediction_id" value={row.id} />
                  <input type="hidden" name="decision" value="non_comptabilise" />
                  <button className="rounded-lg bg-red-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-red-500">
                    ❌ Ne pas comptabiliser
                  </button>
                </form>
              </div>
            </article>
          ))}
          {pendingRows.length === 0 && (
            <p className="rounded-xl border border-[#e2e9dd] p-4 text-sm text-[#75897a]">
              Rien à juger — tout le monde écrit correctement, pour une fois.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[#e2e9dd] bg-white p-4">
        <h2 className="mb-1 font-bold">Sanction sur le classement général</h2>
        <p className="mb-2 text-[11px] text-[#75897a]">
          Ex. : message modifié −2 pts (article 12), vidéo d’anniversaire manquée −3 pts (article
          21), vote hors délai −3 pts (article 22), challenge séché −3 pts (article 23), zéro
          évènement −5 pts (article 24). Un bonus du Bureau se saisit en points positifs.
        </p>
        <form action={addAdjustment} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <select
              name="member_id"
              required
              className="min-w-0 flex-1 rounded-lg border border-[#bcd9c2] bg-white px-2 py-2 text-sm"
            >
              <option value="">Membre…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
            <input
              name="points"
              type="number"
              required
              placeholder="± pts"
              className="w-20 rounded-lg border border-[#bcd9c2] bg-white px-2 py-2 text-sm"
            />
            <select
              name="matchday_id"
              className="rounded-lg border border-[#bcd9c2] bg-white px-2 py-2 text-sm"
            >
              <option value="">Journée (opt.)</option>
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  J{d.number}
                </option>
              ))}
            </select>
          </div>
          <input
            name="reason"
            required
            placeholder="Motif (article du règlement…)"
            className="rounded-lg border border-[#bcd9c2] bg-white px-3 py-2 text-sm"
          />
          <button className="self-start rounded-lg bg-[#e6eee2] px-3 py-1.5 text-sm font-semibold hover:bg-[#d8e5d2]">
            Appliquer
          </button>
        </form>
      </section>

      {adjRows.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold">Casier (dernières décisions)</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {adjRows.map((a) => (
              <li key={a.id} className="flex justify-between gap-2 text-[#5c7263]">
                <span>
                  {a.member?.display_name ?? "?"} — {a.reason}
                </span>
                <span className={a.points < 0 ? "font-bold text-red-600" : "font-bold text-green-700"}>
                  {a.points > 0 ? `+${a.points}` : a.points}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {decidedRows.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold">Pronostics déjà jugés</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {decidedRows.map((row) => (
              <li key={row.id} className="rounded-lg border border-[#e2e9dd] p-2">
                <span className="font-semibold">{row.member?.display_name}</span>{" "}
                <span className="font-mono text-xs">« {row.raw_text} »</span>{" "}
                <span
                  className={row.status === "comptabilise" ? "text-green-700" : "text-red-600"}
                >
                  {row.status === "comptabilise" ? "✅ comptabilisé" : "❌ non comptabilisé"}
                </span>
                <span className="block text-[11px] text-[#8b9c8d]">
                  par {row.decided?.display_name ?? "?"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
