import type { Fixture, PointAdjustment, Prediction } from "./types";

/**
 * Moteur de points — barème quotidien du règlement :
 *
 *   Bon résultat exact du match ................................. 4 pts
 *   Victoire ou nul avec bonne différence de buts ............... 3 pts
 *   Victoire de l'équipe (bon vainqueur, mauvais écart) ......... 2 pts
 *   Tous les résultats de la journée (V/N/D) .................... +3 pts
 *   Tous les bons scores de la journée .......................... +10 pts
 *   Aucun point marqué sur la journée ........................... −2 pts
 */

export const POINTS_EXACT = 4;
export const POINTS_GOOD_DIFF = 3;
export const POINTS_GOOD_OUTCOME = 2;
export const BONUS_ALL_OUTCOMES = 3;
export const BONUS_ALL_EXACT = 10;
export const MALUS_BLANK_DAY = -2;

type Score = { home: number; away: number };

const outcome = (s: Score) => Math.sign(s.home - s.away);

export function matchPoints(prediction: Score, result: Score): number {
  if (prediction.home === result.home && prediction.away === result.away) return POINTS_EXACT;
  if (prediction.home - prediction.away === result.home - result.away) return POINTS_GOOD_DIFF;
  if (outcome(prediction) === outcome(result)) return POINTS_GOOD_OUTCOME;
  return 0;
}

/** Un pronostic compte s'il est auto-validé ou validé par la Commission. */
const COUNTED = new Set(["auto_valide", "comptabilise"]);

/**
 * Article 6 : « le premier pari accepté ». Pour un membre et un match donnés,
 * le pronostic effectif est le plus ancien qui compte et qui est interprétable.
 */
export function effectivePrediction(preds: Prediction[]): Prediction | null {
  return (
    [...preds]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .find(
        (p) => COUNTED.has(p.status) && p.home_score_parsed !== null && p.away_score_parsed !== null,
      ) ?? null
  );
}

export type MatchdayBreakdown = {
  perFixture: Map<number, { prediction: Prediction | null; points: number }>;
  basePoints: number;
  allOutcomes: boolean;
  allExact: boolean;
  blankDay: boolean;
  total: number;
};

/**
 * Points d'un membre sur une journée. `fixtures` : les matchs de la journée
 * (seuls ceux avec résultat comptent) ; `predictions` : tous les pronostics du
 * membre sur ces matchs, y compris doublons et non-comptabilisés.
 */
export function matchdayBreakdown(
  fixtures: Fixture[],
  predictions: Prediction[],
  opts: { finished: boolean },
): MatchdayBreakdown {
  const perFixture = new Map<number, { prediction: Prediction | null; points: number }>();
  let basePoints = 0;
  let allOutcomes = fixtures.length > 0;
  let allExact = fixtures.length > 0;

  for (const fixture of fixtures) {
    const pred = effectivePrediction(predictions.filter((p) => p.fixture_id === fixture.id));
    let points = 0;
    if (pred && fixture.home_score !== null && fixture.away_score !== null) {
      const result = { home: fixture.home_score, away: fixture.away_score };
      const guess = { home: pred.home_score_parsed!, away: pred.away_score_parsed! };
      points = matchPoints(guess, result);
      if (points < POINTS_GOOD_OUTCOME) allOutcomes = false;
      if (points !== POINTS_EXACT) allExact = false;
    } else {
      allOutcomes = false;
      allExact = false;
    }
    basePoints += points;
    perFixture.set(fixture.id, { prediction: pred, points });
  }

  // Les bonus/malus de journée ne tombent qu'une fois la journée terminée.
  const done = opts.finished;
  const blankDay = done && basePoints === 0;
  let total = basePoints;
  if (done && allOutcomes) total += BONUS_ALL_OUTCOMES;
  if (done && allExact) total += BONUS_ALL_EXACT;
  if (blankDay) total += MALUS_BLANK_DAY;

  return {
    perFixture,
    basePoints,
    allOutcomes: done && allOutcomes,
    allExact: done && allExact,
    blankDay,
    total,
  };
}

export type StandingRow = {
  memberId: string;
  matchdayPoints: number;
  adjustments: number;
  total: number;
};

/**
 * Classement général : somme des journées (terminées pour les bonus/malus,
 * points de matchs au fil de l'eau sinon) + ajustements de la Commission.
 */
export function standings(
  memberIds: string[],
  matchdays: { fixtures: Fixture[]; finished: boolean }[],
  predictionsByMember: Map<string, Prediction[]>,
  adjustments: PointAdjustment[],
): StandingRow[] {
  const rows = memberIds.map((memberId) => {
    const preds = predictionsByMember.get(memberId) ?? [];
    const matchdayPoints = matchdays.reduce(
      (sum, md) => sum + matchdayBreakdown(md.fixtures, preds, { finished: md.finished }).total,
      0,
    );
    const adj = adjustments
      .filter((a) => a.member_id === memberId)
      .reduce((sum, a) => sum + a.points, 0);
    return { memberId, matchdayPoints, adjustments: adj, total: matchdayPoints + adj };
  });
  return rows.sort((a, b) => b.total - a.total);
}
