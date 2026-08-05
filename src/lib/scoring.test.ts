import { describe, expect, it } from "vitest";
import {
  BONUS_ALL_EXACT,
  BONUS_ALL_OUTCOMES,
  MALUS_BLANK_DAY,
  effectivePrediction,
  matchPoints,
  matchdayBreakdown,
  standings,
} from "./scoring";
import type { Fixture, Prediction } from "./types";

const fixture = (id: number, home: number | null = null, away: number | null = null): Fixture => ({
  id,
  matchday_id: 1,
  position: id,
  home_team_id: 10 + id,
  away_team_id: 20 + id,
  kickoff_at: "2025-08-15T19:00:00Z",
  home_score: home,
  away_score: away,
});

let seq = 0;
const pred = (
  fixtureId: number,
  home: number | null,
  away: number | null,
  overrides: Partial<Prediction> = {},
): Prediction => ({
  id: `p${++seq}`,
  fixture_id: fixtureId,
  member_id: "alice",
  raw_text: `${home}-${away}`,
  home_score_parsed: home,
  away_score_parsed: away,
  status: "auto_valide",
  flag_reason: null,
  created_at: new Date(2025, 7, 1, 10, seq).toISOString(),
  ...overrides,
});

describe("barème par match", () => {
  it("score exact = 4 pts", () => {
    expect(matchPoints({ home: 3, away: 1 }, { home: 3, away: 1 })).toBe(4);
  });
  it("bonne différence de buts = 3 pts", () => {
    expect(matchPoints({ home: 2, away: 0 }, { home: 3, away: 1 })).toBe(3);
  });
  it("nul correct sans le bon score = 3 pts (différence nulle)", () => {
    expect(matchPoints({ home: 0, away: 0 }, { home: 2, away: 2 })).toBe(3);
  });
  it("bon vainqueur, mauvais écart = 2 pts", () => {
    expect(matchPoints({ home: 1, away: 0 }, { home: 3, away: 0 })).toBe(2);
  });
  it("mauvais résultat = 0 pt", () => {
    expect(matchPoints({ home: 1, away: 0 }, { home: 0, away: 2 })).toBe(0);
  });
});

describe("article 6 : le premier pari accepté", () => {
  it("retient le plus ancien pronostic comptabilisé", () => {
    const first = pred(1, 1, 0);
    const duplicate = pred(1, 3, 0, { status: "a_examiner", flag_reason: "doublon (article 6)" });
    expect(effectivePrediction([duplicate, first])?.id).toBe(first.id);
  });

  it("ignore les pronostics non comptabilisés par la Commission", () => {
    const refused = pred(1, 1, 0, { status: "non_comptabilise" });
    const kept = pred(1, 2, 0, { status: "comptabilise" });
    expect(effectivePrediction([refused, kept])?.id).toBe(kept.id);
  });

  it("retient un doublon requalifié « comptabilisé » par la Commission", () => {
    const flagged = pred(1, 1, 0, { status: "a_examiner" });
    expect(effectivePrediction([flagged])).toBeNull();
  });
});

describe("bonus et malus de journée", () => {
  const fixtures = [fixture(1, 2, 0), fixture(2, 1, 1), fixture(3, 0, 3)];

  it("+3 si tous les résultats sont bons, +10 si tous les scores exacts (cumulés)", () => {
    const preds = [pred(1, 2, 0), pred(2, 1, 1), pred(3, 0, 3)];
    const b = matchdayBreakdown(fixtures, preds, { finished: true });
    expect(b.basePoints).toBe(12);
    expect(b.total).toBe(12 + BONUS_ALL_OUTCOMES + BONUS_ALL_EXACT);
  });

  it("+3 seul si tous les résultats sont bons sans tous les scores", () => {
    const preds = [pred(1, 1, 0), pred(2, 2, 2), pred(3, 0, 3)];
    const b = matchdayBreakdown(fixtures, preds, { finished: true });
    expect(b.allOutcomes).toBe(true);
    expect(b.allExact).toBe(false);
    expect(b.total).toBe(2 + 3 + 4 + BONUS_ALL_OUTCOMES);
  });

  it("un match non pronostiqué prive du bonus « tous les résultats »", () => {
    const preds = [pred(1, 2, 0), pred(2, 1, 1)];
    const b = matchdayBreakdown(fixtures, preds, { finished: true });
    expect(b.allOutcomes).toBe(false);
  });

  it("−2 pour une journée blanche", () => {
    const preds = [pred(1, 0, 2), pred(2, 1, 0), pred(3, 3, 0)];
    const b = matchdayBreakdown(fixtures, preds, { finished: true });
    expect(b.basePoints).toBe(0);
    expect(b.total).toBe(MALUS_BLANK_DAY);
  });

  it("−2 aussi pour l'absent total de la journée", () => {
    const b = matchdayBreakdown(fixtures, [], { finished: true });
    expect(b.total).toBe(MALUS_BLANK_DAY);
  });

  it("pas de bonus/malus tant que la journée n'est pas terminée", () => {
    const preds = [pred(1, 2, 0), pred(2, 1, 1), pred(3, 0, 3)];
    const b = matchdayBreakdown(fixtures, preds, { finished: false });
    expect(b.total).toBe(b.basePoints);
  });
});

describe("classement général", () => {
  it("somme les journées et les ajustements, trié décroissant", () => {
    const fixtures = [fixture(1, 2, 0)];
    const alice = [pred(1, 2, 0)]; // 4 pts + 3 (tous résultats) + 10 (tous scores)
    const bob = [pred(1, 0, 1, { member_id: "bob" })]; // 0 pt → −2

    const rows = standings(
      ["alice", "bob"],
      [{ fixtures, finished: true }],
      new Map([
        ["alice", alice],
        ["bob", bob],
      ]),
      [
        {
          id: "adj1",
          member_id: "alice",
          matchday_id: null,
          points: -2,
          reason: "message modifié (article 12)",
          created_at: "2025-08-20T00:00:00Z",
        },
      ],
    );

    expect(rows[0]).toMatchObject({ memberId: "alice", matchdayPoints: 17, adjustments: -2, total: 15 });
    expect(rows[1]).toMatchObject({ memberId: "bob", total: -2 });
  });
});
