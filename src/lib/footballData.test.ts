import { describe, expect, it } from "vitest";
import {
  isMultiplex,
  planFixtures,
  planResults,
  resolveTeam,
  seasonStartYear,
  type ApiMatch,
} from "./footballData";
import type { Team } from "./types";

const team = (id: number, short: string, full: string, aliases: string[] = []): Team => ({
  id,
  short_name: short,
  full_name: full,
  aliases,
  tracked: false,
});

const TEAMS = [
  team(1, "TFC", "Toulouse FC", ["TOULOUSE"]),
  team(2, "PSG", "Paris Saint-Germain", ["PARIS SG"]),
  team(3, "OM", "Olympique de Marseille", ["MARSEILLE"]),
  team(4, "RENNES", "Stade Rennais FC", ["STADE RENNAIS"]),
  team(5, "MONACO", "AS Monaco", ["ASM"]),
  team(6, "OL", "Olympique Lyonnais", ["LYON"]),
  team(7, "LENS", "RC Lens", ["RCL"]),
  team(8, "STRASBOURG", "RC Strasbourg Alsace", ["RCSA"]),
];
const TRACKED = new Set([1, 2, 3, 4, 5]);

const match = (
  matchday: number,
  homeName: string,
  awayName: string,
  utcDate: string,
  score: [number, number] | null = null,
): ApiMatch => ({
  id: Math.round(Math.abs(homeName.length * 1000 + awayName.length)),
  utcDate,
  status: score ? "FINISHED" : "TIMED",
  matchday,
  homeTeam: { id: 0, name: homeName },
  awayTeam: { id: 0, name: awayName },
  score: { fullTime: { home: score?.[0] ?? null, away: score?.[1] ?? null } },
});

describe("appariement des équipes avec l'API", () => {
  it("reconnaît les libellés longs de l'API", () => {
    expect(resolveTeam({ name: "Toulouse FC" }, TEAMS)?.short_name).toBe("TFC");
    expect(resolveTeam({ name: "Olympique de Marseille" }, TEAMS)?.short_name).toBe("OM");
    expect(resolveTeam({ name: "RC Lens" }, TEAMS)?.short_name).toBe("LENS");
  });

  it("applique les correspondances explicites", () => {
    expect(resolveTeam({ name: "Paris Saint-Germain FC" }, TEAMS)?.short_name).toBe("PSG");
    expect(resolveTeam({ name: "Stade Rennais FC 1901" }, TEAMS)?.short_name).toBe("RENNES");
    expect(resolveTeam({ name: "AS Monaco FC" }, TEAMS)?.short_name).toBe("MONACO");
    expect(resolveTeam({ name: "RC Strasbourg Alsace" }, TEAMS)?.short_name).toBe("STRASBOURG");
  });

  it("accepte le nom court ou le code à trois lettres", () => {
    expect(resolveTeam({ name: null, shortName: "Lyon" }, TEAMS)?.short_name).toBe("OL");
  });

  it("renvoie null pour un club inconnu", () => {
    expect(resolveTeam({ name: "FC Barcelone" }, TEAMS)).toBeNull();
  });
});

describe("construction des journées", () => {
  it("ne garde que les matchs des équipes concernées en journée classique", () => {
    const { planned } = planFixtures(
      [
        match(2, "Toulouse FC", "RC Lens", "2026-08-29T19:00:00Z"),
        match(2, "RC Strasbourg Alsace", "Olympique Lyonnais", "2026-08-29T19:00:00Z"),
      ],
      TEAMS,
      TRACKED,
    );
    expect(planned).toHaveLength(1);
    expect(planned[0].homeTeamId).toBe(1);
    expect(planned[0].type).toBe("classique");
  });

  it("prend tous les matchs en multiplex (J1 et J34)", () => {
    const { planned } = planFixtures(
      [
        match(1, "Toulouse FC", "RC Lens", "2026-08-21T19:00:00Z"),
        match(1, "RC Strasbourg Alsace", "Olympique Lyonnais", "2026-08-22T19:00:00Z"),
      ],
      TEAMS,
      TRACKED,
    );
    expect(planned).toHaveLength(2);
    expect(planned.every((p) => p.type === "multiplex")).toBe(true);
    expect(isMultiplex(34)).toBe(true);
    expect(isMultiplex(17)).toBe(false);
  });

  it("classe les matchs par heure de coup d'envoi (article 10)", () => {
    const { planned } = planFixtures(
      [
        match(3, "Olympique de Marseille", "RC Lens", "2026-09-13T19:00:00Z"),
        match(3, "Toulouse FC", "Olympique Lyonnais", "2026-09-12T17:00:00Z"),
      ],
      TEAMS,
      TRACKED,
    );
    expect(planned.map((p) => p.homeTeamId)).toEqual([1, 3]);
  });

  it("signale les clubs qu'il n'a pas su apparier", () => {
    const { planned, unresolved } = planFixtures(
      [match(1, "Toulouse FC", "Club Inconnu", "2026-08-21T19:00:00Z")],
      TEAMS,
      TRACKED,
    );
    expect(planned).toHaveLength(0);
    expect(unresolved).toContain("Club Inconnu");
  });

  it("ignore les matchs annulés et sans journée", () => {
    const cancelled = { ...match(2, "Toulouse FC", "RC Lens", "2026-08-29T19:00:00Z"), status: "CANCELLED" };
    const noMatchday = { ...match(2, "Toulouse FC", "RC Lens", "2026-08-29T19:00:00Z"), matchday: null };
    const { planned } = planFixtures([cancelled, noMatchday], TEAMS, TRACKED);
    expect(planned).toHaveLength(0);
  });
});

describe("récupération des résultats", () => {
  it("ne retient que les matchs terminés avec un score", () => {
    const results = planResults(
      [
        match(1, "Toulouse FC", "RC Lens", "2026-08-21T19:00:00Z", [2, 1]),
        match(1, "Olympique de Marseille", "Olympique Lyonnais", "2026-08-22T19:00:00Z"),
      ],
      TEAMS,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ matchdayNumber: 1, homeTeamId: 1, awayTeamId: 7, home: 2, away: 1 });
  });
});

describe("millésime de saison", () => {
  it("extrait l'année de départ", () => {
    expect(seasonStartYear("Ligue 1 2026-2027")).toBe(2026);
    expect(seasonStartYear("Saison sans année")).toBeNull();
  });
});
