export type MemberRole =
  | "president"
  | "premier_ministre"
  | "president_commission"
  | "secretaire"
  | "charge_mission"
  | "membre";

export type Profile = {
  id: string;
  display_name: string;
  role: MemberRole;
  is_radie: boolean;
};

export type Team = {
  id: number;
  short_name: string;
  full_name: string;
  aliases: string[];
  tracked: boolean;
};

export type MatchdayType = "classique" | "multiplex";
export type MatchdayStatus = "brouillon" | "publiee" | "terminee";

export type Matchday = {
  id: number;
  number: number;
  type: MatchdayType;
  status: MatchdayStatus;
  published_at: string | null;
};

export type Fixture = {
  id: number;
  matchday_id: number;
  position: number;
  home_team_id: number;
  away_team_id: number;
  kickoff_at: string;
  home_score: number | null;
  away_score: number | null;
};

export type PredictionStatus =
  | "auto_valide"
  | "a_examiner"
  | "comptabilise"
  | "non_comptabilise";

export type Prediction = {
  id: string;
  fixture_id: number;
  member_id: string;
  raw_text: string;
  home_score_parsed: number | null;
  away_score_parsed: number | null;
  status: PredictionStatus;
  flag_reason: string | null;
  created_at: string;
};

export type BonusType =
  | "vainqueur"
  | "buteur"
  | "passeur"
  | "top3"
  | "bottom3"
  | "classement_tfc";

export type HiddenBonus = {
  id: string;
  member_id: string;
  type: BonusType;
  answer: { value?: string; values?: string[] };
  points_awarded: number | null;
  submitted_at: string;
};

export type LedgerEntry = {
  id: string;
  member_id: string;
  type: "mise" | "amende" | "ajustement";
  amount_cents: number;
  note: string | null;
  created_at: string;
};

export type PointAdjustment = {
  id: string;
  member_id: string;
  matchday_id: number | null;
  points: number;
  reason: string;
  created_at: string;
};

/** Délai de verrouillage avant coup d'envoi (article 6). */
export const LOCK_MINUTES = 30;

export function isFixtureLocked(fixture: Pick<Fixture, "kickoff_at">, now = new Date()): boolean {
  return now.getTime() >= new Date(fixture.kickoff_at).getTime() - LOCK_MINUTES * 60_000;
}
