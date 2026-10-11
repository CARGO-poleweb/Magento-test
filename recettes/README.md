# Le Garde-Manger

Application autonome pour deux : un carnet de recettes trouvées sur Internet, classées par
catégorie, et une liste de courses générée automatiquement selon le nombre de personnes,
modifiable et synchronisée en direct entre vos appareils.

## Ce qu'elle fait

- **Importer une recette depuis un lien.** Le serveur télécharge la page, lit les données
  structurées `schema.org/Recipe` que publient la plupart des sites (Marmiton, 750g, Cuisine AZ,
  blogs WordPress avec un plugin recette…), et en tire titre, nombre de personnes, photo et
  ingrédients. Si le site n'en publie pas, Claude lit le texte de la page et structure la recette.
  Avec une clé API, Claude normalise aussi les ingrédients (« 2 c. à s. d'huile » devient
  quantité 2, unité « c. à soupe », nom « huile »). Un texte collé ou une saisie à la main restent
  possibles.
- **Catégories libres** : créées en les écrivant dans une recette ou depuis les réglages, où on
  les renomme, les ordonne et les supprime.
- **Liste de courses** : on coche des recettes, on règle le nombre de personnes sur chacune, et la
  liste est générée avec les quantités recalculées et les doublons fusionnés (« farine » du gratin
  + « farine » de la tarte = une ligne). Chaque article se coche, se modifie ou se supprime ; on en
  ajoute à la main. Les articles manuels survivent à une régénération.
- **Synchronisation** : toute modification est poussée en direct aux autres appareils connectés
  (flux SSE), avec rafraîchissement au retour sur l'onglet.
- **Back-office** (onglet Réglages) : catégories, export/import JSON de sauvegarde, état du serveur
  (clé API, modèle, compteurs) et journal des cinquante derniers imports.

## Pile technique

- Node.js ≥ 22.13 (SQLite intégré via `node:sqlite`, aucune compilation native)
- Express 5, base SQLite dans un seul fichier (`data/garde-manger.db`)
- SDK Anthropic (`@anthropic-ai/sdk`) avec sorties structurées (zod) pour l'extraction
- Frontend sans framework : HTML, CSS et modules ES ; installable sur téléphone (manifest PWA)
- Authentification par mot de passe partagé et cookie signé (HMAC), 180 jours

## Démarrer en local

```bash
cd recettes
cp .env.example .env     # puis éditer APP_PASSWORD, SESSION_SECRET, ANTHROPIC_API_KEY
npm install
npm start                # http://localhost:3000
```

`npm run dev` relance le serveur à chaque modification. `npm test` lance les tests (parseur
d'ingrédients, extraction JSON-LD, API de bout en bout en mémoire).

### Variables d'environnement

| Variable | Rôle |
|---|---|
| `APP_PASSWORD` | Mot de passe partagé pour entrer (obligatoire) |
| `SESSION_SECRET` | Secret de signature du cookie de session (obligatoire, longue chaîne aléatoire) |
| `ANTHROPIC_API_KEY` | Active l'extraction par Claude. Sans clé : données structurées seulement |
| `CLAUDE_MODEL` | Modèle utilisé, `claude-opus-5-5` par défaut (`claude-sonnet-5-5` ou `claude-haiku-5-5` pour réduire le coût) |
| `CLAUDE_EFFORT` | Niveau de réflexion, `medium` par défaut (`low` suffit souvent pour l'extraction) |
| `PORT` | Port d'écoute, 3000 par défaut |
| `DB_PATH` | Chemin du fichier SQLite |

## Héberger

### Docker (recommandé)

```bash
cd recettes
cp .env.example .env && nano .env
docker compose up -d --build
```

La base vit dans `./data`, à sauvegarder. Placez un reverse proxy HTTPS devant (Caddy, Nginx,
Traefik) : le cookie de session est marqué `Secure` dès que la requête arrive en HTTPS, et le
serveur fait confiance à l'en-tête `X-Forwarded-Proto` du premier proxy.

Exemple Caddy, en deux lignes :

```
recettes.mondomaine.fr {
    reverse_proxy localhost:3000
}
```

### Sans Docker

Un VPS avec Node 22 et `pm2` ou un service systemd suffit :

```bash
npm ci --omit=dev
NODE_ENV=production node --disable-warning=ExperimentalWarning server/index.js
```

Les plateformes type Railway, Render ou Fly.io fonctionnent aussi : prévoir un volume persistant
pour `DB_PATH`.

## API

Toutes les routes sous `/api` exigent le cookie de session, sauf `login`, `logout` et `me`.

| Méthode | Route | Rôle |
|---|---|---|
| `POST` | `/api/login` `{password}` | Ouvre la session |
| `GET` | `/api/state` | Recettes, catégories, liste de courses, version |
| `GET` | `/api/events` | Flux SSE : `change` à chaque modification |
| `POST` | `/api/extract` `{url}` ou `{text}` | Extrait une recette sans l'enregistrer |
| `POST/PUT/DELETE` | `/api/recipes[/:id]` | Recettes |
| `POST/PUT/DELETE` | `/api/categories[/:id]`, `POST /api/categories/reorder` | Catégories |
| `POST` | `/api/shopping/generate` `{selection:[{recipeId, persons}], mode}` | Génère la liste (`replace` ou `append`) |
| `POST/PATCH/DELETE` | `/api/shopping/items[/:id]` | Articles de la liste |
| `POST` | `/api/shopping/clear` `{onlyChecked}` | Vide la liste |
| `GET` | `/api/admin/status`, `/api/admin/export` ; `POST /api/admin/import` | Back-office |

## Limites connues

- Un site qui bloque les robots (403, page vide chargée en JavaScript) ne peut pas être lu : coller
  le texte de la recette dans le formulaire, Claude le structure.
- Les unités ne sont pas converties entre elles (500 g + 0,5 kg donnent deux lignes).
- Un seul mot de passe pour la maison, pas de comptes séparés.
