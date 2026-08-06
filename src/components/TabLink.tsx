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

/** Onglet de la barre du bas : l'actif se distingue par la couleur d'accent
 *  et la graisse, sans pastille ni fond. */
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
      aria-current={active ? "page" : undefined}
      className={`relative flex w-20 flex-col items-center gap-1 rounded-lg py-1 text-[11px] transition-colors ${
        active ? "text-accent" : "text-faint hover:text-muted"
      }`}
    >
      <Icon size={21} strokeWidth={active ? 2.1 : 1.7} aria-hidden />
      <span className={active ? "font-medium" : ""}>{label}</span>
      {badge > 0 && (
        <span className="absolute right-3 top-0 min-w-[16px] rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}
