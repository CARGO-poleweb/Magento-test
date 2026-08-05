"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parsePrediction } from "@/lib/parser";
import { canJudge, getSessionProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isFixtureLocked, type BonusType, type Team } from "@/lib/types";

export type ActionResult = {
  ok: boolean;
  title: string;
  detail?: string;
};

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Pronostics (articles 6 à 12)
// ---------------------------------------------------------------------------
export async function submitPrediction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const fixtureId = Number(formData.get("fixture_id"));
  const rawText = String(formData.get("raw_text") ?? "").trim();

  if (!rawText) return { ok: false, title: "Pronostic vide" };
  if (rawText.length > 200) return { ok: false, title: "Pronostic trop long" };

  const { profile } = await getSessionProfile();
  if (profile.is_radie) {
    return { ok: false, title: "Radié du groupe (article 3)", detail: "Voir avec le Président." };
  }

  const service = createServiceClient();

  const { data: fixture } = await service
    .from("fixtures")
    .select("*, matchday:matchdays(*), home:home_team_id(*), away:away_team_id(*)")
    .eq("id", fixtureId)
    .single();
  if (!fixture) return { ok: false, title: "Match introuvable" };

  // Art. 10 : pas avant diffusion par le Président.
  if (fixture.matchday.status !== "publiee") {
    return { ok: false, title: "Journée non ouverte aux pronostics (article 10)" };
  }

  // Art. 6 : verrouillage 30 minutes avant le coup d'envoi.
  if (isFixtureLocked(fixture)) {
    return {
      ok: false,
      title: "Trop tard, match verrouillé (article 6)",
      detail: "Les pronostics ferment 30 minutes avant le coup d'envoi.",
    };
  }

  const { data: teams } = await service.from("teams").select("*");
  const parsed = parsePrediction(
    rawText,
    { home: fixture.home as Team, away: fixture.away as Team },
    (teams ?? []) as Team[],
  );

  // Art. 6 : premier pari accepté — un nouveau pronostic sur le même match
  // est enregistré mais signalé comme doublon à la Commission.
  const { count: priorCount } = await service
    .from("predictions")
    .select("id", { count: "exact", head: true })
    .eq("fixture_id", fixtureId)
    .eq("member_id", profile.id);

  const isDuplicate = (priorCount ?? 0) > 0;
  const reasons = [
    ...(isDuplicate ? ["doublon — le même match a déjà été parié (article 6)"] : []),
    ...(parsed.flagReason ? [parsed.flagReason] : []),
  ];
  const status = reasons.length > 0 ? "a_examiner" : "auto_valide";

  const { error } = await service.from("predictions").insert({
    fixture_id: fixtureId,
    member_id: profile.id,
    raw_text: rawText,
    home_score_parsed: parsed.homeScore,
    away_score_parsed: parsed.awayScore,
    status,
    flag_reason: reasons.length > 0 ? reasons.join(" ; ") : null,
  });
  if (error) return { ok: false, title: "Erreur d'enregistrement", detail: error.message };

  revalidatePath("/journees/[number]", "page");

  if (status === "auto_valide") {
    return { ok: true, title: "Pronostic enregistré ✅", detail: `« ${rawText} »` };
  }
  return {
    ok: true,
    title: "Enregistré, mais transmis à la Commission ⚠️",
    detail: reasons.join(" ; "),
  };
}

