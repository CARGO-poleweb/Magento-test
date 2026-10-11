import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIngredientLine, mergeIngredients, fmtQty } from "../public/js/ingredients.js";

test("parse des lignes françaises courantes", () => {
  const cases = [
    ["200 g de farine", { name: "farine", qty: 200, unit: "g" }],
    ["1 kg pommes de terre", { name: "pommes de terre", qty: 1, unit: "kg" }],
    ["2 gousses d'ail", { name: "ail", qty: 2, unit: "gousse" }],
    ["sel", { name: "sel", qty: null, unit: "" }],
    ["3 œufs", { name: "œufs", qty: 3, unit: "" }],
    ["1/2 citron", { name: "citron", qty: 0.5, unit: "" }],
    ["1 1/2 tasse de lait", { name: "lait", qty: 1.5, unit: "tasse" }],
    ["2 c. à soupe d'huile d'olive", { name: "huile d'olive", qty: 2, unit: "c. à soupe" }],
    ["- 1 sachet de levure", { name: "levure", qty: 1, unit: "sachet" }],
    ["½ botte de persil", { name: "persil", qty: 0.5, unit: "botte" }],
    ["1 cs de miel", { name: "miel", qty: 1, unit: "c. à soupe" }],
    ["Farine : 250 g", { name: "Farine", qty: 250, unit: "g" }],
    ["200 g", { name: "", qty: 200, unit: "g" }],
    ["1,5 l d'eau", { name: "eau", qty: 1.5, unit: "l" }],
  ];
  for (const [line, want] of cases) assert.deepEqual(parseIngredientLine(line), want, line);
  assert.equal(parseIngredientLine("   "), null);
});

test("fmtQty arrondit lisiblement", () => {
  assert.equal(fmtQty(1.3333), "1,25");
  assert.equal(fmtQty(12.6), "13");
  assert.equal(fmtQty(null), "");
});

test("mergeIngredients met à l'échelle et fusionne", () => {
  const recipes = [
    { id: "a", title: "A", servings: 4, ingredients: [{ name: "farine", qty: 200, unit: "g" }, { name: "sel", qty: null, unit: "" }] },
    { id: "b", title: "B", servings: 2, ingredients: [{ name: "Farine", qty: 100, unit: "g" }, { name: "œufs", qty: 2, unit: "" }] },
  ];
  const items = mergeIngredients(recipes, { a: 8, b: 4 });
  const far = items.find((i) => i.name === "farine");
  assert.equal(far.qty, 600); // 200*2 + 100*2
  assert.deepEqual(far.recipes, ["A", "B"]);
  assert.equal(items.find((i) => i.name === "œufs").qty, 4);
  assert.equal(items.find((i) => i.name === "sel").qty, null);
  assert.equal(items.length, 3);
});
