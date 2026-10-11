import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractRecipe, extractFromText, claudeAvailable, ExtractError } from "./extract.js";
import { mergeIngredients, parseIngredientLine } from "../public/js/ingredients.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

export function createApp({ store, auth, extract = { extractRecipe, extractFromText } }) {
const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(express.static(join(root, "public"), { index: "index.html", maxAge: "1h", etag: true }));

// ---------- temps réel (SSE) ----------
const clients = new Set();
function broadcast() {
  const v = store.bump();
  const msg = `event: change\ndata: ${JSON.stringify({ version: v })}\n\n`;
  for (const res of clients) res.write(msg);
}
setInterval(() => { for (const res of clients) res.write(": ping\n\n"); }, 25_000).unref();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

// ---------- auth ----------
app.post("/api/login", (req, res) => {
  if (!auth.checkPassword(req.body?.password)) return bad(res, "Mot de passe incorrect.", 401);
  auth.setCookie(res, req.secure);
  res.json({ ok: true });
});
app.post("/api/logout", (req, res) => { auth.clearCookie(res); res.json({ ok: true }); });
app.get("/api/me", (req, res) => res.json({ authed: auth.isAuthed(req), claude: claudeAvailable() }));

app.use("/api", auth.middleware);

// ---------- lecture ----------
app.get("/api/state", (req, res) => res.json(store.snapshot()));
app.get("/api/events", (req, res) => {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive", "x-accel-buffering": "no" });
  res.write(`event: hello\ndata: ${JSON.stringify({ version: store.version() })}\n\n`);
  clients.add(res);
  req.on("close", () => clients.delete(res));
});

// ---------- extraction ----------
app.post("/api/extract", wrap(async (req, res) => {
  const url = String(req.body?.url || "").trim();
  const text = String(req.body?.text || "").trim();
  const categories = store.listCategories().map((c) => c.name);
  try {
    const r = text ? await extract.extractFromText(text, url, categories) : await extract.extractRecipe(url, { categories });
    store.logImport(url || "(texte collé)", r.method, true, `${r.ingredients.length} ingrédients`);
    res.json(r);
  } catch (e) {
    if (e instanceof ExtractError) { store.logImport(url || "(texte collé)", "-", false, e.message); return res.status(422).json({ error: e.message, code: e.code }); }
    throw e;
  }
}));

// ---------- recettes ----------
const cleanIngredients = (list) => (Array.isArray(list) ? list : []).map((i) =>
  typeof i === "string" ? parseIngredientLine(i) : { name: String(i?.name || "").trim(), qty: i?.qty == null || i.qty === "" ? null : Number(i.qty), unit: String(i?.unit || "").trim() })
  .filter((i) => i && i.name).map((i) => ({ ...i, qty: Number.isFinite(i.qty) ? i.qty : null }));

function recipeBody(b, id) {
  const title = String(b?.title || "").trim();
  if (!title) throw Object.assign(new Error("Le titre est obligatoire."), { status: 400 });
  return { id, title, url: String(b.url || "").trim(), image: String(b.image || "").trim(), category: String(b.category || "").trim(),
    servings: Math.max(1, Number(b.servings) | 0 || 4), ingredients: cleanIngredients(b.ingredients), notes: String(b.notes || "") };
}
app.post("/api/recipes", (req, res) => { const r = store.saveRecipe(recipeBody(req.body)); broadcast(); res.status(201).json(r); });
app.put("/api/recipes/:id", (req, res) => {
  if (!store.getRecipe(req.params.id)) return bad(res, "Recette introuvable.", 404);
  const r = store.saveRecipe(recipeBody(req.body, req.params.id)); broadcast(); res.json(r);
});
app.delete("/api/recipes/:id", (req, res) => { if (!store.deleteRecipe(req.params.id)) return bad(res, "Recette introuvable.", 404); broadcast(); res.json({ ok: true }); });

// ---------- catégories ----------
app.post("/api/categories", (req, res) => { const c = store.ensureCategory(req.body?.name); if (!c) return bad(res, "Nom vide."); broadcast(); res.status(201).json(c); });
app.put("/api/categories/:id", (req, res) => { const c = store.renameCategory(req.params.id, req.body?.name); if (!c) return bad(res, "Catégorie introuvable.", 404); broadcast(); res.json(c); });
app.delete("/api/categories/:id", (req, res) => { if (!store.deleteCategory(req.params.id)) return bad(res, "Catégorie introuvable.", 404); broadcast(); res.json({ ok: true }); });
app.post("/api/categories/reorder", (req, res) => { store.reorderCategories(Array.isArray(req.body?.ids) ? req.body.ids : []); broadcast(); res.json({ ok: true }); });

// ---------- courses ----------
app.post("/api/shopping/generate", (req, res) => {
  const sel = Array.isArray(req.body?.selection) ? req.body.selection : [];
  const selection = Object.fromEntries(sel.map((s) => [String(s.recipeId), Math.max(1, Number(s.persons) | 0 || 1)]));
  const recipes = store.listRecipes().filter((r) => selection[r.id]);
  if (!recipes.length) return bad(res, "Aucune recette sélectionnée.");
  const items = mergeIngredients(recipes, selection);
  const sources = recipes.map((r) => ({ id: r.id, title: r.title, persons: selection[r.id] }));
  if (req.body?.mode === "append") {
    store.transaction(() => { for (const it of items) store.addItem({ ...it, src: "recipe" }); });
    const meta = store.getKv("shopping_meta", { sources: [] });
    store.setKv("shopping_meta", { sources: [...(meta.sources || []), ...sources], generatedAt: Date.now() });
  } else {
    store.replaceRecipeItems(items, sources);
  }
  broadcast();
  res.json({ ok: true, count: items.length });
});
app.post("/api/shopping/items", (req, res) => {
  const p = typeof req.body?.line === "string" ? parseIngredientLine(req.body.line) : { name: req.body?.name, qty: req.body?.qty ?? null, unit: req.body?.unit || "" };
  if (!p || !String(p.name || "").trim()) return bad(res, "Article vide.");
  const it = store.addItem({ ...p, src: "manual" }); broadcast(); res.status(201).json(it);
});
app.patch("/api/shopping/items/:id", (req, res) => {
  const patch = {};
  if (typeof req.body?.checked === "boolean") patch.checked = req.body.checked;
  if (typeof req.body?.name === "string" && req.body.name.trim()) patch.name = req.body.name.trim();
  if ("qty" in (req.body || {})) patch.qty = req.body.qty == null || req.body.qty === "" ? null : Number(req.body.qty);
  if (typeof req.body?.unit === "string") patch.unit = req.body.unit.trim();
  if (typeof req.body?.qtyText === "string") { const p = parseIngredientLine(req.body.qtyText) || { qty: null, unit: "", name: "" }; patch.qty = p.qty; patch.unit = p.unit || p.name || ""; }
  const it = store.updateItem(req.params.id, patch); if (!it) return bad(res, "Article introuvable.", 404);
  broadcast(); res.json(it);
});
app.delete("/api/shopping/items/:id", (req, res) => { if (!store.deleteItem(req.params.id)) return bad(res, "Article introuvable.", 404); broadcast(); res.json({ ok: true }); });
app.post("/api/shopping/clear", (req, res) => {
  if (req.body?.onlyChecked) store.deleteItemsWhere("WHERE checked = 1");
  else { store.deleteItemsWhere(""); store.setKv("shopping_meta", { sources: [], generatedAt: Date.now() }); }
  broadcast(); res.json({ ok: true });
});

// ---------- back-office ----------
app.get("/api/admin/status", (req, res) => res.json({
  claude: claudeAvailable(), model: process.env.CLAUDE_MODEL || "claude-opus-5-5", effort: process.env.CLAUDE_EFFORT || "medium",
  node: process.version, dbPath: process.env.DB_PATH || "data/garde-manger.db", uptime: Math.round(process.uptime()),
  counts: { recipes: store.listRecipes().length, categories: store.listCategories().length, items: store.listItems().length },
  imports: store.listImports(),
}));
app.get("/api/admin/export", (req, res) => {
  res.setHeader("content-disposition", `attachment; filename="garde-manger-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(store.exportAll());
});
app.post("/api/admin/import", (req, res) => {
  const d = req.body;
  if (!d || !Array.isArray(d.recipes)) return bad(res, "Fichier invalide : il manque la liste « recipes ».");
  store.importAll({ categories: d.categories, recipes: d.recipes.map((r) => recipeBody(r, typeof r.id === "string" ? r.id : undefined)) });
  broadcast(); res.json({ ok: true, imported: d.recipes.length });
});

// ---------- SPA + erreurs ----------
app.get("/{*any}", (req, res) => res.sendFile(join(root, "public", "index.html")));
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.type === "entity.parse.failed") return bad(res, "JSON invalide.");
  console.error(err);
  res.status(500).json({ error: "Erreur interne du serveur." });
});

  return app;
}
