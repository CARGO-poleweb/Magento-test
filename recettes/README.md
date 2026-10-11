# Le Garde-Manger

Application web autonome et installable (PWA) pour deux : un carnet de recettes trouvées sur
Internet ou photographiées, classées par catégorie, et une liste de courses générée
automatiquement selon le nombre de personnes, modifiable et synchronisée en direct entre vos
appareils.

## Ce qu'elle fait

- **Importer une recette depuis un lien.** Le serveur télécharge la page, lit les données
  structurées `schema.org/Recipe` que publient la plupart des sites (Marmiton, 750g, Cuisine AZ,
  blogs WordPress avec un plugin recette…), et en tire titre, nombre de personnes, photo et
  ingrédients. Si le site n'en publie pas, Claude lit le texte de la page et structure la recette.
  Avec une clé API, Claude normalise aussi les ingrédients (« 2 c. à s. d'huile » devient
  quantité 2, unité « c. à soupe », nom « huile »). Un texte collé ou une saisie à la main restent
  possibles.
- **Importer une recette depuis une photo.** Page de livre, fiche manuscrite, magazine ou écran :
  jusqu'à quatre photos par recette, redimensionnées dans le navigateur puis lues par Claude, qui
  en tire titre, personnes et ingrédients. La première photo devient l'illustration de la recette.
- **Catégories libres** : créées en les écrivant dans une recette ou depuis les réglages, où on
  les renomme, les ordonne et les supprime.
- **Liste de courses** : on coche des recettes, on règle le nombre de personnes sur chacune, et la
  liste est générée avec les quantités recalculées et les doublons fusionnés (« farine » du gratin
  + « farine » de la tarte = une ligne). Chaque article se coche, se modifie ou se supprime ; on en
  ajoute à la main. Les articles manuels survivent à une régénération.
- **Synchronisation** : toute modification est poussée en direct aux autres appareils connectés
  (flux SSE), avec rafraîchissement au retour sur l'onglet.
- **Application installable** : manifeste, icônes et service worker. Sur iPhone, Partager puis
  « Sur l'écran d'accueil » ; sur Android, « Installer l'application ». L'onglet Réglages > Installer
  affiche la marche à suivre adaptée à l'appareil et permet de copier l'adresse à envoyer.
- **Comptes nommés** : au premier démarrage, l'application propose de créer le compte
  administrateur. Celui-ci invite les autres (prénom + mot de passe provisoire) depuis
  Réglages > Comptes, peut réinitialiser un mot de passe ou supprimer un compte. Chacun change
  ensuite son propre mot de passe et peut déconnecter tous ses appareils d'un coup.
- **Back-office** (onglet Réglages) : catégories, installation, mon compte, comptes (admin),
  export/import JSON de sauvegarde, état du serveur (clé API, modèle, compteurs) et journal des
  cinquante derniers imports.

## Sécurité

- Mots de passe hachés avec scrypt (sel aléatoire, jamais stockés en clair), 8 caractères minimum.
- Sessions stockées en base (jeton aléatoire de 256 bits, seul son empreinte SHA-256 est
  conservée), cookie `HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS, expiration après 180 jours
  sans activité, révocables par l'utilisateur ou par l'administrateur.
- Six tentatives de connexion par quart d'heure et par adresse IP.
- Les photos importées sont servies uniquement aux personnes connectées.
- Le serveur refuse de télécharger des adresses privées (protection contre les requêtes vers le
  réseau local).
- **Mettez l'application derrière HTTPS** : c'est indispensable pour l'installation en PWA (le
  service worker ne s'enregistre qu'en HTTPS) et pour que le cookie reste confidentiel.

## Pile technique

- Node.js ≥ 22.13 (SQLite intégré via `node:sqlite`, aucune compilation native)
- Express 5, base SQLite dans un seul fichier (`data/garde-manger.db`)
- SDK Anthropic (`@anthropic-ai/sdk`) avec sorties structurées (zod) pour l'extraction
- Frontend sans framework : HTML, CSS et modules ES ; installable sur téléphone (manifest PWA)
- Comptes avec mots de passe scrypt, sessions en base, service worker pour l'installation

## Démarrer en local

```bash
cd recettes
cp .env.example .env     # puis renseigner ANTHROPIC_API_KEY
npm install
npm start                # http://localhost:3000 : créer le premier compte à l'écran
```

`npm run dev` relance le serveur à chaque modification. `npm test` lance les tests (parseur
d'ingrédients, extraction JSON-LD, API de bout en bout en mémoire).

### Variables d'environnement

| Variable | Rôle |
|---|---|
| `ANTHROPIC_API_KEY` | Active la lecture des photos et l'extraction par Claude. Sans clé : données structurées des sites seulement |
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

### Fly.io (environ 3 à 5 $ par mois)

Le fichier `fly.toml` et le script `deploy-fly.sh` sont fournis. Sur ton ordinateur :

```bash
# 1. installer flyctl : https://fly.io/docs/flyctl/install/
fly auth login
# 2. déployer (nom unique au choix, clé API facultative)
cd recettes
./deploy-fly.sh garde-manger-pierre sk-ant-...
```

Le script crée l'application à Paris, un disque persistant de 1 Go pour la base et les photos,
enregistre la clé API comme secret, puis déploie. L'adresse est `https://<nom>.fly.dev`, en
HTTPS d'office : l'installation sur l'écran d'accueil fonctionne directement. La machine
s'éteint quand personne n'utilise l'application et se rallume à la première requête (une à deux
secondes). Pour changer la clé plus tard : `fly secrets set ANTHROPIC_API_KEY=... -a <nom>`.

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
| `POST` | `/api/setup` `{name, password}` | Crée le premier compte (administrateur), une seule fois |
| `POST` | `/api/login` `{name, password}` | Ouvre la session |
| `POST` | `/api/account/password`, `/api/account/logout-all` | Mon compte |
| `GET` | `/api/state` | Recettes, catégories, liste de courses, version |
| `GET` | `/api/events` | Flux SSE : `change` à chaque modification |
| `POST` | `/api/extract` `{url}` ou `{text}` | Extrait une recette sans l'enregistrer |
| `POST` | `/api/extract/photo` `{photos:[{data, mediaType}]}` | Lit une recette sur des photos (base64) |
| `POST/PUT/DELETE` | `/api/recipes[/:id]` | Recettes |
| `POST/PUT/DELETE` | `/api/categories[/:id]`, `POST /api/categories/reorder` | Catégories |
| `POST` | `/api/shopping/generate` `{selection:[{recipeId, persons}], mode}` | Génère la liste (`replace` ou `append`) |
| `POST/PATCH/DELETE` | `/api/shopping/items[/:id]` | Articles de la liste |
| `POST` | `/api/shopping/clear` `{onlyChecked}` | Vide la liste |
| `GET` | `/api/admin/status`, `/api/admin/export` ; `POST /api/admin/import` | Back-office |
| `GET/POST/DELETE` | `/api/admin/users[/:id]`, `POST /api/admin/users/:id/password` | Comptes (administrateur) |

## Limites connues

- Un site qui bloque les robots (403, page vide chargée en JavaScript) ne peut pas être lu : coller
  le texte de la recette dans le formulaire, Claude le structure.
- Les unités ne sont pas converties entre elles (500 g + 0,5 kg donnent deux lignes).
- La lecture de photos exige une clé API : sans elle, l'option affiche un message et renvoie vers
  le texte collé ou la saisie manuelle.
- Les photos sont conservées dans `data/uploads` : à inclure dans les sauvegardes.
