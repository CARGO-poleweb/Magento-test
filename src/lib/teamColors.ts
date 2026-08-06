/**
 * Couleur de chaque club, pour que les affiches se lisent d'un coup d'œil
 * (une pastille aux couleurs du maillot devant chaque équipe). C'est de la
 * couleur qui porte une information, pas de la décoration.
 */
const COLORS: Record<string, string> = {
  TFC: "#5f259f",
  PSG: "#0b1f47",
  OM: "#2fafe0",
  RENNES: "#c8102e",
  MONACO: "#cf022b",
  OL: "#123a7a",
  LOSC: "#d3062a",
  NICE: "#c8102e",
  LENS: "#f2c200",
  STRASBOURG: "#009ee0",
  BREST: "#c8102e",
  "LE HAVRE": "#0b3d91",
  ANGERS: "#111111",
  AUXERRE: "#0a4d9c",
  LORIENT: "#f2761c",
  "PARIS FC": "#0b2a5b",
  TROYES: "#0f4c9c",
  "LE MANS": "#c8102e",
  NANTES: "#f8d000",
  METZ: "#7a0c1e",
};

export function teamColor(shortName: string): string {
  return COLORS[shortName.toUpperCase()] ?? "#5d6c62";
}
