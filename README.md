# 🏆 La Ligue des Copains

L'application de la ligue de pronostics **Ligue 1 2025-2026** — pronostics en saisie libre,
verrouillage automatique à H−30, barème officiel, bonus cachés scellés, cagnotte et Commission de
discipline. Fidèle au « Règlement & Bonus » (voir [PLAN.md](PLAN.md) pour le mapping article par
article).

**Stack** : Next.js (App Router) · Supabase (auth par lien magique, PostgreSQL, RLS) · Tailwind ·
PWA installable sur téléphone. Prévu pour ~20 membres, coût d'hébergement : 0 €.

## Ce que fait le MVP

- **Pronostics en saisie libre** comme sur WhatsApp (`TFC 3-0 OM`). Rien n'est corrigé ni bloqué :
  le texte brut horodaté fait foi. Fautes (« MONACU »), ambiguïtés (« PARIS »), mauvais format ou
  doublon (article 6) partent automatiquement en **Commission de discipline**, qui comptabilise ou
  non — le folklore est préservé.
- **Verrouillage automatique** de chaque match 30 minutes avant le coup d'envoi (article 6).
  Pronostics immuables : ni modification ni suppression, par personne (article 12).
- **Journées publiées par le Président** (article 10), type classique (5 matchs des équipes
  concernées) ou multiplex J1/J34 (9 matchs).
- **Barème automatique** : score exact 4 pts · bonne différence de buts 3 pts · bon vainqueur
  2 pts · tous les résultats +3 · tous les scores +10 · journée blanche −2.
- **Bonus cachés scellés** jusqu'à révélation par le Président (vainqueur, buteur, passeur,
  top 3, derniers 3, classement du TFC) — deadline 30/09/2025 23 h 59.
- **Cagnotte** : registre des mises de 20 € (15 € vainqueur / 5 € Ballon d'Or), échéance du
  30/09 (article 3), amendes ; les paiements réels se font par virement, hors app.
- **Classement général** avec sanctions de la Commission (−2 message modifié, −3 vidéo
  d'anniversaire séchée, etc.).
- **Rôles** : Président (a toujours raison), Premier Ministre, Président de la Commission,
  Secrétaire, Chargé de mission, membres. 20 membres maximum (article 4), radiation possible.
- **Multi-saisons** : la ligue se rejoue chaque année. Le Président prépare la saison suivante
  (2026-2027…) depuis son espace — composition de la Ligue 1 (promus/relégués, ajout de clubs au
  référentiel avec leurs alias), choix des 5 équipes concernées ★, mise et échéances — puis
  bascule la ligue dessus. Les saisons passées restent consultables en archive depuis le
  classement ; bonus cachés, cagnotte et sanctions sont cloisonnés par saison.

## Installation (une fois, ~20 minutes)

### 1. Créer le projet Supabase

1. Créez un compte sur [supabase.com](https://supabase.com) et un nouveau projet (région
   `eu-west-3` Paris, plan gratuit).
2. Dans **SQL Editor**, exécutez dans l'ordre :
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_seed.sql`
3. Dans **Authentication → URL Configuration** :
   - **Site URL** : l'adresse de votre déploiement (ex. `https://liguedescopains.vercel.app`) ;
   - **Redirect URLs** : ajoutez `https://liguedescopains.vercel.app/**` (la même adresse suivie
     de `/**`).

   Le gabarit d'e-mail par défaut de Supabase fonctionne tel quel — rien à modifier (l'édition
   des gabarits exige désormais un SMTP personnalisé ; possible plus tard pour franciser le
   message, pas nécessaire).

### 2. Déployer sur Vercel

1. Importez ce dépôt GitHub sur [vercel.com](https://vercel.com) (framework détecté : Next.js).
2. Ajoutez les variables d'environnement (valeurs dans Supabase → **Settings → API**) :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` *(secret serveur — jamais côté client)*
3. Déployez, puis reportez l'URL obtenue dans la Site URL de Supabase (étape 1.4).

### 3. Activer les notifications push (optionnel, recommandé)

1. Générez une paire de clés VAPID : `npx web-push generate-vapid-keys`.
2. Ajoutez dans Vercel : `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et
   `VAPID_SUBJECT` (un `mailto:` de contact). Sans ces clés, l'app fonctionne, juste sans
   notifications.
3. Chaque membre active ensuite ses notifications depuis l'onglet **⋯ Plus → 🔔 Notifications**
   (sur iPhone : installer d'abord l'app sur l'écran d'accueil). Deux réglages par membre :
   le jeu (journée publiée, points, Commission) et le Vestiaire (chaque message du chat).

### 4. Configurer la ligue

1. Chaque membre se connecte une première fois avec son e-mail (lien magique) — le profil se crée
   tout seul, dans la limite de 20 (article 4).
2. Attribuez les rôles dans Supabase (**SQL Editor**), par exemple :
   ```sql
   update profiles set role = 'president'            where display_name = 'greg';
   update profiles set role = 'premier_ministre'     where display_name = 'steve';
   update profiles set role = 'president_commission' where display_name = 'seb';
   update profiles set role = 'secretaire'           where display_name = 'alex';
   update profiles set role = 'charge_mission'       where display_name = 'jere';
   ```
   (le `display_name` par défaut est la partie de l'e-mail avant le `@` ; ajustez-le au passage :
   `update profiles set display_name = 'Greg R.' where display_name = 'greg';`)
3. Le Président crée la Journée 1 dans l'onglet 🎩, ajoute les matchs dans l'ordre de la
   programmation, puis **publie** — les copains peuvent parier.
4. Sur téléphone : ouvrez le site puis « Ajouter à l'écran d'accueil » — l'app s'installe comme
   une vraie application.

## Développement local

```bash
cp .env.example .env.local   # remplir avec les clés Supabase
npm install
npm run dev                  # http://localhost:3000
npm test                     # tests du parseur et du barème (vitest)
```

## Structure

```
supabase/migrations/   schéma SQL + seed (équipes L1 2025-26, saison, RLS)
src/lib/parser.ts      interprétation de la saisie libre (articles 6, 7, 8)
src/lib/scoring.ts     barème quotidien et classement général
src/app/actions.ts     toutes les écritures (server actions, vérifications de droits)
src/app/(app)/         écrans : classement, journées, bonus, cagnotte, admin, commission
```

## Hors périmètre du MVP (V1/V2 — voir PLAN.md)

Bonus individuel ×2 · Retour du Bâton · cartons jaunes/rouges automatisés · journée
d'anniversaire (vidéos + notes) · « Ensemble on est plus fort » · Combatif du mois · challenge ·
notifications push · récupération automatique des résultats.

**PLAISIR !!!**
