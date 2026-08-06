import Link from "next/link";
import { canJudge, formatKickoff, getSessionProfile } from "@/lib/data";
import { matchdayBreakdown, standings } from "@/lib/scoring";
import { isFixtureLocked, LOCK_MINUTES, nowMs, type Fixture, type HiddenBonus, type Matchday, type PointAdjustment, type Prediction, type Profile, type Season } from "@/lib/types";

/** Carte d'action de l'Accueil : chacun est routé vers sa prochaine action. */
type ActionCard = {
  href: string;
  tone: "green" | "amber" | "neutral";
  text: React.ReactNode;
};

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

  // -------------------------------------------------------------------------
  // Cartes d'action : la prochaine action de CE membre, dans l'ordre de ce qui
  // presse le plus. (Uniquement sur la saison en cours, pas les archives.)
  // -------------------------------------------------------------------------
  const cards: ActionCard[] = [];
  const now = nowMs();

  if (!isArchive) {
    const myPreds = preds.filter((p) => p.member_id === profile.id);

    // 1. Pronostics : journée ouverte avec des matchs encore jouables.
    const openDay = days
      .filter((d) => d.status === "publiee")
      .sort((a, b) => a.number - b.number)
      .find((d) => d.fixtures.some((f) => !isFixtureLocked(f)));
    if (openDay) {
      const missing = openDay.fixtures
        .filter((f) => !isFixtureLocked(f))
        .filter((f) => !myPreds.some((p) => p.fixture_id === f.id));
      if (missing.length > 0) {
        const nextLock = Math.min(...missing.map((f) => new Date(f.kickoff_at).getTime()));
        cards.push({
          href: `/journees/${openDay.number}`,
          tone: "green",
          text: (
            <>
              ⚽ <b>Journée {openDay.number}</b> — il te reste{" "}
              <b>
                {missing.length} prono{missing.length > 1 ? "s" : ""}
              </b>{" "}
              · 1ᵉʳ verrouillage{" "}
              {formatKickoff(new Date(nextLock - LOCK_MINUTES * 60_000).toISOString())} →
            </>
          ),
        });
      } else {
        cards.push({
          href: `/journees/${openDay.number}`,
          tone: "neutral",
          text: (
            <>
              ✅ <b>Journée {openDay.number}</b> — tes pronos sont posés, va mater ceux des
              copains →
            </>
          ),
        });
      }
    } else {
      // Journée entièrement verrouillée mais pas clôturée : on suit les points.
      const liveDay = days
        .filter((d) => d.status === "publiee")
        .sort((a, b) => b.number - a.number)[0];
      if (liveDay) {
        cards.push({
          href: `/journees/${liveDay.number}`,
          tone: "neutral",
          text: (
            <>
              📺 <b>Journée {liveDay.number}</b> en cours — suis les points en direct →
            </>
          ),
        });
      }
    }

    // 2. Résultat de la dernière journée clôturée : « combien j'ai pris ? »
    const lastFinished = days
      .filter((d) => d.status === "terminee")
      .sort((a, b) => b.number - a.number)[0];
    if (lastFinished) {
      const b = matchdayBreakdown(lastFinished.fixtures, myPreds, { finished: true });
      cards.push({
        href: `/journees/${lastFinished.number}`,
        tone: b.total > 0 ? "neutral" : "amber",
        text: (
          <>
            🏁 <b>Journée {lastFinished.number}</b> terminée : tu as pris{" "}
            <b>{b.total} pt{Math.abs(b.total) > 1 ? "s" : ""}</b>
            {b.allExact && " (tous les scores, +10 !)"}
            {b.blankDay && " (journée blanche, −2…)"} →
          </>
        ),
      });
    }

    // 3. Vestiaire : messages non lus.
    const { data: read } = await supabase
      .from("chat_reads")
      .select("last_read_at")
      .eq("member_id", profile.id)
      .maybeSingle();
    let unreadQuery = supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .neq("member_id", profile.id);
    if (read?.last_read_at) unreadQuery = unreadQuery.gt("created_at", read.last_read_at);
    const { count: unread } = await unreadQuery;
    if ((unread ?? 0) > 0) {
      cards.push({
        href: "/vestiaire",
        tone: "neutral",
        text: (
          <>
            💬 <b>{unread} nouveau{(unread ?? 0) > 1 ? "x" : ""} message{(unread ?? 0) > 1 ? "s" : ""}</b>{" "}
            au Vestiaire →
          </>
        ),
      });
    }

    // 4. Commission : les juges voient ce qui les attend.
    if (canJudge(profile.role)) {
      const { count } = await supabase
        .from("predictions")
        .select("id", { count: "exact", head: true })
        .eq("status", "a_examiner");
      if ((count ?? 0) > 0) {
        cards.push({
          href: "/commission",
          tone: "amber",
          text: (
            <>
              ⚖️ <b>{count} dossier{(count ?? 0) > 1 ? "s" : ""}</b> attend
              {(count ?? 0) > 1 ? "ent" : ""} la Commission →
            </>
          ),
        });
      }
    }

    // 4. Président : sa prochaine action de gestion.
    if (profile.role === "president") {
      const { data: drafts } = await supabase
        .from("matchdays")
        .select("number, fixtures(id)")
        .eq("season_id", viewedSeason.id)
        .eq("status", "brouillon")
        .order("number")
        .limit(1);
      const draft = drafts?.[0];
      const toClose = days
        .filter((d) => d.status === "publiee")
        .find((d) => d.fixtures.every((f) => new Date(f.kickoff_at).getTime() < now));
      if (toClose) {
        const missingResults = toClose.fixtures.filter((f) => f.home_score === null).length;
        cards.push({
          href: "/admin",
          tone: "amber",
          text: (
            <>
              🎩 <b>Journée {toClose.number}</b> :{" "}
              {missingResults > 0
                ? `${missingResults} résultat${missingResults > 1 ? "s" : ""} à saisir`
                : "tout est saisi, clôture-la"}{" "}
              →
            </>
          ),
        });
      } else if (draft && (draft.fixtures?.length ?? 0) > 0) {
        cards.push({
          href: "/admin",
          tone: "green",
          text: (
            <>
              🎩 <b>Journée {draft.number}</b> prête — publie-la pour ouvrir les pronos
              (article 10) →
            </>
          ),
        });
      }
    }

    // 5. Échéances du 30/09 : bonus cachés et mise.
    const deadline = new Date(viewedSeason.bonus_deadline).getTime();
    if (!viewedSeason.bonus_reveles && now < deadline) {
      const [{ data: myBonuses }, { data: myMises }] = await Promise.all([
        supabase
          .from("hidden_bonuses")
          .select("type")
          .eq("season_id", viewedSeason.id)
          .eq("member_id", profile.id),
        supabase
          .from("ledger")
          .select("id")
          .eq("season_id", viewedSeason.id)
          .eq("member_id", profile.id)
          .eq("type", "mise")
          .limit(1),
      ]);
      const daysLeft = Math.ceil((deadline - now) / 86_400_000);
      const missingBonuses = 6 - ((myBonuses ?? []) as Pick<HiddenBonus, "type">[]).length;
      if (missingBonuses > 0) {
        cards.push({
          href: "/bonus",
          tone: daysLeft <= 7 ? "amber" : "neutral",
          text: (
            <>
              🎁 <b>{missingBonuses} bonus caché{missingBonuses > 1 ? "s" : ""}</b> à sceller —
              J−{daysLeft} →
            </>
          ),
        });
      }
      if ((myMises ?? []).length === 0) {
        cards.push({
          href: "/cagnotte",
          tone: daysLeft <= 7 ? "amber" : "neutral",
          text: (
            <>
              💰 Mise de 20 € à régler avant le 30/09 — article 3 : radiation sinon ! →
            </>
          ),
        });
      }
    }
  }

  const TONE_CLASSES: Record<ActionCard["tone"], string> = {
    green: "border-green-900 bg-green-950/40 hover:bg-green-950/70",
    amber: "border-amber-900/70 bg-amber-950/30 hover:bg-amber-950/50",
    neutral: "border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900",
  };

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

      {cards.length > 0 && (
        <div className="flex flex-col gap-2">
          {cards.map((card, i) => (
            <Link
              key={i}
              href={card.href}
              className={`rounded-xl border p-4 text-sm ${TONE_CLASSES[card.tone]}`}
            >
              {card.text}
            </Link>
          ))}
        </div>
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
