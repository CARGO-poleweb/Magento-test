import { describe, expect, it } from "vitest";
import { looksLikePrediction, parsePrediction } from "./parser";
import type { Team } from "./types";

const team = (id: number, short: string, aliases: string[] = [], full = short): Team => ({
  id,
  short_name: short,
  full_name: full,
  aliases,
  tracked: false,
});

const TFC = team(1, "TFC", ["TOULOUSE"]);
const PSG = team(2, "PSG", ["PARIS SG", "PARIS SAINT GERMAIN", "PARIS-SG"]);
const OM = team(3, "OM", ["MARSEILLE"]);
const MONACO = team(4, "MONACO", ["ASM", "AS MONACO"]);
const PARIS_FC = team(5, "PARIS FC", ["PFC"]);
const LE_HAVRE = team(6, "LE HAVRE", ["HAC", "HAVRE"]);

const TEAMS = [TFC, PSG, OM, MONACO, PARIS_FC, LE_HAVRE];

describe("format conforme (article 8)", () => {
  it("accepte le tiret : TFC 3-0 OM", () => {
    const r = parsePrediction("TFC 3-0 OM", { home: TFC, away: OM }, TEAMS);
    expect(r).toEqual({ homeScore: 3, awayScore: 0, status: "auto_valide", flagReason: null });
  });

  it("accepte le slash : TFC 3/0 OM", () => {
    const r = parsePrediction("TFC 3/0 OM", { home: TFC, away: OM }, TEAMS);
    expect(r.status).toBe("auto_valide");
    expect([r.homeScore, r.awayScore]).toEqual([3, 0]);
  });

  it("tolère casse, accents et espaces superflus", () => {
    const r = parsePrediction("  marseille  2 - 1  monaco ", { home: OM, away: MONACO }, TEAMS);
    expect(r.status).toBe("auto_valide");
    expect([r.homeScore, r.awayScore]).toEqual([2, 1]);
  });

  it("accepte les noms d'équipe à plusieurs mots", () => {
    const r = parsePrediction("LE HAVRE 1-0 PSG", { home: LE_HAVRE, away: PSG }, TEAMS);
    expect(r.status).toBe("auto_valide");
  });

  it("refuse tout autre séparateur : TFC 3:0 OM", () => {
    const r = parsePrediction("TFC 3:0 OM", { home: TFC, away: OM }, TEAMS);
    expect(r.status).toBe("a_examiner");
    expect(r.flagReason).toContain("article 8");
  });

  it("refuse le score placé ailleurs : TFC OM 3-0", () => {
    const r = parsePrediction("TFC OM 3-0", { home: TFC, away: OM }, TEAMS);
    expect(r.status).toBe("a_examiner");
  });
});

describe("orthographe et ambiguïté (article 7)", () => {
  it("signale MONACU sans le corriger, scores conservés", () => {
    const r = parsePrediction("TFC 2-2 MONACU", { home: TFC, away: MONACO }, TEAMS);
    expect(r.status).toBe("a_examiner");
    expect(r.flagReason).toContain("MONACU");
    expect([r.homeScore, r.awayScore]).toEqual([2, 2]);
  });

  it("signale PARIS comme ambigu (PSG ou PARIS FC)", () => {
    const r = parsePrediction("PARIS 4-0 OM", { home: PSG, away: OM }, TEAMS);
    expect(r.status).toBe("a_examiner");
    expect(r.flagReason).toContain("ambigu");
    expect(r.flagReason).toMatch(/PSG|PARIS FC/);
  });

  it("signale une équipe inconnue", () => {
    const r = parsePrediction("BARCELONE 2-0 OM", { home: PSG, away: OM }, TEAMS);
    expect(r.status).toBe("a_examiner");
    expect(r.flagReason).toContain("inconnue");
  });
});

describe("cohérence avec le match", () => {
  it("réoriente un ordre inversé et le signale (article 8)", () => {
    const r = parsePrediction("OM 0-3 TFC", { home: TFC, away: OM }, TEAMS);
    expect(r.status).toBe("a_examiner");
    expect(r.flagReason).toContain("inversé");
    expect([r.homeScore, r.awayScore]).toEqual([3, 0]);
  });

  it("signale des équipes qui ne correspondent pas au match", () => {
    const r = parsePrediction("PSG 2-0 MONACO", { home: TFC, away: OM }, TEAMS);
    expect(r.status).toBe("a_examiner");
    expect(r.flagReason).toContain("ne correspondent pas");
  });

  it("signale un pronostic vide", () => {
    const r = parsePrediction("   ", { home: TFC, away: OM }, TEAMS);
    expect(r.status).toBe("a_examiner");
  });
});

describe("détection de pronostic dans le Vestiaire (article 11)", () => {
  it("repère un prono posté dans le chat", () => {
    expect(looksLikePrediction("PSG 4-0 LENS ce soir je le sens bien")).toBe(true);
    expect(looksLikePrediction("tfc 2/1 om")).toBe(true);
  });

  it("laisse passer la conversation normale", () => {
    expect(looksLikePrediction("on mange à 20h30 avant le match ?")).toBe(false);
    expect(looksLikePrediction("grosse soirée hier 😂")).toBe(false);
    expect(looksLikePrediction("")).toBe(false);
  });
});
