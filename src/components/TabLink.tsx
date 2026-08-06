"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, MessageCircle, MoreHorizontal, Trophy } from "@/components/icons";

/** Les icônes vivent ici, côté client : un composant ne traverse pas la
 *  frontière serveur → client (seules des données sérialisables passent).
 *  Le serveur envoie donc un nom, pas une icône. */
const ICONS = {
  accueil: Trophy,
  journees: CalendarDays,
  vestiaire: MessageCircle,
  plus: MoreHorizontal,
} as const;

export type TabIcon = keyof typeof ICONS;

export function TabLink({
  href,
  label,
  icon,
  badge,
}: {
  href: string;
  label: string;
  icon: TabIcon;
  badge: number;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  const Icon = ICONS[icon];

  return (
    <Link
      href={href}
      // Toujours à l'écran : les quatre onglets se préchargent, la navigation
      // devient instantanée au lieu d'attendre un aller-retour serveur.
      prefetch
      aria-current={active ? "page" : undefined}
      className={`relative flex w-[76px] flex-col items-center gap-0.5 py-0.5 text-[10.5px] transition-transform active:scale-95 ${
        active ? "text-accent-strong" : "text-faint"
      }`}
    >
      <span
        className={`rounded-full px-3.5 py-0.5 transition-colors ${active ? "bg-accent-soft" : ""}`}
      >
        <Icon size={22} strokeWidth={active ? 2.3 : 1.8} aria-hidden />
      </span>
      <span className={active ? "font-semibold" : ""}>{label}</span>
      {badge > 0 && (
        <span className="absolute right-2.5 -top-0.5 min-w-[17px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-[17px] text-white ring-2 ring-surface">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}
