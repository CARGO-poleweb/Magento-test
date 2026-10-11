import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findJsonLdRecipe, recipeFromJsonLd, htmlToText, titleFromHtml, parseYield, assertPublicUrl } from "../server/extract.js";

const gratin = readFileSync(new URL("./fixtures/gratin.html", import.meta.url), "utf8");
const blog = readFileSync(new URL("./fixtures/blog.html", import.meta.url), "utf8");

test("JSON-LD : recette trouvée dans un @graph et normalisée", () => {
  const ld = findJsonLdRecipe(gratin);
  assert.ok(ld);
  const r = recipeFromJsonLd(ld);
  assert.equal(r.title, "Gratin dauphinois facile");
  assert.equal(r.servings, 6);
  assert.equal(r.category, "Plat principal");
  assert.equal(r.image, "https://img.example.com/gratin.jpg");
  assert.equal(r.ingredientLines[1], "50 cl de crème liquide entière");
  assert.equal(r.ingredientLines.length, 8);
});

test("JSON-LD absent sur un blog : texte + titre de secours", () => {
  assert.equal(findJsonLdRecipe(blog), null);
  const t = htmlToText(blog);
  assert.ok(t.includes("80 g de sucre"));
  assert.ok(!t.includes("Accueil Recettes Contact"), "la navigation hors <article> est ignorée");
  assert.equal(titleFromHtml(blog), "Ma tarte aux pommes");
});

test("parseYield lit les formes courantes", () => {
  assert.equal(parseYield("4 personnes"), 4);
  assert.equal(parseYield(["6", "6 servings"]), 6);
  assert.equal(parseYield(8), 8);
  assert.equal(parseYield(undefined), null);
});

test("URL privées refusées", async () => {
  await assert.rejects(assertPublicUrl("http://127.0.0.1/x"), /non autorisée/);
  await assert.rejects(assertPublicUrl("http://localhost:3000"), /non autorisée/);
  await assert.rejects(assertPublicUrl("ftp://example.com"), /http/);
  await assert.rejects(assertPublicUrl("pas une url"), /valide/);
});
