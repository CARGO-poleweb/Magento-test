# La Ligue des Copains — Plan de création de l'application

**Saison cible : Ligue 1 2025-2026 · ~20 membres · basé sur le « Règlement & Bonus » officiel (PDF, 3 pages)**

L'application remplace (ou complète) le groupe WhatsApp comme **support officiel unique** des
pronostics et des bonus (article 11), en automatisant tout ce qui génère aujourd'hui des litiges :
format des pronostics, verrouillage horaire, messages modifiés/supprimés, calcul des points,
et suivi des cartons.

---

## 1. Ce que dit le règlement → ce que fait l'app

### 1.1 La ligue (articles 1 à 5)

| Règle | Fonctionnalité |
|---|---|
| Art. 1 — Le Président a toujours raison | Rôle **Président** avec pouvoir d'override sur toute décision (validation manuelle, correction de points) — tracé dans un journal d'audit visible de tous |
| Art. 2 — Mise de 20 € (15 € cagnotte vainqueur, 5 € Ballon d'Or) | **Registre de trésorerie** : statut de paiement par membre, ventilation automatique 15 €/5 €, total cagnotte affiché |
| Art. 3 — Virement avant le 30/09/2025, sinon radiation | Rappels automatiques, badge « non payé », bouton **radiation** pour le Président |
| Art. 4 — 20 membres maximum | Limite d'inscription en dur, liste d'attente optionnelle |
| Art. 5 — Bonus cachés du Président envoyés au Premier Ministre (au Président de la Commission si Retour du Bâton les oppose) | Le circuit de dépôt des bonus cachés route automatiquement selon le rôle du déposant |

### 1.2 Les pronostics (articles 6 à 13)

| Règle | Fonctionnalité |
|---|---|
| Art. 6 — Pari 30 min avant le match, premier pari accepté, doublon = carton jaune | **Verrouillage automatique à H-30** par match ; un doublon est accepté mais **signalé à la Commission** (premier pari retenu, carton jaune applicable) |
| Art. 7 — Pronostic mal orthographié ou ambigu non comptabilisé (« Monacu », « Paris ») | **Saisie libre assumée** : on tape son pronostic tel quel, sans correction ni suggestion. L'app l'interprète en coulisse ; si c'est fautif ou ambigu, elle n'empêche rien — elle **ouvre un signalement pour la Commission**, qui tranche comme aujourd'hui |
| Art. 8 — Format strict `TFC 3-0 OM` ou `TFC 3/0 OM` | Le texte brut horodaté fait foi ; un format non conforme est accepté mais marqué « non comptabilisable » en attente de décision de la Commission |
| Art. 9 — Parier en une fois ou match par match | Bulletin de journée enregistrable partiellement, chaque match se verrouille indépendamment |
| Art. 10 — Jouer dans l'ordre de la programmation, pas avant diffusion par le Président | La journée n'est **pronosticable qu'après publication** par le Président ; l'ordre est imposé par l'interface |
| Art. 11 — Un seul support officiel | L'app devient ce support ; WhatsApp reste pour la déconne |
| Art. 12 — Message modifié/supprimé : 0 pt sur la journée + −2 pts au général | Les pronostics sont **immuables après verrouillage** ; avant verrouillage, chaque modification est historisée (qui, quand, quoi) — la Commission garde la main pour sanctionner |
| Art. 13 — Pas de carton rouge lors de la dernière journée (multiplex) | Règle codée dans le moteur de discipline |

### 1.3 Le barème quotidien

Moteur de calcul automatique dès saisie des résultats :

- Victoire de l'équipe : **2 pts**
- Victoire ou nul avec bonne différence de buts : **3 pts**
- Bon résultat exact du match : **4 pts**
- Tous les résultats de la journée corrects (V/N/D) : **+3 pts**
- Tous les bons scores de la journée : **+10 pts**
- Aucun point marqué sur la journée : **−2 pts**

Équipes suivies : **TFC, PSG, OM, Rennes** (tirée au sort par le Président), **Monaco** (choisie par
le vainqueur sortant) → 5 matchs par journée classique, 9 matchs les journées multiplex (J1 & J34).

### 1.4 Les bonus cachés (dépôt avant le 30/09/2025, 23 h 59)

Dépôt **scellé** dans l'app : personne (sauf le circuit prévu à l'art. 5) ne voit les choix avant la
révélation. Horodatage faisant foi.

