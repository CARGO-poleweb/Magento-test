import Link from "next/link";
import { signOut } from "@/app/actions";
import { NotificationSettings } from "@/components/NotificationSettings";
import { canJudge, getSessionProfile } from "@/lib/data";

export default async function PlusPage() {
  const { supabase, profile } = await getSessionProfile();

  const { data: notifSettings } = await supabase
    .from("notification_settings")
    .select("vestiaire, jeu")
    .eq("member_id", profile.id)
    .maybeSingle();

  // Pastille : dossiers en attente pour les membres de la Commission.
  let pendingCount = 0;
  if (canJudge(profile.role)) {
    const { count } = await supabase
      .from("predictions")
      .select("id", { count: "exact", head: true })
      .eq("status", "a_examiner");
    pendingCount = count ?? 0;
  }

  const entries = [
    { href: "/bonus", icon: "🎁", label: "Bonus cachés", detail: "À sceller avant la deadline" },
    { href: "/cagnotte", icon: "💰", label: "Cagnotte", detail: "Mises, amendes, Ballon d'Or" },
    ...(canJudge(profile.role)
      ? [
          {
            href: "/commission",
            icon: "⚖️",
            label: "Commission de discipline",
            detail:
              pendingCount > 0
                ? `${pendingCount} dossier${pendingCount > 1 ? "s" : ""} à juger`
                : "Rien à juger",
            badge: pendingCount,
          },
        ]
      : []),
    ...(profile.role === "president"
      ? [
          {
            href: "/admin",
            icon: "🎩",
            label: "Espace du Président",
            detail: "Journées, résultats, membres, saisons",
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Plus</h1>

      <nav className="overflow-hidden rounded-xl border border-[#e2e9dd]">
        {entries.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className="flex items-center gap-3 border-b border-[#e2e9dd] bg-white px-4 py-3 last:border-b-0 hover:bg-[#eef4ea]"
          >
            <span className="text-xl">{e.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{e.label}</span>
              <span className="block text-xs text-[#75897a]">{e.detail}</span>
            </span>
            {"badge" in e && (e.badge ?? 0) > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                {e.badge}
              </span>
            )}
            <span className="text-[#8b9c8d]">›</span>
          </Link>
        ))}
      </nav>

      <NotificationSettings
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
        initialVestiaire={notifSettings?.vestiaire ?? true}
        initialJeu={notifSettings?.jeu ?? true}
      />

      <div className="rounded-xl border border-[#e2e9dd] bg-white p-4 text-xs text-[#75897a]">
        Connecté en tant que <span className="text-[#3a4d40]">{profile.display_name}</span>. La
        session reste active tant que tu ne te déconnectes pas — pas besoin de refaire le lien
        magique.
      </div>

      <form action={signOut}>
        <button className="w-full rounded-xl border border-[#f6c9c2] px-4 py-3 text-sm font-semibold text-red-600 hover:bg-[#fde9e6]">
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
