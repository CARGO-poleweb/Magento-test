import Link from "next/link";
import { Trophy } from "@/components/icons";
import { canJudge, getCurrentSeason, getSessionProfile, ROLE_LABELS } from "@/lib/data";
import { TabLink, type TabIcon } from "@/components/TabLink";

/** Initiales pour la pastille de profil (« Pierre M. » → « PM »). */
function initials(name: string): string {
  return name
    .replace(/[^\p{L}\s.]/gu, " ")
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

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
      {/* En-tête compact et clair : une marque colorée porte l'identité, le
          reste respire. Rien ne chevauche, rien n'est masqué. */}
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 pb-2.5 pt-[calc(env(safe-area-inset-top)+10px)]">
          <Link href="/" className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-white">
            <Trophy size={18} strokeWidth={2.2} aria-hidden />
            <span className="sr-only">Accueil</span>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight tracking-tight">
              La Ligue des Copains
            </p>
            <p className="truncate text-[11px] leading-tight text-faint">
              {season?.name ?? "Aucune saison"} · {ROLE_LABELS[profile.role]}
              {profile.is_radie && " · radié"}
            </p>
          </div>
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-bold text-accent-strong"
            title={profile.display_name}
          >
            {initials(profile.display_name)}
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 pb-[calc(var(--nav-h)+20px)] pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[max(env(safe-area-inset-bottom),8px)] backdrop-blur-md">
        <div className="mx-auto flex h-[54px] w-full max-w-3xl items-center justify-around">
          {tabs.map((tab) => (
            <TabLink key={tab.href} {...tab} />
          ))}
        </div>
      </nav>
    </div>
  );
}
