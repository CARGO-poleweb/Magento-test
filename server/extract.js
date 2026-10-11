// Extraction d'une recette depuis une URL :
//  1. données structurées schema.org/Recipe (JSON-LD) présentes sur la plupart des sites ;
//  2. sinon, lecture du texte de la page par Claude ;
//  3. dans les deux cas, normalisation des ingrédients (Claude si une clé API est configurée,
//     sinon le parseur local).
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { parseIngredientLine } from "../public/js/ingredients.js";

const MAX_HTML = 3 * 1024 * 1024;
const MAX_TEXT = 60_000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export class ExtractError extends Error {
  constructor(message, code = "extract_failed") { super(message); this.code = code; }
}

// ---------- Réseau ----------
function isPrivateIp(ip) {
  if (isIP(ip) === 6) return /^(::1|::|fc|fd|fe80)/i.test(ip) || ip.startsWith("::ffff:") && isPrivateIp(ip.slice(7));
  const p = ip.split(".").map(Number);
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168);
}

export async function assertPublicUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new ExtractError("Ce lien n'est pas une adresse valide.", "bad_url"); }
  if (!/^https?:$/.test(u.protocol)) throw new ExtractError("Seuls les liens http(s) sont acceptés.", "bad_url");
  const host = u.hostname;
  if (host === "localhost" || host.endsWith(".local")) throw new ExtractError("Adresse non autorisée.", "bad_url");
  const addr = isIP(host) ? host : (await lookup(host).catch(() => null))?.address;
  if (!addr) throw new ExtractError("Site introuvable : vérifie le lien.", "dns");
  if (isPrivateIp(addr)) throw new ExtractError("Adresse non autorisée.", "bad_url");
  return u;
}

export async function fetchHtml(url) {
  const u = await assertPublicUrl(url);
  let res;
  try {
    res = await fetch(u, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "fr-FR,fr;q=0.9,en;q=0.5" },
      redirect: "follow", signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new ExtractError("Impossible de joindre le site (" + (e.name === "TimeoutError" ? "délai dépassé" : "connexion refusée") + ").", "network");
  }
  if (!res.ok) throw new ExtractError(`Le site a répondu ${res.status}. Certains sites bloquent les robots : copie le texte de la recette à la main.`, "http_" + res.status);
  const ct = res.headers.get("content-type") || "";
  if (!/html|xml|text/i.test(ct)) throw new ExtractError("Ce lien ne pointe pas vers une page web (" + ct + ").", "not_html");
  const reader = res.body.getReader();
  const chunks = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length; chunks.push(value);
    if (size > MAX_HTML) { reader.cancel(); break; }
  }
  return { html: Buffer.concat(chunks).toString("utf8"), finalUrl: res.url || u.href };
}

// ---------- JSON-LD ----------
export function findJsonLdRecipe(html) {
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  const candidates = [];
  while ((m = re.exec(html))) {
    let raw = m[1].trim().replace(/^<!--/, "").replace(/-->$/, "").replace(/^\/\/<!\[CDATA\[|\/\/\]\]>$/g, "").trim();
    let data;
    try { data = JSON.parse(raw); } catch { continue; }
    walk(data, candidates);
  }
  return candidates[0] || null;
}
function hasType(o, t) {
  const ty = o["@type"];
  return Array.isArray(ty) ? ty.some((x) => String(x).toLowerCase() === t) : String(ty || "").toLowerCase() === t;
}
function walk(node, out, depth = 0) {
  if (!node || typeof node !== "object" || depth > 6) return;
  if (Array.isArray(node)) return node.forEach((n) => walk(n, out, depth + 1));
  if (hasType(node, "recipe") && (node.recipeIngredient || node.ingredients)) out.push(node);
  for (const k of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item"]) if (node[k]) walk(node[k], out, depth + 1);
}
const text = (v) => (v == null ? "" : typeof v === "string" ? v : Array.isArray(v) ? text(v[0]) : typeof v === "object" ? text(v.name ?? v["@value"] ?? v.url ?? "") : String(v));
const decode = (s) => String(s).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  const map = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", ocirc: "ô", ecirc: "ê", icirc: "î", ucirc: "û", ugrave: "ù", acirc: "â", euml: "ë", iuml: "ï", oelig: "œ", deg: "°", frac12: "½", frac14: "¼", frac34: "¾", rsquo: "’", hellip: "…" };
  if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return map[e.toLowerCase()] ?? m;
}).replace(/\s+/g, " ").trim();

export function parseYield(v) {
  const s = text(Array.isArray(v) ? v.find((x) => /\d/.test(String(x))) ?? v[0] : v);
  const m = s.match(/(\d+)/);
  return m ? Math.max(1, Math.min(100, Number(m[1]))) : null;
}