// ---------------------------------------------------------------------------
// Bonus cachés (barème + article 5) — scellés jusqu'à révélation
// ---------------------------------------------------------------------------
export async function submitHiddenBonus(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const type = String(formData.get("type")) as BonusType;
  const { profile } = await getSessionProfile();
  const service = createServiceClient();

  const { data: season } = await service.from("season_settings").select("*").eq("id", 1).single();
  if (!season) return { ok: false, title: "Saison non configurée" };
  if (season.bonus_reveles || new Date() > new Date(season.bonus_deadline)) {
    return {
      ok: false,
      title: "Trop tard",
      detail: "Les bonus cachés devaient être déposés avant le 30/09/2025, 23 h 59.",
    };
  }

  let answer: { value?: string; values?: string[] };
  if (type === "top3" || type === "bottom3") {
    const values = [1, 2, 3].map((i) => String(formData.get(`value_${i}`) ?? "").trim());
    if (values.some((v) => !v)) return { ok: false, title: "Les 3 réponses sont requises" };
    answer = { values };
  } else {
    const value = String(formData.get("value") ?? "").trim();
    if (!value) return { ok: false, title: "Réponse vide" };
    answer = { value };
  }

  const { error } = await service
    .from("hidden_bonuses")
    .upsert(
      { member_id: profile.id, type, answer, submitted_at: new Date().toISOString() },
      { onConflict: "member_id,type" },
    );
  if (error) return { ok: false, title: "Erreur d'enregistrement", detail: error.message };

  revalidatePath("/bonus");
  return {
    ok: true,
    title: "Bonus scellé 🔒",
    detail: "Personne ne le verra avant la révélation. Modifiable jusqu'à la deadline.",
  };
}

// ---------------------------------------------------------------------------
// Commission de discipline
// ---------------------------------------------------------------------------
export async function decidePrediction(formData: FormData): Promise<void> {
  const predictionId = String(formData.get("prediction_id"));
  const decision = String(formData.get("decision"));
  if (decision !== "comptabilise" && decision !== "non_comptabilise") return;

  const { profile } = await getSessionProfile();
  if (!canJudge(profile.role)) return;

  const service = createServiceClient();
  await service
    .from("predictions")
    .update({ status: decision, decided_by: profile.id, decided_at: new Date().toISOString() })
    .eq("id", predictionId)
    .eq("status", "a_examiner");

  revalidatePath("/commission");
}

export async function addAdjustment(formData: FormData): Promise<void> {
  const { profile } = await getSessionProfile();
  if (!canJudge(profile.role)) return;

  const memberId = String(formData.get("member_id"));
  const points = Number(formData.get("points"));
  const reason = String(formData.get("reason") ?? "").trim();
  const matchdayId = formData.get("matchday_id") ? Number(formData.get("matchday_id")) : null;
  if (!memberId || !Number.isInteger(points) || points === 0 || !reason) return;

  const service = createServiceClient();
  await service.from("point_adjustments").insert({
    member_id: memberId,
    matchday_id: matchdayId,
    points,
    reason,
    created_by: profile.id,
  });

  revalidatePath("/");
  revalidatePath("/commission");
}

// ---------------------------------------------------------------------------
// Administration (Président — article 1 : il a toujours raison)
// ---------------------------------------------------------------------------
async function requirePresident() {
  const { profile } = await getSessionProfile();
  if (profile.role !== "president") redirect("/");
  return profile;
}

export async function createMatchday(formData: FormData): Promise<void> {
  await requirePresident();
  const number = Number(formData.get("number"));
  const type = String(formData.get("type")) === "multiplex" ? "multiplex" : "classique";
  if (!Number.isInteger(number) || number < 1 || number > 34) return;

  const service = createServiceClient();
  await service.from("matchdays").insert({ number, type });
  revalidatePath("/admin");
}

export async function addFixture(formData: FormData): Promise<void> {
  await requirePresident();
  const matchdayId = Number(formData.get("matchday_id"));
  const homeTeamId = Number(formData.get("home_team_id"));
  const awayTeamId = Number(formData.get("away_team_id"));
  const kickoffLocal = String(formData.get("kickoff_at")); // heure de Paris
  if (!matchdayId || !homeTeamId || !awayTeamId || homeTeamId === awayTeamId || !kickoffLocal)
    return;

  const service = createServiceClient();
  const { data: existing } = await service
    .from("fixtures")
    .select("position")
    .eq("matchday_id", matchdayId)
    .order("position", { ascending: false })
    .limit(1);
  const position = (existing?.[0]?.position ?? 0) + 1;

  await service.from("fixtures").insert({
    matchday_id: matchdayId,
    position,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    kickoff_at: parisToUtc(kickoffLocal),
  });
  revalidatePath("/admin");
}

