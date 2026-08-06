import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { signOut } from "@/app/actions";
import { NotificationSettings } from "@/components/NotificationSettings";
import { ChevronRight, Crown, Gift, LogOut, Scale, Wallet } from "@/components/icons";
import { canJudge, getSessionProfile } from "@/lib/data";

export default async function PlusPage() {
  const { supabase, profile } = await getSessionProfile();

  const [notifRes, pendingRes] = await Promise.all([
    supabase
      .from("notification_settings")
      .select("vestiaire, jeu")
      .eq("member_id", profile.id)
      .maybeSingle(),
    canJudge(profile.role)
      ? supabase
          .from("predictions")
          .select("id", { count: "exact", head: true })
          .eq("status", "a_examiner")
      : Promise.resolve({ count: 0 }),
  ]);
  const notifSettings = notifRes.data;
  const pendingCount = pendingRes.count ?? 0;

  const entries: {
    href: string;
    Icon: LucideIcon;
    label: string;
    detail: string;
    tile: string;
    badge?: number;
  }[] = [
    {
      href: "/bonus",
      Icon: Gift,
      label: "Bonus cachés",
      detail: "À sceller avant la deadline",
      tile: "bg-bonus-soft text-bonus",
    },
    {
      href: "/cagnotte",
      Icon: Wallet,
      label: "Cagnotte",
      detail: "Mises, amendes, Ballon d’Or",
      tile: "bg-money-soft text-money",
    },
    ...(canJudge(profile.role)
      ? [
          {
            href: "/commission",
            Icon: Scale,
            label: "Commission de discipline",
            detail:
              pendingCount > 0
                ? `${pendingCount} dossier${pendingCount > 1 ? "s" : ""} à juger`
                : "Rien à juger",
            tile: "bg-justice-soft text-justice",
            badge: pendingCount,
          },
        ]
      : []),
    ...(profile.role === "president"
      ? [
          {
            href: "/admin",
            Icon: Crown,
            label: "Espace du Président",
            detail: "Journées, résultats, membres, saisons",
            tile: "bg-crown-soft text-crown",
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold tracking-tight">Plus</h2>

      <nav className="overflow-hidden rounded-card border border-line bg-surface">
        {entries.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            prefetch
            className="flex items-center gap-3 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-subtle active:bg-subtle"
          >
            <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${e.tile}`}>
              <e.Icon size={18} strokeWidth={2} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{e.label}</span>
              <span className="block text-xs text-muted">{e.detail}</span>
            </span>
            {(e.badge ?? 0) > 0 && (
              <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">
                {e.badge}
              </span>
            )}
            <ChevronRight size={16} className="shrink-0 text-faint" aria-hidden />
          </Link>
        ))}
      </nav>

      <NotificationSettings
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
        initialVestiaire={notifSettings?.vestiaire ?? true}
        initialJeu={notifSettings?.jeu ?? true}
      />

      <p className="text-xs leading-relaxed text-faint">
        Connecté en tant que <span className="text-muted">{profile.display_name}</span>. La session
        reste active tant que tu ne te déconnectes pas.
        <span className="mt-1 block font-mono text-[10px] text-faint/70">
          version {process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "locale"}
        </span>
      </p>

      <form action={signOut}>
        <button className="flex w-full items-center justify-center gap-2 rounded-card border border-line px-4 py-3 text-sm font-medium text-muted transition-colors hover:border-danger-line hover:text-danger">
          <LogOut size={16} strokeWidth={1.8} aria-hidden />
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