- Vainqueur Ligue 1 : 15 pts · Meilleur buteur : 20 pts · Meilleur passeur : 25 pts
- Les 3 premiers / les 3 derniers : 25 pts dans l'ordre, 15 pts dans le désordre
- Classement du TFC à l'issue de la 34ᵉ journée : 10 pts

### 1.5 Les bonus exceptionnels

| Bonus | Fonctionnalité |
|---|---|
| **Multiplex J1 & J34** (9 matchs, aucun bonus utilisable) | Type de journée dédié ; le moteur bloque tout bonus ces jours-là (et l'art. 18 devient inapplicable par construction) |
| **Bonus individuel** ×2 (1 aller, 1 retour) — annoncer avant la journée, points doublés | Bouton « Jouer mon BONUS » actif jusqu'au coup d'envoi du 1ᵉʳ match ; compteur aller/retour ; doublement automatique |
| **Le Retour du Bâton** — je marque mes points + ceux de mon binôme, 1×/saison, interdit J1/J34 et journée « Ensemble », interdit si l'adversaire a joué son bonus ; si les 2 binômes le jouent le même jour, **le premier à l'avoir posé gagne** | Gestion des **binômes**, toutes les contraintes codées, conflit tranché à l'horodatage près — fini les débats |
| **Le Challenge** (thème choisi par le Bureau, −3 pts si non-participation, art. 23) | Module challenge : annonce, dépôt des participations, attribution de points par le Bureau |
| **Journée d'anniversaire** (10 pts) — vidéo sur le thème du Bureau, date tirée au sort, notée par tous : idée /6 + réalisation /4 ; −3 pts si pas de vidéo (art. 21), −3 pts si on ne vote pas sous 48 h (art. 22) | **Upload vidéo** dans l'app, fenêtre de notation de 48 h avec rappels push, moyenne calculée automatiquement, pénalités automatiques |
| **Ensemble on est plus fort** (10 pts/membre de l'équipe gagnante) — tirage des leaders et des équipes A/B, un bulletin unique (3 à 5 matchs), échangé scellé au moins la veille | **Tirage au sort intégré**, bulletin d'équipe co-construit dans l'app, « enveloppe fermée » numérique : chaque équipe voit le bulletin adverse seulement après dépôt des deux |
| **Le Combatif du mois** (+3 pts/mois) — Alain L. propose 3 noms → Steve valide → le Bureau arbitre → sondage du groupe | Workflow de nomination + **sondage intégré** avec dépouillement automatique |

### 1.6 Discipline (articles 14 à 24)

- Carton jaune = avertissement · 2 CJ = 1 CR · CR = interdiction de pronostiquer la journée suivante (blocage automatique de l'interface) · pas de CR à la J34.
- « Tu contestes ? = carton jaune » (art. 16) → bouton **« Je conteste »** dans l'app qui inflige
  automatiquement le carton jaune avant même d'ouvrir le dossier. Respect du texte à la lettre.
- Dossiers disciplinaires : signalement avec pièces jointes (screenshots, art. 12), défense de
  l'accusé, délibération de la Commission (Seb D. président, Steve L. et Alex G. membres),
  sanctions catalogue (CJ, CR, −2 pts, 0 pt journée, amende, radiation).
- **Casier** public par joueur : cartons, sanctions, historique. Les pénalités d'absence
  (art. 21 à 24 : −3/−3/−3/−5 pts) sont appliquées automatiquement par le moteur.

### 1.7 Rôles

| Membre | Rôle applicatif |
|---|---|
| Greg R. | **Président** (Bureau) : publie les journées, saisit/valide les résultats, override |
| Steve L. | **Premier Ministre** (Commission) : réceptionne les bonus cachés du Président |
| Seb D. | **Président de la Commission de discipline** : tranche les dossiers |
| Alex G. | **Secrétaire / Responsable évènements** (Commission) : challenges, anniversaires |
| Jéré R. | **Chargé de mission** : consultation, aucune décision |
| Alain L. | **Responsable « Combatif du mois »** : nominations mensuelles |

---

## 2. Architecture technique

Objectif : coût ~0 €, zéro maintenance, utilisable au bar sur téléphone.

- **Front** : Next.js (React) + Tailwind, **PWA** installable (icône sur l'écran d'accueil,
  notifications push) — pas de stores.
- **Back** : **Supabase** — PostgreSQL, authentification par lien magique e-mail (rien à retenir),
  stockage des vidéos/photos, temps réel pour le fil d'activité. Row Level Security pour que les
  bonus cachés soient réellement cachés, y compris de la base côté client.
- **Hébergement** : Vercel, déploiement automatique depuis GitHub.
- **Résultats des matchs** : saisie par le Président au MVP ; branchement d'une API football
  (calendrier Ligue 1 + scores automatiques) en V2.
- **Argent** : aucun paiement dans l'app (légalement disproportionné) — registre de cagnotte +
  lien vers Lydia/PayPal pool.

### Modèle de données (principal)

`members` (rôle, statut paiement, radiation) · `matchdays` (type : classique/multiplex/anniversaire/ensemble, statut publication) ·
`fixtures` (matchs, horodatage coup d'envoi) · `predictions` (immuables post-verrouillage, historique de modifications) ·
`results` · `scores` (détail par match + agrégats journée) · `hidden_bonuses` (scellés) ·
`bonus_plays` (individuel ×2, retour du bâton avec horodatage) · `pairs` (binômes) ·
`cards` (CJ/CR) · `disciplinary_cases` + `sanctions` · `ledger` (cagnotte 15 €/5 €) ·
`videos` + `video_ratings` (idée /6, réalisation /4) · `polls` + `poll_votes` (combatif du mois) ·
`activity_feed`.

---

## 3. Phasage

### Phase 1 — MVP « on peut jouer la saison » (~2-3 semaines de dev)
Ligue et membres avec rôles · registre de cagnotte avec échéance 30/09 · publication des journées
par le Président · pronostics structurés avec verrouillage H-30 · saisie des résultats · moteur de
points du barème quotidien (dont multiplex) · classement général · dépôt scellé des bonus cachés
(l'échéance du 30/09 impose de l'avoir au MVP).

### Phase 2 — V1 « le règlement complet + la vie de la ligue »
Bonus individuel ×2 · Retour du Bâton avec binômes · cartons et blocage de journée · dossiers
disciplinaires et bouton « Je conteste » · pénalités automatiques (art. 21-24) · notifications push
(journée publiée, verrouillage imminent, résultats, sanctions) · fil d'activité ·
**médias : upload photos/vidéos** (Supabase Storage, compression côté client, limite de taille)
avec notation communautaire idée /6 + réalisation /4 sous 48 h et **galerie souvenirs** par saison ·
**Le Vestiaire** : chat de la ligue intégré (Supabase Realtime — messages, photos, réactions),
avec rappel automatique de l'article 11 si un pronostic est posté dans le chat.

### Phase 3 — V2 « les évènements »
Journée d'anniversaire complète (tirage de la date, workflow de notation branché sur le module
médias) · Ensemble on est plus fort (tirage, bulletin scellé) · Combatif du mois (workflow +
sondage) · Challenge · API résultats automatiques · palmarès et statistiques de saison · page
« Ballon d'Or ».

---

## 4. Points à trancher avec le Bureau

1. **Saisie libre confirmée** : les fautes des articles 6, 7 et 8 restent possibles — l'app
   enregistre le texte brut sans correction, détecte les anomalies et les transmet à la
   Commission au lieu de les bloquer. Le folklore (cartons pour « Monacu ») est préservé.
2. **Résultats** : saisie par le Président (MVP) vous convient-elle en attendant l'API ?
3. **Vidéos** : limite de taille/durée (proposition : 2 min / 200 Mo, compression automatique).
4. **WhatsApp** : reste le canal de discussion, l'app devient le seul support officiel (art. 11) —
   à faire valider par le Président (qui a toujours raison).
