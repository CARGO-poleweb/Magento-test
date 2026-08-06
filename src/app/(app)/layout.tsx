import Link from "next/link";
import { canJudge, getSessionProfile, ROLE_LABELS } from "@/lib/data";
import { TabLink, type TabIcon } from "@/components/TabLink";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await getSessionProfile();

  // Pastilles : messages non lus au Vestiaire pour tous, dossiers en attente
  // pour les juges. Requêtes en parallèle — le layout s'exécute à chaque
  // navigation, chaque aller-retour compte.
  const [pendingRes, readRes] = await Promise.all([
    canJudge(profile.role)
      ? supabase
          .from("predictions")
          .select("id", { count: "exact", head: true })
          .eq("status", "a_examiner")
      : Promise.resolve({ count: 0 }),
    supabase.from("chat_reads").select("last_read_at").eq("member_id", profile.id).maybeSingle(),
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
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)] backdrop-blur">
        <Link href="/" className="block">
          <h1 className="text-[15px] font-semibold tracking-tight">La Ligue des Copains</h1>
          <p className="text-xs text-faint">
            {profile.display_name} · {ROLE_LABELS[profile.role]}
            {profile.is_radie && " · radié"}
          </p>
        </Link>
      </header>

      <main className="flex-1 px-4 pb-28 pt-5">{children}</main>

      {/* pb-safe : la barre « home » des iPhone ne doit pas chevaucher les onglets */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl justify-around">
          {tabs.map((tab) => (
            <TabLink key={tab.href} {...tab} />
          ))}
        </div>
      </nav>
    </div>
  );
}
