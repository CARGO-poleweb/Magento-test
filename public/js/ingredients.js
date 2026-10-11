// Parseur d'ingrédients partagé entre le serveur et le navigateur (module ES).
// "200 g de farine" -> { name: "farine", qty: 200, unit: "g" }

export const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const UNITS = {
  g: "g", gr: "g", gramme: "g", grammes: "g", kg: "kg", kilo: "kg", kilos: "kg",
  mg: "mg", ml: "ml", cl: "cl", dl: "dl", l: "l", litre: "l", litres: "l",
  cs: "c. à soupe", "c.a.s": "c. à soupe", cas: "c. à soupe", "cuillere a soupe": "c. à soupe",
  "cuilleres a soupe": "c. à soupe", "c. a soupe": "c. à soupe", "cuil. a soupe": "c. à soupe",
  "cuil a soupe": "c. à soupe", "c a soupe": "c. à soupe", "cuilleree a soupe": "c. à soupe",
  "cuillerees a soupe": "c. à soupe", "cuillere a soupe rase": "c. à soupe",
  cc: "c. à café", "c.a.c": "c. à café", cac: "c. à café", "cuillere a cafe": "c. à café",
  "cuilleres a cafe": "c. à café", "c. a cafe": "c. à café", "cuil. a cafe": "c. à café",
  "cuil a cafe": "c. à café", "c a cafe": "c. à café", "cuilleree a cafe": "c. à café",
  "cuillerees a cafe": "c. à café",
  pincee: "pincée", pincees: "pincée", sachet: "sachet", sachets: "sachet",
  tranche: "tranche", tranches: "tranche", gousse: "gousse", gousses: "gousse",
  boite: "boîte", boites: "boîte", pot: "pot", pots: "pot", botte: "botte", bottes: "botte",
  branche: "branche", branches: "branche", feuille: "feuille", feuilles: "feuille",
  brin: "brin", brins: "brin", verre: "verre", verres: "verre", tasse: "tasse", tasses: "tasse",
  paquet: "paquet", paquets: "paquet", bouquet: "bouquet", morceau: "morceau", morceaux: "morceau",
  cube: "cube", cubes: "cube", filet: "filet", filets: "filet", rouleau: "rouleau", rouleaux: "rouleau",
  bocal: "bocal", bocaux: "bocal", barquette: "barquette", barquettes: "barquette",
  tablette: "tablette", tablettes: "tablette", poignee: "poignée", poignees: "poignée",
  tbsp: "c. à soupe", tsp: "c. à café", cup: "tasse", cups: "tasse", oz: "oz", lb: "lb",
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const UNIT_RE = new RegExp(
  "^(" + Object.keys(UNITS).sort((a, b) => b.length - a.length).map(escapeRe).join("|") + ")\\.?(?=\\s|$)",
  "i",
);
const FRACTIONS = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };

export function parseNumber(s) {
  if (s == null) return null;
  s = String(s).trim().replace(",", ".");
  if (FRACTIONS[s] != null) return FRACTIONS[s];
  let m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/); // "1 1/2"
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = s.match(/^(\d+)\s*([½¼¾⅓⅔⅛])$/); // "1½"
  if (m) return Number(m[1]) + FRACTIONS[m[2]];
  m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const QTY_RE = /^((?:\d+\s+\d+\s*\/\s*\d+)|(?:\d+\s*[½¼¾⅓⅔⅛])|(?:\d+\s*\/\s*\d+)|(?:\d+[.,]?\d*)|[½¼¾⅓⅔⅛])\s*/;

export function parseIngredientLine(line) {
  let s = String(line || "").replace(/^[\-•*–—\s]+/, "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  let qty = null;
  let unit = "";
  // "farine : 200 g" / "farine (200 g)" -> remettre la quantité devant
  const tail = s.match(/^(.+?)\s*[:(]\s*((?:\d+[.,]?\d*|[½¼¾⅓⅔⅛])\s*[a-zéèê.]*)\s*\)?$/i);
  if (tail && !QTY_RE.test(s)) s = tail[2] + " " + tail[1];
  const mq = s.match(QTY_RE);
  if (mq) {
    qty = parseNumber(mq[1]);
    s = s.slice(mq[0].length);
  }
  const nu = norm(s).match(UNIT_RE);
  if (nu) {
    unit = UNITS[nu[1].toLowerCase().replace(/\.$/, "")] || nu[1];
    s = s.slice(nu[0].length).trim();
  }
  s = s.replace(/^(de\s+|d['’]\s*|of\s+)/i, "").trim();
  if (!s && qty == null) { s = unit; unit = ""; }
  s = s.replace(/\s*[.;]+$/, "");
  return { name: s, qty, unit };
}

export function fmtQty(q) {
  if (q == null || q === "" || Number.isNaN(Number(q))) return "";
  const n = Number(q);
  const r = n >= 10 ? Math.round(n) : Math.round(n * 4) / 4; // quarts en dessous de 10
  return String(r).replace(".", ",");
}

export const ingredientToLine = (i) => [fmtQty(i.qty), i.unit, i.name].filter(Boolean).join(" ");

export const scaleIngredient = (i, persons, base) => ({
  ...i,
  qty: i.qty != null ? (i.qty * persons) / (base || 1) : null,
});

/** Fusionne les ingrédients de plusieurs recettes, chacune mise à l'échelle. */
export function mergeIngredients(recipes, selection) {
  const merged = new Map();
  for (const r of recipes) {
    const persons = selection[r.id];
    if (!persons) continue;
    for (const ing of r.ingredients || []) {
      const sc = scaleIngredient(ing, persons, r.servings);
      const key = norm(sc.name) + "|" + norm(sc.unit);
      const cur = merged.get(key);
      if (cur) {
        cur.qty = cur.qty == null && sc.qty == null ? null : (cur.qty || 0) + (sc.qty || 0);
        if (!cur.recipes.includes(r.title)) cur.recipes.push(r.title);
      } else {
        merged.set(key, { name: sc.name, unit: sc.unit || "", qty: sc.qty, recipes: [r.title] });
      }
    }
  }
  return [...merged.values()].map((v) => ({ ...v, qty: v.qty == null ? null : Math.round(v.qty * 100) / 100 }));
}
