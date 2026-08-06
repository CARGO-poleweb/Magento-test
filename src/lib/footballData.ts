import { normalize } from "./parser";
import type { Team } from "./types";

/**
 * Intégration football-data.org (API v4) — calendrier et résultats de la
 * Ligue 1. Sans jeton configuré, tout est désactivé proprement : la saisie
 * manuelle du Président reste la voie de secours (article 1).
 */

export type ApiMatch = {
  id: number;
  utcDate: string;
  status: string; // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED | POSTPONED…
  matchday: number | null;
  homeTeam: { id: number; name: string | null; shortName?: string | null; tla?: string | null };
  awayTeam: { id: number; name: string | null; shortName?: string | null; tla?: string | null };
  score: { fullTime: { home: number | null; away: number | null } };
};

const API_BASE = "https://api.football-data.org/v4";
const COMPETITION = "FL1"; // Ligue 1

export function hasFootballDataToken(): boolean {
  return Boolean(process.env.FOOTBALL_DATA_TOKEN);
}

/** Millésime de départ d'une saison : « Ligue 1 2026-2027 » → 2026. */
export function seasonStartYear(seasonName: string): number | null {
  const m = seasonName.match(/(20\d{2})/);
  return m ? Number(m[1]) : null;
}

export async function fetchSeasonMatches(year: number): Promise<ApiMatch[]> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("Jeton football-data.org absent (FOOTBALL_DATA_TOKEN).");

  const res = await fetch(`${API_BASE}/competitions/${COMPETITION}/matches?season=${year}`, {
    headers: { "X-Auth-Token": token },
    cache: "no-store",
  });
  if (res.status === 403) {
    throw new Error("Accès refusé par football-data.org — jeton invalide ou plan insuffisant.");
  }
  if (res.status === 429) {
    throw new Error("Trop d'appels à football-data.org — réessaie dans une minute.");
  }
  if (!res.ok) {
    throw new Error(`football-data.org a répondu ${res.status}.`);
  }
  const json = (await res.json()) as { matches?: ApiMatch[] };
  return json.matches ?? [];
}

/**
 * Correspondances explicites pour les clubs dont l'appellation de l'API
 * s'éloigne trop de la nôtre. Le reste se résout par les alias existants.
 */
const OVERRIDES: Record<string, string> = {
  "PARIS SAINT GERMAIN FC": "PSG",
  "STADE RENNAIS FC 1901": "RENNES",
  "AS MONACO FC": "MONACO",
  "LILLE OSC": "LOSC",
  "ES TROYES AC": "TROYES",
  "RC STRASBOURG ALSACE": "STRASBOURG",
  "STADE BRESTOIS 29": "BREST",
  "LE HAVRE AC": "LE HAVRE",
  "LE MANS FC": "LE MANS",
  "PARIS FC": "PARIS FC",
};

/** Retrouve l'équipe de la ligue correspondant à celle annoncée par l'API. */
export function resolveTeam(
  apiTeam: { name?: string | null; shortName?: string | null; tla?: string | null },
  teams: Team[],
): Team | null {
  const candidates = [apiTeam.name, apiTeam.shortName, apiTeam.tla]
    .filter((v): v is string => Boolean(v))
    .map(normalize);
  if (candidates.length === 0) return null;

  for (const c of candidates) {
    const forced = OVERRIDES[c];
    if (forced) {
      const team = teams.find((t) => normalize(t.short_name) === normalize(forced));
      if (team) return team;
    }
  }

  const known = (t: Team) => [t.short_name, t.full_name, ...t.aliases].map(normalize);

  for (const c of candidates) {
    const exact = teams.find((t) => known(t).includes(c));
    if (exact) return exact;
  }

  // Dernier recours : le nom de l'API contient notre libellé (« Toulouse FC »
  // contient « TOULOUSE »), ou l'inverse.
  for (const c of candidates) {
    const partial = teams.filter((t) =>
      known(t).some((n) => n.length >= 4 && (c.includes(n) || n.includes(c))),
    );
    if (partial.length === 1) return partial[0];
  }
  return null;
}

export type PlannedFixture = {
  matchdayNumber: number;
  type: "classique" | "multiplex";
  homeTeamId: number;
  awayTeamId: number;
  kickoffUtc: string;
};

/** J1 et J34 sont des multiplex : tous les matchs comptent (article multiplex). */
export function isMultiplex(matchdayNumber: number): boolean {
  return matchdayNumber === 1 || matchdayNumber === 34;
}

/**
 * Transforme le calendrier de l'API en journées de la ligue : multiplex =
 * tous les matchs, journée classique = uniquement les matchs des équipes
 * concernées, classés par heure de coup d'envoi (article 10).
 */
export function planFixtures(
  matches: ApiMatch[],
  teams: Team[],
  trackedTeamIds: Set<number>,
): { planned: PlannedFixture[]; unresolved: string[] } {
  const unresolved = new Set<string>();
  const planned: PlannedFixture[] = [];

  for (const m of matches) {
    if (!m.matchday) continue;
    if (m.status === "CANCELLED") continue;

    const home = resolveTeam(m.homeTeam, teams);
    const away = resolveTeam(m.awayTeam, teams);
    if (!home) unresolved.add(m.homeTeam.name ?? "?");
    if (!away) unresolved.add(m.awayTeam.name ?? "?");
    if (!home || !away) continue;

    const multiplex = isMultiplex(m.matchday);
    const concerne = trackedTeamIds.has(home.id) || trackedTeamIds.has(away.id);
    if (!multiplex && !concerne) continue;

    planned.push({
      matchdayNumber: m.matchday,
      type: multiplex ? "multiplex" : "classique",
      homeTeamId: home.id,
      awayTeamId: away.id,
      kickoffUtc: new Date(m.utcDate).toISOString(),
    });
  }

  planned.sort(
    (a, b) =>
      a.matchdayNumber - b.matchdayNumber ||
      new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime(),
  );
  return { planned, unresolved: [...unresolved] };
}

export type ApiResult = {
  matchdayNumber: number;
  homeTeamId: number;
  awayTeamId: number;
  home: number;
  away: number;
};

/** Ne retient que les matchs terminés dont le score est connu. */
export function planResults(matches: ApiMatch[], teams: Team[]): ApiResult[] {
  const out: ApiResult[] = [];
  for (const m of matches) {
    if (m.status !== "FINISHED" || !m.matchday) continue;
    const { home: h, away: a } = m.score.fullTime;
    if (h === null || a === null) continue;
    const home = resolveTeam(m.homeTeam, teams);
    const away = resolveTeam(m.awayTeam, teams);
    if (!home || !away) continue;
    out.push({
      matchdayNumber: m.matchday,
      homeTeamId: home.id,
      awayTeamId: away.id,
      home: h,
      away: a,
    });
  }
  return out;
}
