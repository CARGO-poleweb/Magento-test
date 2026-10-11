import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../server/db.js";
import { makeAuth, hashPassword, verifyPassword, passwordProblem } from "../server/auth.js";
import { createApp } from "../server/app.js";
import { findJsonLdRecipe, recipeFromJsonLd, ExtractError } from "../server/extract.js";
import { parseIngredientLine } from "../public/js/ingredients.js";

let server, base, cookie;
const gratin = readFileSync(new URL("./fixtures/gratin.html", import.meta.url), "utf8");

// Extraction simulée : même pipeline JSON-LD mais sans réseau.
const extract = {
  async extractRecipe(url) {
    const r = recipeFromJsonLd(findJsonLdRecipe(gratin));
    return { ...r, url, ingredients: r.ingredientLines.map(parseIngredientLine), method: "jsonld" };
  },
  async extractFromText(text, url) { return { title: "Texte", servings: 2, category: "", image: "", url, ingredients: [parseIngredientLine("3 œufs")], method: "local-text" }; },
  async extractFromPhotos(photos) {
    if (!photos.length) throw new ExtractError("Aucune photo reçue.", "bad_photo");
    return { title: "Tarte de Mamie", servings: 8, category: "Desserts", ingredients: [parseIngredientLine("5 pommes"), parseIngredientLine("80 g de sucre")], method: "photo+claude" };
  },
};
const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const call = async (path, { method = "GET", body, auth = true } = {}) => {
  const res = await fetch(base + path, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...(auth && cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
};

const uploadsDir = mkdtempSync(join(tmpdir(), "gm-uploads-"));
before(async () => {
  const store = openDb(":memory:");
  const auth = makeAuth(store);
  const app = createApp({ store, auth, extract, uploadsDir });
  await new Promise((r) => { server = app.listen(0, r); });
  base = "http://127.0.0.1:" + server.address().port;
});
after(() => server.close());

test("mots de passe : hachage scrypt et règles", () => {
  const h = hashPassword("motdepasse1");
  assert.ok(h.startsWith("scrypt$"));
  assert.ok(verifyPassword("motdepasse1", h)); assert.ok(!verifyPassword("autre", h));
  assert.ok(passwordProblem("court")); assert.equal(passwordProblem("assez-long"), null);
});

test("auth : premier démarrage, création du compte admin, connexion", async () => {
  assert.equal((await call("/api/state")).status, 401);
  assert.equal((await call("/api/me")).data.needsSetup, true);
  assert.equal((await call("/api/login", { method: "POST", body: { name: "Pierre", password: "x" } })).status, 401);
  const bad = await call("/api/setup", { method: "POST", body: { name: "Pierre", password: "court" } });
  assert.equal(bad.status, 400);
  const ok = await call("/api/setup", { method: "POST", body: { name: "Pierre", password: "motdepasse1" } });
  assert.equal(ok.status, 201); assert.equal(ok.data.user.role, "admin");
  assert.equal((await call("/api/setup", { method: "POST", body: { name: "X", password: "motdepasse1" } })).status, 409, "setup impossible une fois un compte créé");
  cookie = ok.headers.get("set-cookie").split(";")[0];
  const me = await call("/api/me"); assert.equal(me.data.user.name, "Pierre");
  // reconnexion classique, insensible à la casse du prénom
  const login = await call("/api/login", { method: "POST", body: { name: "pierre", password: "motdepasse1" }, auth: false });
  assert.equal(login.status, 200);
  assert.equal((await call("/api/login", { method: "POST", body: { name: "Pierre", password: "faux" }, auth: false })).status, 401);
});

test("comptes : l'admin invite Elise, Elise n'est pas admin, changement de mot de passe", async () => {
  const dup = await call("/api/admin/users", { method: "POST", body: { name: "pierre", password: "motdepasse2" } });
  assert.equal(dup.status, 409);
  const u = await call("/api/admin/users", { method: "POST", body: { name: "Elise", password: "provisoire1" } });
  assert.equal(u.status, 201); assert.equal(u.data.role, "member");
  const el = await call("/api/login", { method: "POST", body: { name: "Elise", password: "provisoire1" }, auth: false });
  const eliseCookie = el.headers.get("set-cookie").split(";")[0];
  const asElise = (path, opts = {}) => fetch(base + path, { method: opts.method || "GET", headers: { "content-type": "application/json", cookie: eliseCookie }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  assert.equal((await asElise("/api/admin/users")).status, 403);
  assert.equal((await asElise("/api/state")).status, 200);
  assert.equal((await asElise("/api/account/password", { method: "POST", body: { current: "faux", next: "nouveau-mdp1" } })).status, 401);
  assert.equal((await asElise("/api/account/password", { method: "POST", body: { current: "provisoire1", next: "nouveau-mdp1" } })).status, 200);
  assert.equal((await call("/api/login", { method: "POST", body: { name: "Elise", password: "nouveau-mdp1" }, auth: false })).status, 200);
  // l'admin réinitialise : les sessions d'Elise tombent
  const id = u.data.id;
  await call(`/api/admin/users/${id}/password`, { method: "POST", body: { password: "encore-un-autre1" } });
  assert.equal((await asElise("/api/state")).status, 401);
  assert.equal((await call("/api/admin/users/" + (await call("/api/me")).data.user.id, { method: "DELETE" })).status, 400, "pas d'auto-suppression");
});

test("auth : limitation des tentatives", async () => {
  let last;
  for (let i = 0; i < 7; i++) last = await call("/api/login", { method: "POST", body: { name: "Pierre", password: "faux" + i }, auth: false });
  assert.equal(last.status, 429);
});

test("photo : extraction, image stockée et servie derrière l'authentification", async () => {
  const empty = await call("/api/extract/photo", { method: "POST", body: { photos: [] } });
  assert.equal(empty.status, 422);
  const r = await call("/api/extract/photo", { method: "POST", body: { photos: [{ data: PNG_1PX, mediaType: "image/png" }] } });
  assert.equal(r.status, 200);
  assert.equal(r.data.title, "Tarte de Mamie");
  assert.match(r.data.image, /^\/uploads\/[\w.-]+\.png$/);
  assert.ok(existsSync(join(uploadsDir, r.data.image.slice(9))));
  assert.equal((await fetch(base + r.data.image)).status, 401, "sans cookie");
  assert.equal((await fetch(base + r.data.image, { headers: { cookie } })).status, 200);
  const saved = await call("/api/recipes", { method: "POST", body: r.data });
  assert.equal(saved.data.image, r.data.image);
  await call("/api/recipes/" + saved.data.id, { method: "DELETE" });
  assert.ok(!existsSync(join(uploadsDir, r.data.image.slice(9))), "fichier supprimé avec la recette");
});

test("extraction + enregistrement + catégorie auto", async () => {
  const ex = await call("/api/extract", { method: "POST", body: { url: "https://example.com/gratin" } });
  assert.equal(ex.status, 200);
  assert.equal(ex.data.title, "Gratin dauphinois facile");
  assert.equal(ex.data.ingredients[0].name, "pommes de terre");
  const saved = await call("/api/recipes", { method: "POST", body: ex.data });
  assert.equal(saved.status, 201);
  const st = (await call("/api/state")).data;
  assert.equal(st.recipes.length, 1);
  assert.ok(st.categories.some((c) => c.name === "Plat principal"), "catégorie créée automatiquement");
});

test("génération de la liste de courses à l'échelle", async () => {
  const id = (await call("/api/state")).data.recipes.find((r) => r.title.startsWith("Gratin")).id;
  const second = await call("/api/recipes", { method: "POST", body: { title: "Omelette", servings: 2, ingredients: ["4 œufs", "20 g de beurre", "sel"] } });
  const gen = await call("/api/shopping/generate", { method: "POST", body: { selection: [{ recipeId: id, persons: 12 }, { recipeId: second.data.id, persons: 4 }] } });
  assert.equal(gen.status, 200);
  const items = (await call("/api/state")).data.items;
  const pdt = items.find((i) => i.name === "pommes de terre");
  assert.equal(pdt.qty, 2); // 1 kg pour 6 -> 2 kg pour 12
  const beurre = items.find((i) => i.name === "beurre");
  assert.equal(beurre.qty, 100); // 30g*2 + 20g*2
  assert.deepEqual(beurre.recipes.sort(), ["Gratin dauphinois facile", "Omelette"]);
  assert.equal(items.filter((i) => i.name === "sel").length, 1);
});

test("articles : ajout manuel, coche, modification de quantité, régénération conserve le manuel", async () => {
  const add = await call("/api/shopping/items", { method: "POST", body: { line: "papier alu" } });
  assert.equal(add.status, 201);
  const upd = await call("/api/shopping/items/" + add.data.id, { method: "PATCH", body: { checked: true, qtyText: "2 rouleaux" } });
  assert.equal(upd.data.checked, true); assert.equal(upd.data.qty, 2); assert.equal(upd.data.unit, "rouleau");
  const id = (await call("/api/state")).data.recipes.find((r) => r.title.startsWith("Gratin")).id;
  const before = (await call("/api/state")).data.items.find((i) => i.name === "beurre").qty; // 100
  await call("/api/shopping/generate", { method: "POST", body: { selection: [{ recipeId: id, persons: 6 }] } }); // ajout par défaut
  let items = (await call("/api/state")).data.items;
  assert.equal(items.find((i) => i.name === "beurre").qty, before + 30, "ajout : les quantités s'additionnent");
  assert.equal(items.filter((i) => i.name === "beurre").length, 1, "pas de doublon");
  assert.ok(items.some((i) => i.name === "œufs"), "les anciens articles restent");
  await call("/api/shopping/generate", { method: "POST", body: { selection: [{ recipeId: id, persons: 6 }], mode: "replace" } });
  items = (await call("/api/state")).data.items;
  assert.ok(items.some((i) => i.name === "papier alu" && i.checked));
  assert.ok(!items.some((i) => i.name === "œufs"), "remplacement explicite : les anciens articles de recette partent");
  await call("/api/shopping/clear", { method: "POST", body: { onlyChecked: true } });
  assert.ok(!(await call("/api/state")).data.items.some((i) => i.name === "papier alu"));
});

test("catégories : renommage propagé, suppression", async () => {
  const cat = (await call("/api/state")).data.categories.find((c) => c.name === "Plat principal");
  await call("/api/categories/" + cat.id, { method: "PUT", body: { name: "Plats" } });
  let st = (await call("/api/state")).data;
  assert.equal(st.recipes.find((r) => r.title.startsWith("Gratin")).category, "Plats");
  await call("/api/categories/" + cat.id, { method: "DELETE" });
  st = (await call("/api/state")).data;
  assert.equal(st.recipes.find((r) => r.title.startsWith("Gratin")).category, "");
});

test("export / import", async () => {
  const exp = (await call("/api/admin/export")).data;
  assert.equal(exp.recipes.length, 2);
  const store2 = openDb(":memory:");
  const app2 = createApp({ store: store2, auth: makeAuth(store2), extract, uploadsDir });
  const srv2 = app2.listen(0); const b2 = "http://127.0.0.1:" + srv2.address().port;
  const su = await fetch(b2 + "/api/setup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Pierre", password: "motdepasse1" }) });
  const c2 = su.headers.get("set-cookie").split(";")[0];
  const res = await fetch(b2 + "/api/admin/import", { method: "POST", headers: { "content-type": "application/json", cookie: c2 }, body: JSON.stringify(exp) });
  assert.equal(res.status, 200);
  assert.equal(store2.listRecipes().length, 2);
  srv2.close();
});

test("SSE : un changement émet un événement", async () => {
  const ctl = new AbortController();
  const res = await fetch(base + "/api/events", { headers: { cookie }, signal: ctl.signal });
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let buf = dec.decode((await reader.read()).value);
  assert.ok(buf.includes("event: hello"));
  await call("/api/categories", { method: "POST", body: { name: "Desserts" } });
  buf += dec.decode((await reader.read()).value);
  assert.ok(buf.includes("event: change"));
  ctl.abort();
});
