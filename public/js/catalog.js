// Catalogue d'articles courants, par rayon, avec une icône par article.
// Les noms servent de clé de rapprochement avec la liste (comparaison insensible à la casse et aux accents).
export const CATALOG = [
  { name: "Fruits & légumes", items: [
    ["Carottes", "🥕"], ["Pommes de terre", "🥔"], ["Oignons", "🧅"], ["Ail", "🧄"], ["Tomates", "🍅"], ["Salade", "🥬"],
    ["Courgettes", "🥒"], ["Concombre", "🥒"], ["Poivrons", "🫑"], ["Aubergine", "🍆"], ["Brocoli", "🥦"], ["Champignons", "🍄"],
    ["Poireaux", "🥬"], ["Épinards", "🥬"], ["Avocat", "🥑"], ["Citron", "🍋"], ["Pommes", "🍎"], ["Bananes", "🍌"],
    ["Oranges", "🍊"], ["Fraises", "🍓"], ["Raisin", "🍇"], ["Poires", "🍐"], ["Pêches", "🍑"], ["Kiwis", "🥝"],
    ["Herbes fraîches", "🌿"], ["Gingembre", "🫚"],
  ]},
  { name: "Pain & pâtisserie", items: [
    ["Pain", "🥖"], ["Pain de mie", "🍞"], ["Croissants", "🥐"], ["Brioche", "🍞"], ["Biscottes", "🍞"], ["Gâteaux", "🍰"], ["Muffins", "🧁"],
  ]},
  { name: "Crèmerie & œufs", items: [
    ["Lait", "🥛"], ["Œufs", "🥚"], ["Beurre", "🧈"], ["Crème fraîche", "🥛"], ["Yaourts", "🥛"], ["Fromage râpé", "🧀"],
    ["Emmental", "🧀"], ["Camembert", "🧀"], ["Chèvre", "🧀"], ["Parmesan", "🧀"], ["Mozzarella", "🧀"], ["Fromage blanc", "🥛"],
  ]},
  { name: "Viande & poisson", items: [
    ["Poulet", "🍗"], ["Bœuf haché", "🥩"], ["Steaks", "🥩"], ["Lardons", "🥓"], ["Jambon blanc", "🍖"], ["Saucisses", "🌭"],
    ["Côtes de porc", "🥩"], ["Saumon", "🐟"], ["Cabillaud", "🐟"], ["Crevettes", "🦐"], ["Thon en boîte", "🥫"], ["Charcuterie", "🥓"],
  ]},
  { name: "Épicerie", items: [
    ["Pâtes", "🍝"], ["Riz", "🍚"], ["Farine", "🌾"], ["Sucre", "🍬"], ["Sel", "🧂"], ["Poivre", "🧂"], ["Huile d'olive", "🫒"],
    ["Vinaigre", "🍶"], ["Moutarde", "🟡"], ["Ketchup", "🍅"], ["Mayonnaise", "🥚"], ["Sauce tomate", "🥫"], ["Conserves", "🥫"],
    ["Lentilles", "🫘"], ["Pois chiches", "🫘"], ["Semoule", "🌾"], ["Bouillon cube", "🧊"], ["Épices", "🌶️"], ["Chocolat", "🍫"],
    ["Café", "☕"], ["Thé", "🍵"], ["Céréales", "🥣"], ["Confiture", "🍯"], ["Miel", "🍯"], ["Biscuits", "🍪"], ["Chips", "🥔"],
    ["Levure", "🧁"], ["Chapelure", "🍞"], ["Gnocchi", "🥟"], ["Pâte feuilletée", "🥐"], ["Pâte brisée", "🥧"],
  ]},
  { name: "Surgelés", items: [
    ["Légumes surgelés", "🧊"], ["Frites", "🍟"], ["Pizza", "🍕"], ["Glace", "🍨"], ["Poisson pané", "🐟"], ["Petits pois", "🫛"],
  ]},
  { name: "Boissons", items: [
    ["Eau", "💧"], ["Eau gazeuse", "🫧"], ["Jus d'orange", "🧃"], ["Soda", "🥤"], ["Bière", "🍺"], ["Vin rouge", "🍷"], ["Vin blanc", "🥂"], ["Sirop", "🧴"],
  ]},
  { name: "Maison & hygiène", items: [
    ["Papier toilette", "🧻"], ["Essuie-tout", "🧻"], ["Liquide vaisselle", "🧴"], ["Lessive", "🧺"], ["Éponges", "🧽"], ["Sacs poubelle", "🗑️"],
    ["Papier alu", "📜"], ["Film étirable", "📜"], ["Dentifrice", "🪥"], ["Savon", "🧼"], ["Shampoing", "🧴"], ["Mouchoirs", "🤧"],
    ["Piles", "🔋"], ["Ampoules", "💡"],
  ]},
];

const ALIASES = {
  "pomme de terre": "Pommes de terre", "pdt": "Pommes de terre", "oignon": "Oignons", "tomate": "Tomates", "carotte": "Carottes",
  "oeuf": "Œufs", "oeufs": "Œufs", "œuf": "Œufs", "creme": "Crème fraîche", "creme liquide": "Crème fraîche", "creme fraiche": "Crème fraîche",
  "gousse d'ail": "Ail", "gousses d'ail": "Ail", "citrons": "Citron", "pomme": "Pommes", "banane": "Bananes", "courgette": "Courgettes",
  "poivron": "Poivrons", "champignon": "Champignons", "huile": "Huile d'olive", "chocolat noir": "Chocolat", "yaourt": "Yaourts",
  "fromage": "Fromage râpé", "pates": "Pâtes", "spaghetti": "Pâtes", "boeuf hache": "Bœuf haché", "viande hachee": "Bœuf haché",
  "jambon": "Jambon blanc", "lardon": "Lardons", "beurre doux": "Beurre", "beurre demi-sel": "Beurre", "poulet entier": "Poulet",
  "blanc de poulet": "Poulet", "escalopes de poulet": "Poulet", "filet de saumon": "Saumon", "noix de muscade": "Épices", "cannelle": "Épices",
  "herbes de provence": "Épices", "persil": "Herbes fraîches", "basilic": "Herbes fraîches", "coriandre": "Herbes fraîches", "ciboulette": "Herbes fraîches",
  "sucre en poudre": "Sucre", "sucre roux": "Sucre", "farine de ble": "Farine", "levure chimique": "Levure", "levure boulangere": "Levure",
};

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const INDEX = new Map();
for (const sec of CATALOG) for (const [name, icon] of sec.items) INDEX.set(norm(name), { name, icon, section: sec.name });
for (const [alias, target] of Object.entries(ALIASES)) { const t = INDEX.get(norm(target)); if (t) INDEX.set(norm(alias), t); }

/** Icône pour un nom d'article (ou une icône neutre). */
export function iconFor(name) {
  const n = norm(name);
  const hit = INDEX.get(n) || INDEX.get(n.replace(/s$/, "")) || INDEX.get(n + "s");
  if (hit) return hit.icon;
  for (const [key, v] of INDEX) if (key.length > 3 && (n.startsWith(key + " ") || n.endsWith(" " + key) || n.includes(" " + key + " "))) return v.icon;
  return "🛒";
}
export function catalogEntry(name) { const n = norm(name); return INDEX.get(n) || INDEX.get(n.replace(/s$/, "")) || null; }
