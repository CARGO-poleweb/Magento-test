import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ChevronRight,
  Clock,
  Crown,
  Flag,
  Gift,
  MessageCircle,
  Radio,
  Scale,
  Wallet,
} from "@/components/icons";
import { canJudge, formatKickoff, getSessionProfile } from "@/lib/data";
import { matchdayBreakdown, standings } from "@/lib/scoring";
import { isFixtureLocked, LOCK_MINUTES, nowMs, type Fixture, type HiddenBonus, type Matchday, type PointAdjustment, type Prediction, type Profile, type Season } from "@/lib/types";

/** Carte d'action de l'Accueil : chacun est routé vers sa prochaine action. */
type ActionCard = {
  href: string;
  tone: "accent" | "warn" | "neutral";
  Icon: LucideIcon;
  title: React.ReactNode;
  detail?: React.ReactNode;
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
      <p className="rounded-xl border border-line p-4 text-sm text-muted">
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
  // Or, argent, bronze : le podium se lit à la couleur, sans emoji.
  const PODIUM = [
    "bg-gold-soft text-gold",
    "bg-silver-soft text-silver",
    "bg-bronze-soft text-bronze",
  ];
  const isArchive = !viewedSeason.is_current;

  // -------------------------------------------------------------------------
  // Cartes d'action : la prochaine action de CE membre, dans l'ordre de ce qui
  // presse le plus. (Uniquement sur la saison en cours, pas les archives.)
  // -------------------------------------------------------------------------
  const cards: ActionCard[] = [];
  const now = nowMs();

  if (!isArchive) {
    const myPreds = preds.filter((p) => p.member_id === profile.id);

    // Toutes les données des cartes en un seul lot parallèle : chaque
    // aller-retour vers la base se paie au prix fort à l'affichage.
    const isJudge = canJudge(profile.role);
    const isPresident = profile.role === "president";
    const deadline = new Date(viewedSeason.bonus_deadline).getTime();
    const deadlineOpen = !viewedSeason.bonus_reveles && now < deadline;

    const [readRes, pendingRes, draftsRes, bonusesRes, misesRes] = await Promise.all([
      supabase.from("chat_reads").select("last_read_at").eq("member_id", profile.id).maybeSingle(),
      isJudge
        ? supabase
            .from("predictions")
            .select("id", { count: "exact", head: true })
            .eq("status", "a_examiner")
        : Promise.resolve({ count: 0 }),
      isPresident
        ? supabase
            .from("matchdays")
            .select("number, fixtures(id)")
            .eq("season_id", viewedSeason.id)
            .eq("status", "brouillon")
            .order("number")
            .limit(1)
        : Promise.resolve({ data: null }),
      deadlineOpen
        ? supabase
            .from("hidden_bonuses")
            .select("type")
            .eq("season_id", viewedSeason.id)
            .eq("member_id", profile.id)
        : Promise.resolve({ data: [] }),
      deadlineOpen
        ? supabase
            .from("ledger")
            .select("id")
            .eq("season_id", viewedSeason.id)
            .eq("member_id", profile.id)
            .eq("type", "mise")
            .limit(1)
        : Promise.resolve({ data: [{ id: "payé" }] }),
    ]);

    let unreadQuery = supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .neq("member_id", profile.id);
    const lastRead = readRes.data?.last_read_at;
    if (lastRead) unreadQuery = unreadQuery.gt("created_at", lastRead);
    const { count: unread } = await unreadQuery;

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
          tone: "accent",
          Icon: Clock,
          title: (
            <>
              Journée {openDay.number} — {missing.length} prono
              {missing.length > 1 ? "s" : ""} à poser
            </>
          ),
          detail: `Premier verrouillage ${formatKickoff(new Date(nextLock - LOCK_MINUTES * 60_000).toISOString())}`,
        });
      } else {
        cards.push({
          href: `/journees/${openDay.number}`,
          tone: "neutral",
          Icon: CalendarDays,
          title: <>Journée {openDay.number} — tes pronos sont posés</>,
          detail: "Va voir ceux des copains",
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
          Icon: Radio,
          title: <>Journée {liveDay.number} en cours</>,
          detail: "Suis les points en direct",
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
        tone: b.total > 0 ? "neutral" : "warn",
        Icon: Flag,
        title: (
          <>
            Journée {lastFinished.number} terminée : {b.total} pt
            {Math.abs(b.total) > 1 ? "s" : ""}
          </>
        ),
        detail: b.allExact
          ? "Tous les scores exacts, +10 !"
          : b.blankDay
            ? "Journée blanche, −2"
            : undefined,
      });
    }

    // 3. Vestiaire : messages non lus.
    if ((unread ?? 0) > 0) {
      cards.push({
        href: "/vestiaire",
        tone: "neutral",
        Icon: MessageCircle,
        title: (
          <>
            {unread} nouveau{(unread ?? 0) > 1 ? "x" : ""} message
            {(unread ?? 0) > 1 ? "s" : ""} au Vestiaire
          </>
        ),
      });
    }

    // 4. Commission : les juges voient ce qui les attend.
    if (isJudge) {
      const count = pendingRes.count ?? 0;
      if (count > 0) {
        cards.push({
          href: "/commission",
          tone: "warn",
          Icon: Scale,
          title: (
            <>
              {count} dossier{count > 1 ? "s" : ""} attend{count > 1 ? "ent" : ""} la Commission
            </>
          ),
        });
      }
    }

    // 5. Président : sa prochaine action de gestion.
    if (isPresident) {
      const draft = draftsRes.data?.[0];
      const toClose = days
        .filter((d) => d.status === "publiee")
        .find((d) => d.fixtures.every((f) => new Date(f.kickoff_at).getTime() < now));
      if (toClose) {
        const missingResults = toClose.fixtures.filter((f) => f.home_score === null).length;
        cards.push({
          href: "/admin",
          tone: "warn",
          Icon: Crown,
          title: (
            <>
              Journée {toClose.number} :{" "}
              {missingResults > 0
                ? `${missingResults} résultat${missingResults > 1 ? "s" : ""} à saisir`
                : "tout est saisi, clôture-la"}
            </>
          ),
        });
      } else if (draft && (draft.fixtures?.length ?? 0) > 0) {
        cards.push({
          href: "/admin",
          tone: "accent",
          Icon: Crown,
          title: <>Journée {draft.number} prête à publier</>,
          detail: "Les pronos s'ouvrent à la publication (article 10)",
        });
      }
    }

    // 6. Échéances du 30/09 : bonus cachés et mise.
    if (deadlineOpen) {
      const myBonuses = bonusesRes.data;
      const myMises = misesRes.data;
      const daysLeft = Math.ceil((deadline - now) / 86_400_000);
      const missingBonuses = 6 - ((myBonuses ?? []) as Pick<HiddenBonus, "type">[]).length;
      if (missingBonuses > 0) {
        cards.push({
          href: "/bonus",
          tone: daysLeft <= 7 ? "warn" : "neutral",
          Icon: Gift,
          title: (
            <>
              {missingBonuses} bonus caché{missingBonuses > 1 ? "s" : ""} à sceller
            </>
          ),
          detail: `Plus que ${daysLeft} jour${daysLeft > 1 ? "s" : ""}`,
        });
      }
      if ((myMises ?? []).length === 0) {
        cards.push({
          href: "/cagnotte",
          tone: daysLeft <= 7 ? "warn" : "neutral",
          Icon: Wallet,
          title: <>Mise de 20 € à régler</>,
          detail: "Article 3 : radiation passé la deadline",
        });
      }
    }
  }

  const TONE: Record<ActionCard["tone"], { box: string; tile: string }> = {
    accent: { box: "border-accent-line bg-accent-soft", tile: "bg-accent text-white" },
    warn: { box: "border-warn-line bg-warn-soft", tile: "bg-warn text-white" },
    neutral: { box: "border-line bg-surface", tile: "bg-subtle text-muted" },
  };

  return (
    <div className="flex flex-col gap-6">
      {seasons.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {seasons.map((s) => (
            <Link
              key={s.id}
              href={s.is_current ? "/" : `/?saison=${s.id}`}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                s.id === viewedSeason.id
                  ? "border-accent-line bg-accent-soft text-accent-strong"
                  : "border-line text-muted hover:border-line-strong hover:text-ink"
              }`}
            >
              {s.name}
              {s.is_current && " · en cours"}
            </Link>
          ))}
        </div>
      )}

      {isArchive && (
        <p className="rounded-card border border-line bg-surface px-4 py-3 text-xs text-muted">
          Archive : classement final de la saison {viewedSeason.name}.
        </p>
      )}

      {cards.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {cards.map((card, i) => {
            // La première carte est l'action du moment : elle prend la
            // couleur pleine de la ligue. Les suivantes restent en retrait.
            if (i === 0) {
              return (
                <Link
                  key={i}
                  href={card.href}
                  className="flex items-center gap-4 rounded-card bg-accent px-5 py-5 text-white shadow-[0_10px_24px_-12px_rgba(15,157,84,0.8)] transition-transform active:scale-[0.99]"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/20">
                    <card.Icon size={22} strokeWidth={2} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-snug">
                      {card.title}
                    </span>
                    {card.detail && (
                      <span className="mt-0.5 block text-xs text-white/80">{card.detail}</span>
                    )}
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-white/70" aria-hidden />
                </Link>
              );
            }
            const tone = TONE[card.tone];
            return (
              <Link
                key={i}
                href={card.href}
                className={`flex items-center gap-3 rounded-card border px-4 py-3 transition-colors hover:border-line-strong ${tone.box}`}
              >
                <span className={`grid size-9 shrink-0 place-items-center rounded-full ${tone.tile}`}>
                  <card.Icon size={17} strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug">{card.title}</span>
                  {card.detail && (
                    <span className="mt-0.5 block text-xs text-muted">{card.detail}</span>
                  )}
                </span>
                <ChevronRight size={16} className="shrink-0 text-faint" aria-hidden />
              </Link>
            );
          })}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Classement</h2>
          <span className="text-xs text-faint">{viewedSeason.name}</span>
        </div>

        <ul className="overflow-hidden rounded-card border border-line bg-surface">
          {rows.map((row, i) => {
            const member = byId.get(row.memberId);
            if (!member) return null;
            const isMe = member.id === profile.id;
            return (
              <li
                key={row.memberId}
                className={`flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 ${
                  isMe ? "bg-accent-soft" : i === 0 ? "bg-gold-soft/40" : ""
                } ${member.is_radie ? "opacity-45" : ""}`}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold tabular ${
                    PODIUM[i] ?? "text-faint"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {member.display_name}
                    {isMe && <span className="ml-1.5 text-xs font-normal text-accent">toi</span>}
                    {member.is_radie && (
                      <span className="ml-1.5 text-xs font-normal text-danger">radié</span>
                    )}
                  </span>
                  <span className="text-xs text-faint tabular">
                    {row.matchdayPoints} pts de journées
                    {row.adjustments !== 0 && (
                      <span className="text-danger"> · {row.adjustments} sanctions</span>
                    )}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-lg font-bold tabular ${
                    i === 0 ? "text-gold" : "text-ink"
                  }`}
                >
                  {row.total}
                </span>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted">
              Personne au classement pour l’instant.
            </li>
          )}
        </ul>

        <p className="mt-3 text-xs leading-relaxed text-faint">
          Score exact 4 pts · bonne différence de buts 3 · bon vainqueur 2 · tous les résultats +3 ·
          tous les scores +10 · journée blanche −2.
        </p>
      </section>
    </div>
  );
}