export function recipeFromJsonLd(ld) {
  const lines = (ld.recipeIngredient || ld.ingredients || []).map((x) => decode(text(x))).filter(Boolean);
  const img = ld.image;
  const image = typeof img === "string" ? img : Array.isArray(img) ? text(img[0]) : img?.url ? text(img.url) : "";
  return {
    title: decode(text(ld.name)) || "",
    servings: parseYield(ld.recipeYield) ?? 4,
    category: decode(text(ld.recipeCategory)) || "",
    image: image.startsWith("http") ? image : "",
    ingredientLines: lines,
  };
}

// ---------- Texte brut ----------
export function htmlToText(html) {
  let h = html.replace(/<(script|style|noscript|svg|iframe|template)[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const main = h.match(/<(main|article)[^>]*>([\s\S]*?)<\/\1>/i);
  if (main && main[2].replace(/<[^>]+>/g, "").length > 400) h = main[2];
  h = h.replace(/<\/(p|div|li|h[1-6]|tr|br|section|article|header|footer|dd|dt)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  h = h.split("\n").map((l) => decode(l)).filter(Boolean).join("\n");
  return h.slice(0, MAX_TEXT);
}
export function titleFromHtml(html) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const t = og?.[1] || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  return decode(t).replace(/\s*[|\-–:]\s*[^|\-–:]{0,40}$/, "").trim();
}

// ---------- Claude ----------
const Ingredient = z.object({
  name: z.string().describe("Nom de l'ingrédient en français, sans quantité ni unité"),
  qty: z.number().nullable().describe("Quantité numérique, ou null si non chiffrée (« un peu », « selon goût »)"),
  unit: z.string().describe("Unité parmi : g, kg, ml, cl, l, c. à soupe, c. à café, pincée, gousse, tranche, sachet, boîte, pot, botte, branche, feuille, brin, ou \"\" pour une pièce (3 œufs → qty 3, unit \"\")"),
});
const RecipeSchema = z.object({
  title: z.string(),
  servings: z.number().int().min(1).max(100).describe("Nombre de personnes ou de parts ; 4 si absent"),
  category: z.string().describe("Une catégorie parmi la liste fournie, ou \"\" si aucune ne convient"),
  ingredients: z.array(Ingredient),
});
const LinesSchema = z.object({ ingredients: z.array(Ingredient) });

function client() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic();
}
export const claudeAvailable = () => !!process.env.ANTHROPIC_API_KEY;
const MODEL = () => process.env.CLAUDE_MODEL || "claude-opus-5-5";
const EFFORT = () => process.env.CLAUDE_EFFORT || "medium";

async function ask(schema, system, user) {
  // `user` : texte, ou tableau de blocs de contenu (images + texte)
  const c = client();
  if (!c) throw new ExtractError("Aucune clé API Anthropic configurée.", "no_api_key");
  let res;
  const params = {
    model: MODEL(), max_tokens: 16000,
    output_config: { effort: EFFORT(), format: zodOutputFormat(schema) },
    system, messages: [{ role: "user", content: user }],
  };
  try {
    // Les replis serveur (fallbacks) sont optionnels : CLAUDE_FALLBACKS=1 pour les activer.
    res = process.env.CLAUDE_FALLBACKS === "1"
      ? await c.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
      : await c.messages.create(params);
  } catch (e) {
    const detail = (e && e.message ? String(e.message) : "").replace(/\s+/g, " ").slice(0, 300);
    console.error("[claude]", MODEL(), e?.status, detail);
    if (e instanceof Anthropic.AuthenticationError) throw new ExtractError("Clé API Anthropic invalide.", "api_auth");
    if (e instanceof Anthropic.RateLimitError) throw new ExtractError("Trop de demandes à Claude, réessaie dans une minute.", "api_rate");
    if (e instanceof Anthropic.APIError) throw new ExtractError(`Erreur de l'API Claude (${e.status}) : ${detail}`, "api_error");
    throw new ExtractError("Claude est injoignable pour le moment.", "api_network");
  }
  if (res.stop_reason === "refusal") throw new ExtractError("Claude a refusé d'analyser cette page.", "api_refusal");
  if (res.stop_reason === "max_tokens") throw new ExtractError("La page est trop longue pour être analysée d'un coup.", "api_truncated");
  const txt = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try { return schema.parse(JSON.parse(txt)); }
  catch { throw new ExtractError("Réponse de Claude illisible, réessaie.", "api_parse"); }
}

const SYSTEM = "Tu es un assistant de cuisine qui structure des recettes en JSON pour une liste de courses. Réponds uniquement avec le JSON demandé. Garde tous les ingrédients, y compris sel, poivre, huile. Noms en français, au singulier ou pluriel naturel.";

export async function normalizeLinesWithClaude(lines, categories = []) {
  const r = await ask(LinesSchema, SYSTEM,
    `Transforme chaque ligne d'ingrédient en objet {name, qty, unit}. Une ligne = un objet, dans le même ordre. ` +
    `Quantités converties en nombre (1/2 → 0.5, « une dizaine » → 10). Lignes :\n` + lines.map((l) => "- " + l).join("\n"));
  return r.ingredients;
}

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Lit une recette sur une ou plusieurs photos (livre, fiche manuscrite, écran). */
export async function extractFromPhotos(photos, categories = []) {
  if (!claudeAvailable()) throw new ExtractError("La lecture de photos demande une clé API Claude (ANTHROPIC_API_KEY).", "no_api_key");
  if (!Array.isArray(photos) || !photos.length) throw new ExtractError("Aucune photo reçue.", "bad_photo");
  if (photos.length > 4) throw new ExtractError("Quatre photos au maximum par recette.", "bad_photo");
  const blocks = [];
  for (const p of photos) {
    if (!PHOTO_TYPES.has(p.mediaType)) throw new ExtractError("Format de photo non pris en charge (JPEG, PNG, WebP ou GIF).", "bad_photo");
    if (typeof p.data !== "string" || !p.data) throw new ExtractError("Photo illisible.", "bad_photo");
    if (Buffer.byteLength(p.data, "base64") > MAX_PHOTO_BYTES) throw new ExtractError("Photo trop lourde (5 Mo maximum).", "bad_photo");
    blocks.push({ type: "image", source: { type: "base64", media_type: p.mediaType, data: p.data } });
  }
  const cats = categories.length ? categories.map((c) => `"${c}"`).join(", ") : '"Entrées", "Plats", "Desserts", "Apéro"';
  blocks.push({ type: "text", text: `Ces photos montrent une recette (page de livre, fiche manuscrite, magazine ou écran). Lis-la et extrais : titre, nombre de personnes, catégorie (parmi ${cats}) et la liste complète des ingrédients avec quantités. Si plusieurs photos se suivent, elles font partie de la même recette. Si une quantité est illisible, mets qty à null plutôt que d'inventer.` });
  const r = await ask(RecipeSchema, SYSTEM, blocks);
  return { title: r.title, servings: r.servings, category: r.category, ingredients: r.ingredients.filter((i) => i.name), method: "photo+claude" };
}

export async function extractWithClaude(pageText, url, categories = []) {
  const cats = categories.length ? categories.map((c) => `"${c}"`).join(", ") : '"Entrées", "Plats", "Desserts", "Apéro"';
  return ask(RecipeSchema, SYSTEM,
    `Voici le texte d'une page web (${url}) contenant une recette. Extrais la recette : titre, nombre de personnes, catégorie (parmi ${cats}) et ingrédients. ` +
    `Ignore les commentaires, publicités et recettes « similaires » : ne garde que la recette principale.\n\nTEXTE DE LA PAGE :\n"""\n${pageText}\n"""`);
}

// ---------- Pipeline ----------
export async function extractRecipe(url, { categories = [], useClaude = claudeAvailable() } = {}) {
  const { html, finalUrl } = await fetchHtml(url);
  const ld = findJsonLdRecipe(html);
  if (ld) {
    const base = recipeFromJsonLd(ld);
    let ingredients, method = "jsonld";
    if (useClaude && base.ingredientLines.length) {
      try { ingredients = await normalizeLinesWithClaude(base.ingredientLines, categories); method = "jsonld+claude"; }
      catch (e) { if (e.code === "api_auth") throw e; ingredients = null; }
    }
    if (!ingredients) ingredients = base.ingredientLines.map(parseIngredientLine).filter((i) => i && i.name);
    return { title: base.title || titleFromHtml(html), servings: base.servings, category: base.category, image: base.image, url: finalUrl, ingredients, method };
  }
  if (!useClaude) {
    throw new ExtractError("Ce site ne publie pas de données structurées et aucune clé API Claude n'est configurée : saisis la recette à la main.", "no_structured_data");
  }
  const pageText = htmlToText(html);
  if (pageText.length < 200) throw new ExtractError("La page semble vide (contenu chargé par script ?). Copie le texte de la recette à la main.", "empty_page");
  const r = await extractWithClaude(pageText, finalUrl, categories);
  return { title: r.title || titleFromHtml(html), servings: r.servings, category: r.category, image: "", url: finalUrl, ingredients: r.ingredients.filter((i) => i.name), method: "claude" };
}

/** Structure un texte collé par l'utilisateur (sans URL). */
export async function extractFromText(textInput, url = "", categories = []) {
  if (claudeAvailable()) {
    const r = await extractWithClaude(textInput.slice(0, MAX_TEXT), url || "texte collé", categories);
    return { ...r, image: "", url, method: "claude-text" };
  }
  const lines = textInput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const serv = textInput.match(/(\d+)\s*(personnes|pers\.?|parts|couverts)/i);
  return {
    title: lines[0]?.slice(0, 120) || "", servings: serv ? Number(serv[1]) : 4, category: "", image: "", url,
    ingredients: lines.slice(1).map(parseIngredientLine).filter((i) => i && i.name && (i.qty != null || i.name.length < 40)),
    method: "local-text",
  };
}
