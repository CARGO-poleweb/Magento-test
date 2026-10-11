import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDb } from "../server/db.js";
import { makeAuth } from "../server/auth.js";
import { createApp } from "../server/app.js";
import { findJsonLdRecipe, recipeFromJsonLd } from "../server/extract.js";
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
};

const call = async (path, { method = "GET", body, auth = true } = {}) => {
  const res = await fetch(base + path, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...(auth && cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
};

before(async () => {
  const store = openDb(":memory:");
  const auth = makeAuth({ password: "secret", secret: "s3" });
  const app = createApp({ store, auth, extract });
  await new Promise((r) => { server = app.listen(0, r); });
  base = "http://127.0.0.1:" + server.address().port;
});
after(() => server.close());

test("auth : refus sans cookie, connexion, puis accès", async () => {
  assert.equal((await call("/api/state")).status, 401);
  assert.equal((await call("/api/login", { method: "POST", body: { password: "nope" } })).status, 401);
  const ok = await call("/api/login", { method: "POST", body: { password: "secret" } });
  assert.equal(ok.status, 200);
  cookie = ok.headers.get("set-cookie").split(";")[0];
  assert.equal((await call("/api/state")).status, 200);
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
  assert.deepEqual(st.categories.map((c) => c.name), ["Plat principal"]);
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
  await call("/api/shopping/generate", { method: "POST", body: { selection: [{ recipeId: id, persons: 6 }] } });
  const items = (await call("/api/state")).data.items;
  assert.ok(items.some((i) => i.name === "papier alu" && i.checked));
  assert.ok(!items.some((i) => i.name === "œufs"), "les anciens articles de recette ont été remplacés");
  await call("/api/shopping/clear", { method: "POST", body: { onlyChecked: true } });
  assert.ok(!(await call("/api/state")).data.items.some((i) => i.name === "papier alu"));
});

test("catégories : renommage propagé, suppression", async () => {
  const cat = (await call("/api/state")).data.categories[0];
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
  const app2 = createApp({ store: store2, auth: makeAuth({ password: "secret", secret: "s3" }), extract });
  const srv2 = app2.listen(0); const b2 = "http://127.0.0.1:" + srv2.address().port;
  const res = await fetch(b2 + "/api/admin/import", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(exp) });
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
