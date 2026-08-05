import type { Team } from "./types";

/**
 * Parseur de pronostics « saisie libre » — le texte brut fait foi, on ne
 * corrige jamais ce que le membre a tapé. On tente de l'interpréter :
 *
 *  - conforme (article 8, écriture exacte article 7)  → auto_valide
 *  - douteux (faute, ambiguïté, ordre inversé…)        → a_examiner,
 *    la Commission de discipline tranche, comme aujourd'hui sur WhatsApp.
 *
 * Format attendu (article 8) :
 *   ÉQUIPE DOMICILE <espace> score domicile <tiret ou slash> score extérieur <espace> ÉQUIPE EXTÉRIEURE
 *   Exemples : « TFC 3-0 OM » ou « TFC 3/0 OM »
 */

export type ParsedPrediction = {
  homeScore: number | null;
  awayScore: number | null;
  status: "auto_valide" | "a_examiner";
  flagReason: string | null;
};

const flag = (reason: string, home: number | null = null, away: number | null = null): ParsedPrediction => ({
  homeScore: home,
  awayScore: away,
  status: "a_examiner",
  flagReason: reason,
});

/** Majuscules, sans accents, espaces normalisés. La casse et les accents ne
 *  sont pas des fautes d'orthographe : « marseille » désigne l'OM sans doute. */
export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/['’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[n];
}

function teamNames(team: Team): string[] {
  return [team.short_name, ...team.aliases].map(normalize);
}

type TeamMatch =
  | { kind: "exact"; team: Team }
  | { kind: "approx"; team: Team; reason: string }
  | { kind: "ambiguous"; teams: Team[] }
  | { kind: "unknown" };

/** Fait correspondre un libellé d'équipe tapé librement aux équipes connues. */
export function matchTeam(token: string, teams: Team[]): TeamMatch {
  const t = normalize(token);

  const exact = teams.filter((team) => teamNames(team).includes(t));
  if (exact.length === 1) return { kind: "exact", team: exact[0] };
  if (exact.length > 1) return { kind: "ambiguous", teams: exact };

  // Libellé incomplet : « PARIS » est un préfixe de « PARIS SG » et de
  // « PARIS FC » → ambigu (article 7, exemple du règlement).
  const prefix = teams.filter((team) => teamNames(team).some((n) => n.startsWith(t + " ")));
  if (prefix.length > 1) return { kind: "ambiguous", teams: prefix };
  if (prefix.length === 1) {
    return { kind: "approx", team: prefix[0], reason: `écriture incomplète « ${token.trim()} »` };
  }

  // Faute de frappe probable : « MONACU » → MONACO (article 7). On ne corrige
  // pas, on signale à la Commission qui décide de comptabiliser ou non.
  const close = teams.filter((team) =>
    teamNames(team).some((n) => levenshtein(t, n) <= (n.length > 4 ? 2 : 1)),
  );
  if (close.length === 1) {
    return { kind: "approx", team: close[0], reason: `orthographe douteuse « ${token.trim()} »` };
  }
  if (close.length > 1) return { kind: "ambiguous", teams: close };

  return { kind: "unknown" };
}

/**
 * Interprète un pronostic pour un match donné (domicile/extérieur connus).
 * `teams` : toutes les équipes de la ligue (pour détecter « mauvais match »).
 */
export function parsePrediction(
  rawText: string,
  fixture: { home: Team; away: Team },
  teams: Team[],
): ParsedPrediction {
  const text = normalize(rawText);
  if (!text) return flag("pronostic vide");

  // ÉQUIPE <espace> N <tiret ou slash> N <espace> ÉQUIPE (article 8)
  const m = text.match(/^(.+?)\s+(\d{1,2})\s*([-/])\s*(\d{1,2})\s+(.+)$/);
  if (!m) {
    return flag("format non conforme (article 8) — attendu : « TFC 3-0 OM » ou « TFC 3/0 OM »");
  }

  const [, homeToken, homeScoreStr, , awayScoreStr, awayToken] = m;
  const score1 = parseInt(homeScoreStr, 10);
  const score2 = parseInt(awayScoreStr, 10);

  const first = matchTeam(homeToken, teams);
  const second = matchTeam(awayToken, teams);

  if (first.kind === "unknown" || second.kind === "unknown") {
    return flag("équipe inconnue (article 7)");
  }
  if (first.kind === "ambiguous" || second.kind === "ambiguous") {
    const which = first.kind === "ambiguous" ? first : (second as Extract<TeamMatch, { kind: "ambiguous" }>);
    const names = which.teams.map((t) => t.short_name).join(" ou ");
    return flag(`écriture ambiguë (article 7) — ${names} ?`);
  }

  const firstTeam = first.team;
  const secondTeam = second.team;
  const doubts: string[] = [];
  if (first.kind === "approx") doubts.push(first.reason);
  if (second.kind === "approx") doubts.push(second.reason);

  // Les deux équipes doivent être celles du match.
  if (firstTeam.id === fixture.home.id && secondTeam.id === fixture.away.id) {
    if (doubts.length > 0) return flag(`${doubts.join(", ")} (article 7)`, score1, score2);
    return { homeScore: score1, awayScore: score2, status: "auto_valide", flagReason: null };
  }

  // Ordre domicile/extérieur inversé : on réoriente les scores mais la
  // Commission tranche (article 8 impose l'équipe à domicile en premier).
  if (firstTeam.id === fixture.away.id && secondTeam.id === fixture.home.id) {
    doubts.push("ordre domicile/extérieur inversé (article 8)");
    return flag(doubts.join(", "), score2, score1);
  }

  return flag(
    `les équipes citées (${firstTeam.short_name}, ${secondTeam.short_name}) ne correspondent pas au match ${fixture.home.short_name} - ${fixture.away.short_name}`,
  );
}
