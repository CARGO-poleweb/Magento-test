import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, Profile } from "@/lib/types";

/** Rôles siégeant à la Commission de discipline (+ le Président, art. 1). */
export const COMMISSION_ROLES: MemberRole[] = [
  "president_commission",
  "premier_ministre",
  "secretaire",
];

export function canJudge(role: MemberRole): boolean {
  return role === "president" || COMMISSION_ROLES.includes(role);
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  president: "Président",
  premier_ministre: "Premier Ministre",
  president_commission: "Président de la Commission",
  secretaire: "Secrétaire / Resp. évènements",
  charge_mission: "Chargé de mission",
  membre: "Membre",
};

/** Utilisateur connecté + son profil ; redirige vers /login sinon. */
export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  if (!profile) redirect("/login");

  return { supabase, user, profile };
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatKickoff(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}
