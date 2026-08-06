import Link from "next/link";
import { canJudge, getSessionProfile, ROLE_LABELS } from "@/lib/data";
import { signOut } from "@/app/actions";

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
    supabase
      .from("chat_reads")
      .select("last_read_at")
      .eq("member_id", profile.id)
      .maybeSingle(),
  ]);
  const plusBadge = pendingRes.count ?? 0;

  let unreadQuery = supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .neq("member_id", profile.id);
  const lastRead = readRes.data?.last_read_at;
  if (lastRead) unreadQuery = unreadQuery.gt("created_at", lastRead);
  const { count: unread } = await unreadQuery;

  // Navigation resserrée : 4 onglets aujourd'hui, 5 max à terme (les Défis
  // photos/vidéos prendront la place libre en V1). Tout le reste vit dans
  // « Plus » pour que la barre reste lisible sur mobile.
  const tabs = [
    { href: "/", label: "Accueil", icon: "🏆", badge: 0 },
    { href: "/journees", label: "Journées", icon: "📅", badge: 0 },
    { href: "/vestiaire", label: "Vestiaire", icon: "💬", badge: unread ?? 0 },
    { href: "/plus", label: "Plus", icon: "⋯", badge: plusBadge },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header className="flex items-center justify-between gap-3 bg-[linear-gradient(120deg,#15803d,#16a34a_55%,#4dab30)] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] text-white">
        <div>
          <Link href="/" className="text-lg font-black uppercase italic tracking-tight [text-shadow:0_2px_12px_rgba(0,60,20,0.35)]">
            🏆 La Ligue des Copains
          </Link>
          <p className="text-xs text-white/85">
            {profile.display_name} · {ROLE_LABELS[profile.role]}
            {profile.is_radie && " · ⛔ radié"}
          </p>
        </div>
        <form action={signOut}>
          <button className="rounded-lg border border-white/40 bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/20">
            Sortir
          </button>
        </form>
      </header>

      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>

      {/* pb-safe : la barre « home » des iPhone ne doit pas chevaucher les onglets */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-[#e2e9dd] bg-white/95 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-1 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl justify-around">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative flex flex-col items-center gap-0.5 px-2 py-2 text-[11px] text-[#5c7263] hover:text-[#14251b]"
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
              {tab.badge > 0 && (
                <span className="absolute right-1 top-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                  {tab.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