/** Convertit une saisie datetime-local (heure de Paris) en ISO UTC. */
function parisToUtc(local: string): string {
  const guess = new Date(`${local}:00Z`);
  const paris = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    timeZoneName: "longOffset",
  })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName")?.value; // ex. « GMT+02:00 »
  const offset = paris?.match(/GMT([+-]\d{2}:\d{2})/)?.[1] ?? "+02:00";
  return new Date(`${local}:00${offset}`).toISOString();
}

export async function publishMatchday(formData: FormData): Promise<void> {
  await requirePresident();
  const id = Number(formData.get("matchday_id"));
  const service = createServiceClient();
  await service
    .from("matchdays")
    .update({ status: "publiee", published_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "brouillon");
  revalidatePath("/admin");
  revalidatePath("/journees");
}

export async function enterResult(formData: FormData): Promise<void> {
  await requirePresident();
  const fixtureId = Number(formData.get("fixture_id"));
  const home = Number(formData.get("home_score"));
  const away = Number(formData.get("away_score"));
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) return;

  const service = createServiceClient();
  await service.from("fixtures").update({ home_score: home, away_score: away }).eq("id", fixtureId);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function finishMatchday(formData: FormData): Promise<void> {
  await requirePresident();
  const id = Number(formData.get("matchday_id"));
  const service = createServiceClient();

  // Une journée ne peut être clôturée que si tous les résultats sont saisis
  // (le malus −2 et les bonus +3/+10 tombent à la clôture).
  const { count: missing } = await service
    .from("fixtures")
    .select("id", { count: "exact", head: true })
    .eq("matchday_id", id)
    .is("home_score", null);
  if ((missing ?? 0) > 0) return;

  await service.from("matchdays").update({ status: "terminee" }).eq("id", id);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function recordMise(formData: FormData): Promise<void> {
  const president = await requirePresident();
  const memberId = String(formData.get("member_id"));
  const service = createServiceClient();

  const { data: season } = await service.from("season_settings").select("*").eq("id", 1).single();
  const { data: existing } = await service
    .from("ledger")
    .select("id")
    .eq("member_id", memberId)
    .eq("type", "mise")
    .limit(1);
  if (existing && existing.length > 0) return; // déjà payé

  await service.from("ledger").insert({
    member_id: memberId,
    type: "mise",
    amount_cents: season?.mise_cents ?? 2000,
    note: "Mise de départ (article 2)",
    created_by: president.id,
  });
  revalidatePath("/cagnotte");
}

export async function addAmende(formData: FormData): Promise<void> {
  const president = await requirePresident();
  const memberId = String(formData.get("member_id"));
  const euros = Number(String(formData.get("euros")).replace(",", "."));
  const note = String(formData.get("note") ?? "").trim();
  if (!memberId || !(euros > 0)) return;

  const service = createServiceClient();
  await service.from("ledger").insert({
    member_id: memberId,
    type: "amende",
    amount_cents: Math.round(euros * 100),
    note: note || "Amende",
    created_by: president.id,
  });
  revalidatePath("/cagnotte");
}

export async function setRadiation(formData: FormData): Promise<void> {
  await requirePresident();
  const memberId = String(formData.get("member_id"));
  const radie = String(formData.get("radie")) === "true";
  const service = createServiceClient();
  await service.from("profiles").update({ is_radie: radie }).eq("id", memberId);
  revalidatePath("/admin");
}

export async function revealBonuses(): Promise<void> {
  await requirePresident();
  const service = createServiceClient();
  await service.from("season_settings").update({ bonus_reveles: true }).eq("id", 1);
  revalidatePath("/bonus");
}
