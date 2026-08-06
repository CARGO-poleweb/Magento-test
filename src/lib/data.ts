import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, Profile, Season } from "@/lib/types";

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

/** Utilisateur connecté + son profil ; redirige vers /login sinon.
 *  `cache()` : le layout et la page appellent tous deux cette fonction à
 *  chaque navigation — sans cache, l'aller-retour d'authentification et la
 *  lecture du profil seraient payés deux fois par affichage. */
export const getSessionProfile = cache(async () => {
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
});

/** La saison courante de la ligue (une seule à la fois).
 *  Mise en cache par requête : le layout et la page la demandent tous les
 *  deux à chaque navigation, une seule lecture suffit. */
export const getCurrentSeason = cache(
  async (supabase: SupabaseClient): Promise<Season | null> => {
    const { data } = await supabase
      .from("seasons")
      .select("*")
      .eq("is_current", true)
      .maybeSingle<Season>();
    return data;
  },
);

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
