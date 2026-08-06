import Link from "next/link";
import { canJudge, getCurrentSeason, getSessionProfile, ROLE_LABELS } from "@/lib/data";
import { TabLink, type TabIcon } from "@/components/TabLink";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await getSessionProfile();

  // Pastilles : messages non lus au Vestiaire pour tous, dossiers en attente
  // pour les juges. Requêtes en parallèle — le layout s'exécute à chaque
  // navigation, chaque aller-retour compte.
  const [pendingRes, readRes, season] = await Promise.all([
    canJudge(profile.role)
      ? supabase
          .from("predictions")
          .select("id", { count: "exact", head: true })
          .eq("status", "a_examiner")
      : Promise.resolve({ count: 0 }),
    supabase.from("chat_reads").select("last_read_at").eq("member_id", profile.id).maybeSingle(),
    getCurrentSeason(supabase),
  ]);
  const plusBadge = pendingRes.count ?? 0;

  let unreadQuery = supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .neq("member_id", profile.id);
  const lastRead = readRes.data?.last_read_at;
  if (lastRead) unreadQuery = unreadQuery.gt("created_at", lastRead);
  const { count: unread } = await unreadQuery;

  const tabs: { href: string; label: string; icon: TabIcon; badge: number }[] = [
    { href: "/", label: "Accueil", icon: "accueil", badge: 0 },
    { href: "/journees", label: "Journées", icon: "journees", badge: 0 },
    { href: "/vestiaire", label: "Vestiaire", icon: "vestiaire", badge: unread ?? 0 },
    { href: "/plus", label: "Plus", icon: "plus", badge: plusBadge },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      {/* Bandeau d'identité : vert profond avec les rayures d'une pelouse
          fraîchement tondue, à peine perceptibles. Le contenu chevauche son
          bord arrondi, ce qui crée la profondeur. */}
      <header
        className="relative overflow-hidden rounded-b-[28px] px-5 pb-11 pt-[calc(env(safe-area-inset-top)+16px)] text-white"
        style={{
          background:
            "repeating-linear-gradient(115deg, rgba(255,255,255,0.045) 0 26px, rgba(255,255,255,0) 26px 52px), linear-gradient(150deg, #067a3e 0%, #04532b 62%, #033f21 100%)",
        }}
      >
        <Link href="/" className="relative block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
            {season?.name ?? "La Ligue"}
          </p>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight">La Ligue des Copains</h1>
          <p className="mt-1 text-xs text-white/70">
            {profile.display_name} · {ROLE_LABELS[profile.role]}
            {profile.is_radie && " · radié"}
          </p>
        </Link>
      </header>

      <main className="-mt-7 flex-1 px-4 pb-24">{children}</main>

      {/* pb-safe : la barre « home » des iPhone ne doit pas chevaucher les
          onglets — mais sans laisser un vide sous les libellés. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl justify-around">
          {tabs.map((tab) => (
            <TabLink key={tab.href} {...tab} />
          ))}
        </div>
      </nav>
    </div>
  );
}
