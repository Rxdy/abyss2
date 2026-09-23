# Abyss2 — tâches & améliorations

Légende : 🔴 à traiter en premier · 🟠 important · 🟡 confort / polish.
✅ **vérifié** = reproduit ou mesuré lors de l'audit ; le reste vient de la lecture du code.

État : **349 tests API · 864 tests front · 154 tests base · 10 parcours de bout en bout**, typage backend propre, build OK.

## 1. À faire — feuille de route

- [ ] 🟠 **Page Statistiques — plus de possibilités** : comparaison de plusieurs catégories/enveloppes
  entre elles (graphique multi-séries) · historique sur 12 mois et plus (actuellement limité à des
  périodes courtes) · export/partage des statistiques (graphique ou PDF d'une période, en plus de
  l'export JSON/CSV déjà existant sur le Profil)
- [ ] 🟡 **Compte de démo enrichi** : étendre l'historique généré par `make seed` au-delà des 3 mois
  actuels (12–24 mois), pour que les graphiques et tendances du compte démo aient plus de valeur
- [ ] 🟡 **CI — 3ᵉ étage `build`** : après lint et test, construire les images Docker de production
  (API + front) et vérifier qu'elles démarrent saines — attrape les erreurs de packaging que
  lint/tests ne voient pas
- [ ] 🟡 **Tests sur les zones à 0 % de couverture** (front) : `ForgotPasswordPage`, `ResetPasswordPage`,
  `NotFoundPage`, `App.vue`, les layouts (`AuthLayout`, `DefaultLayout`) — aucun test unitaire
  dédié aujourd'hui, seuls les parcours Playwright les traversent. Côté API, `mail.ts` (18 % de
  couverture) : l'envoi d'email n'est testé qu'indirectement via `password-reset.test.ts`
- [ ] 🟡 **Autres notifications** : solde négatif détecté sur le mois affiché · charge fixe jamais
  rattrapée depuis plusieurs mois · résumé mensuel (recoupe la tâche Stats ci-dessus)

## 2. Fait

- [X] **Notifications** : enveloppe dépassée (réactif, seulement au franchissement du plafond, pas à
  chaque transaction déjà au-dessus) et dépenses non catégorisées (digest paresseux, au plus une
  fois par semaine, évalué à la lecture — pas de tâche planifiée côté API). Cloche dans l'en-tête
  avec badge (compte non lu, gardé derrière `isAuthenticated` pour éviter un 401 pendant la
  résolution initiale du routeur), page dédiée (onglets Actives/Archivées, marquer lu à l'ouverture,
  archiver, supprimer). Titre/message reconstruits à la lecture à partir du type — rien de texte
  libre stocké. `Notification` (migration dédiée, CHECK sur `type`), `/api/notifications`,
  `utils/notifications.ts` ; couvert par 12 tests API, tests du helper de génération, 8 tests base
  (contraintes, cascade, index, dérive Prisma) et les tests front (store, cloche, ligne, page)
- [X] **Réinitialiser les données du compte** : bouton rouge dans Profil → Mes données — vide
  transactions, catégories, charges fixes et enveloppes puis ré-amorce les catégories par défaut
  (comme à l'inscription) ; le compte et le mot de passe restent inchangés. Confirmation par mot
  tapé (« RÉINITIALISER », insensible à la casse/espaces) plutôt que par mot de passe : rien
  d'irrécupérable en dehors des données elles-mêmes. `DELETE /api/user/data` (une transaction Prisma)
- [X] **Animation pièce → tirelire** : reprend le mouvement de la pièce du logo (voir `AppLogo.vue`)
  comme micro-interaction à l'ajout d'une transaction (jamais à la modification) — store dédié
  (même schéma que `toast.store`), overlay global non bloquant (`pointer-events: none`), respecte
  `prefers-reduced-motion`
- [X] **Email SMTP réel** : `.env.example` documente enfin les variables `SMTP_*` (jusque-là seulement
  mentionnées en commentaire dans `docker-compose.prod.yml`) — testé avec un compte Gmail dédié
  (mot de passe d'application). Template HTML restylé, logo Abyss2 en pièce jointe `cid:` (plus
  fiable qu'une image distante ou une data URI sur certains clients comme Outlook)
- [X] **Fix — vide entre l'en-tête et les filtres au défilement (Transactions)** : `main` (conteneur
  défilant) porte son propre padding-top, qui restait un espace vide au-dessus du bloc filtres une
  fois collé (`position: sticky`) — les cartes défilaient visiblement à travers. Mesuré au pixel
  (`getBoundingClientRect`) : une marge négative ne change rien à la position une fois collé
  (peu fiable avec `position: sticky`) ; la vraie correction décale le point d'ancrage `top` lui-même
- [X] **Fix — email entouré d'espaces rejeté par l'API** : `body/email must match format "email"` sur
  un appel direct (script, Swagger) avec un email copié-collé avec des espaces — le front trimme
  déjà, mais pas un appel direct à l'API. Hook `preValidation` sur `register`/`login`/`forgot-password`

- [X] **Enveloppes budgétaires** : nouvelle enveloppe (nom + montant alloué mensuel, chiffré) regroupant
  plusieurs catégories (`Category.envelopeId`, une seule enveloppe à la fois) ; la jauge de
  l'enveloppe = dépenses cumulées de toutes ses catégories liées sur le mois affiché (réutilise
  `BudgetList` et la navigation par mois de l'accueil). Jamais bloquant : dépasser l'enveloppe, ou
  allouer plus que les revenus réels du mois, affiche une alerte informative (`AlertBanner`) sans
  jamais refuser une transaction. Pas de report du solde au mois suivant (repart à zéro chaque
  mois, comme le budget par catégorie) — à revoir si l'usage le demande. CRUD complet
  (`/api/envelopes`), page dédiée (Profil → Enveloppes), catégories liées choisies par chips
  (`BaseChip`). Migration `20260922110000_add_envelopes` ; couvert par 12 tests API, 5 tests base
  (contraintes, cascades, trigger, index, dérive Prisma) et les tests front (store, formulaire,
  ligne, page, section accueil)
- [X] **Récupération de mot de passe** : `POST /api/auth/forgot-password` (jeton haute entropie, seul son hash
  SHA-256 est stocké — `PasswordResetToken`, une ligne par demande, `usedAt` empêche de rejouer un lien),
  email envoyé via `backend/src/utils/mail.ts`, `POST /api/auth/reset-password` (jeton expiré/déjà utilisé
  refusé, robustesse du mot de passe revérifiée, toutes les autres sessions révoquées). Limité en débit par IP
  et par compte (`forgot-ip`, `forgot`, `reset-ip`). Front : `ForgotPasswordPage`, `ResetPasswordPage`,
  lien depuis la connexion. Couvert par `backend/tests/password-reset.test.ts`
- [X] **Migrations Prisma versionnées** : `postgres/init.sql` retiré, remplacé par `prisma/migrations/` — une
  migration initiale (baseline) construite à partir de son dernier état, vérifiée identique (colonnes,
  contraintes, index, triggers) sur une base entièrement vierge, puis marquée déjà appliquée sur la base
  existante (`prisma migrate resolve --applied`, aucune donnée perdue). `prisma migrate deploy` s'exécute
  désormais tout seul au démarrage de l'API ; `tests/db/init-sql.test.ts` devient `migrations.test.ts`
  (même vérification d'idempotence, sur `migrate deploy` au lieu du rejeu de `init.sql`)
- [X] **Mobile d'abord : formulaires en modale** — `BaseModal` (feuille en bas sur mobile, centrée sur ordinateur ; croix, fond, Échap ;
  `role="dialog"`, focus piégé puis rendu au bouton d'origine, défilement bloqué), `FormModal` (confirmation d'abandon
  seulement si un champ a été modifié, via `useDirtyForm`), bouton flottant `+` (`FabButton`). Au repos, plus aucun formulaire à
  l'écran : Accueil, Transactions, Charges fixes, Catégories, changement de mot de passe. Toucher une ligne ouvre la même modale,
  préremplie (remplace `TransactionDetail`) ; le formulaire gagne un champ Note et une confirmation avant suppression
- [X] **Robustesse du mot de passe à l'inscription** : estimation par l'entropie (bits), échelle claire en 5 niveaux (Très faible < 28 ·
  Faible 28–39 · Moyen 40–59 · **Fort 60–79** · Très fort ≥ 80), affichée en barre à 5 segments, libellé du niveau atteint au survol, conseil chiffré (« ajoutez ~2 caractères »). Niveau **« Fort » requis** pour créer un compte (`REQUIRED_LEVEL`)
- [X] **Limitation de débit** (`@fastify/rate-limit`) : connexion 10 essais / 15 min par IP + email et 60 / 15 min par IP,
  inscription 20 / h par IP ; `429` `RATE_LIMITED` en français avec `Retry-After`. À faire au déploiement :
  `TRUST_PROXY=true` derrière un reverse proxy, et un store partagé (Redis) si l'API passe à plusieurs instances
- [X] **Atomic design terminé** : plus aucune exception (`ColorSwatch`, `ColorPicker`, `CalendarDay` ; `DateRangePicker`
  n'a plus de contrôle brut) — `CategoryForm`, `CategoryRow`, `RecurringForm`, `RecurringItem` extraits
  (Catégories 459 → 214 lignes, Charges fixes 380 → 153) : préalable de la modale mobile levé
- [X] **Les 14 dernières tâches 🟡** (voir ci-dessous) : budgets par catégorie · accueil (graphique du mois, prochaines échéances,
  navigation par mois) · écrans épurés · ports liés à `127.0.0.1` · CSP de l'API · résumé allégé · notification de mise à jour ·
  écrans de démarrage iOS · API entièrement typée · ESLint · tests de bout en bout · `npm audit` en CI · arbitrage du 409
- [X] **Budgets par catégorie** : plafond mensuel facultatif (colonne `budget_encrypted`, chiffré comme les montants), champ dans le
  formulaire de catégorie, jauges sur l'accueil (vert, jaune dès 80 %, rouge une fois dépassé) ; le compte de démo en a trois
- [X] **Accueil** : navigation par mois (`GET /api/summary?month=`, bornes = plus ancienne transaction et mois courant, retour
  « Mois en cours »), courbe des dépenses du mois, 3 prochaines échéances de charges fixes
- [X] **Réseau** : PostgreSQL, API et front liés à `127.0.0.1` ; `make up-lan` ouvre API et front au réseau local (CORS et URL d'API
  adaptés) pour tester la PWA sur téléphone, la base reste locale
- [X] **CSP de l'API** stricte (`default-src 'none'`, `frame-ancestors 'none'`…) ; `/docs` a sa propre CSP, en développement seulement
- [X] **Résumé allégé** (`GET /api/summary`) : lecture du seul montant/type/date pour les totaux, libellés et catégories déchiffrés
  pour les 5 lignes affichées seulement (≈ 2× moins de déchiffrements)
- [X] **Mise à jour de la PWA annoncée** (`registerType: 'prompt'`, `UpdateBanner`) : « Mettre à jour » / « Plus tard », recherche
  toutes les heures et au retour au premier plan — plus de rechargement silencieux au milieu d'une saisie
- [X] **Écrans de démarrage iOS** (17 tailles d'iPhone et d'iPad, `scripts/ios-splash.cjs`) ; tailles vérifiées par un test
- [X] **API entièrement typée** : `strict` (`noImplicitAny` activé), client Prisma typé, jeton JWT typé, corps / paramètres / requêtes
  typés par route — **0 `any` dans `src/`**, et ESLint interdit d'en remettre
- [X] **ESLint** (API : `typescript-eslint` ; front : `eslint-plugin-vue`, règles de correction seulement) + `.editorconfig` ;
  `make lint` et étapes CI. Prettier volontairement **non adopté** : le code aligne ses imports à la main, un formateur imposerait
  un remaniement de tous les fichiers sans rien corriger
- [X] **Tests de bout en bout** (Playwright, `e2e/`, `make test-e2e`) : inscription avec refus d'un mot de passe faible, ajout d'une
  transaction, budget, statistiques, déconnexion / reconnexion, pages protégées — 5 scénarios × mobile et ordinateur, chaque test
  crée puis supprime son compte
- [X] **`npm audit --omit=dev --audit-level=high`** en CI (API et front) : `@fastify/swagger-ui` monté en 6.x, plus aucune alerte
  d'exécution
- [X] **Décision — `register` garde son 409 explicite** (pas d'envoi d'email pour faire autrement ; borné par la limitation de débit) :
  consignée dans ARCHITECTURE.md, à revoir quand l'app enverra des emails
- [X] **Comparaison entre périodes** (Stats) : écart en % sous le total (« ▲ +7,8 % vs août, au 21 »), coloré selon qu'il est
  favorable (dépense qui baisse, revenu qui monte). Le mois / l'année **en cours** se compare à la même portion de la période
  précédente (pas 21 jours contre un mois entier) ; période personnalisée : la période de même durée juste avant
- [X] **Doublons de charges fixes impossibles en base** : index unique `(recurring_id, date)` (`init.sql` + `schema.prisma`),
  génération en `createMany({ skipDuplicates })` (`ON CONFLICT DO NOTHING`), `409 DUPLICATE_OCCURRENCE` si une modification de
  date entre en collision. Vérifié : 30 lectures simultanées → 30 × 200, 9 échéances distinctes (l'index unique
  vit maintenant dans `prisma/migrations/20260922060000_init`, `init.sql` n'existe plus — voir plus bas)
- [X] **Restauration testée** : `make test-restore` (`scripts/test-restore.sh`) — `pg_dump` → base vierge construite par
  `prisma migrate deploy` → chargement → volumes comparés → mêmes tests SQL sur la base restaurée
- [X] **Plans de requête vérifiés** sur 300 000 transactions (100 000 pour un seul compte) : liste 0,7 ms (page profonde 39 ms),
  filtres 0,2–0,5 ms, stats d'un mois 1 ms / d'une année 11 ms, périodes 19 ms — tous par index, aucun index à ajouter.
  Seul le résumé (toutes les lignes, tri sur disque) sort du lot : voir §5 Performance
- [X] **Captures d'écran du manifest** (5, narrow + wide, `scripts/pwa-screenshots.cjs`), non précachées par le service worker,
  tailles vérifiées par un test
- [X] **Bug corrigé — infobulle du camembert** : elle lisait la liste des catégories au lieu des parts affichées (sous-catégories
  aplaties et triées) → mauvais nom et montant au survol, voire plantage. Découvert en écrivant les tests
- [X] **Couverture front** : `TransactionForm`, `TransactionItem`, `TransactionList`, `DateRangePicker`, pages Charges fixes / Catégories /
  Stats, graphiques (Chart.js simulé), garde-fou du manifest
- [X] **Notifications de succès** (`ToastHost` + `toast.store`) : création, modification, suppression de transactions,
  catégories et charges fixes ; annoncées aux lecteurs d'écran (`aria-live`)
- [X] **Fuseau horaire** : « aujourd'hui » et « mois courant » suivent Europe/Paris côté API (`APP_TIMEZONE`) et le fuseau
  de l'appareil côté front — plus de solde du mois en retard, ni de date par défaut à la veille, entre minuit et 2 h
- [X] **Performance** : `toApi` ne déchiffre le nom d'une catégorie qu'une fois par réponse
- [X] **Composants extraits** : `StatsFilters`, `CategoryBreakdown` (Stats 305 → 160 lignes), `PasswordChangeForm`,
  `DangerZone` (Profil 379 → 237 lignes)
- [X] **Tests front** : stores `stats`, `categories`, `recurring`, `toast` ; page Stats ; `StatsFilters`, `CategoryBreakdown`,
  `PasswordChangeForm`, `DangerZone`, `ToastHost`
- [X] **Raccourcis PWA** (appui long sur l'icône) : « Ajouter une transaction » (`/transactions?new=1` ouvre le formulaire)
  et « Statistiques »
- [X] **Atomic design** : `StatsPage` n'a plus d'`<input>` brut (`BaseInput` gagne `size="sm"`, `min`, `max`) ;
  `TimeseriesChart` n'enregistre que les éléments Chart.js utiles (vérifié)
- [X] **Recherche** par libellé / note / catégorie sur les Transactions (côté client, insensible à la casse et aux accents ;
  charge toutes les pages pour chercher sur l'ensemble)
- [X] **Outillage** : `healthcheck` Docker sur l'API et le front (le front attend l'API saine) · `make seed` explique
  quoi faire quand l'API est arrêtée ou pas encore prête
- [X] **Export des données** : `GET /api/user/export?format=json|csv` (déchiffré, protégé contre l'injection de formules
  dans le CSV) + section « Mes données » sur le Profil
- [X] **Contournement de la révocation supprimé** : un jeton sans `tv` est refusé (401 `TOKEN_REVOKED`) ; les sessions
  ouvertes avant ce changement sont renvoyées à la connexion
- [X] **Page Statistiques sur deux colonnes** dès 1024 px (graphiques à gauche, détail par catégorie à droite)
- [X] Onglet Statistiques, sélecteur de plage de dates, changement de mot de passe, charges fixes
- [X] Icône (tirelire) + toutes les tailles PWA + thème aux couleurs de l'icône
- [X] **Bouton « Installer »** dans le header (invite native + instructions iOS) · **bannière hors ligne**
- [X] **Compte de démo rempli** : `make seed` → `demo@abyss2.dev` / `demo1234`
- [X] **Couleurs vérifiées** : contraste WCAG AA sur 23 associations × 2 thèmes, verrouillé par `tests/theme/contrast.test.js`
  (texte atténué, bleu, menthe, succès/danger/avertissement et anneau de focus corrigés en thème clair ;
  texte atténué et survol du bouton danger corrigés en thème sombre)
- [X] **Page d'inscription** (`/register`) + jauge de robustesse, lien depuis la connexion et retour
- [X] **Pagination des transactions** (« Charger plus ») — le bug des 50 premières lignes est corrigé
- [X] **Sécurité rapide** : plus de secret JWT de repli · login à temps constant (plus d'énumération
  de comptes par le délai) · mot de passe borné à 72 caractères · Swagger coupé en production
- [X] **Robustesse API** : période de stats bornée à 10 ans · `from > to` refusé sur les transactions
- [X] **Qualité** : `npm run typecheck` (et étape CI) · `@vitest/coverage-v8` ajouté (`make test-coverage`
  fonctionne) · bloc « D'autres blocs viendront ici » retiré · `id` dans le manifest PWA
- [X] **Atomic design vérifié et verrouillé par un test** (voir §3) — 3 nouveaux atomes, 5 nouvelles
  molécules/organismes, 3 composants remis au bon niveau, 2 graphiques découplés du store
- [X] **Tests SQL** : 8 fichiers sur PostgreSQL réel (voir §4) — a fait apparaître, puis corrigé,
  des colonnes `created_at`/`updated_at` nullables en base alors que Prisma les déclare obligatoires,
  et ajouté 8 contraintes CHECK

> ⚠️ Après ce lot : lancer `make build` pour que les images Docker intègrent la nouvelle
> dépendance de test (`@vitest/coverage-v8`, déjà présente dans `package.json` et le lockfile).

---

## 3. Atomic design — bilan

**Règles (imposées par `frontend/tests/architecture/atomic.test.js`)** : atomes sans dépendance ·
molécules → atomes seulement · organismes → tout en dessous · pages jamais entre elles ·
atomes/molécules sans store ni API · aucun `<button>/<input>/<select>/<textarea>/<svg>` hors atomes.

**Écarts trouvés et corrigés**

| Écart                                                                                                                 | Correction                                                                             |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `PwaInstallButton` (molécule) importait `ConfirmDialog` (molécule) ; idem `OfflineBanner`                      | déplacés en`organisms/`                                                            |
| `ThemeToggle` (molécule) lisait le store                                                                            | déplacé en`organisms/`                                                             |
| Graphiques (molécules) lisaient le store pour le thème                                                               | `useDocumentTheme` (lit `<html data-theme>`), plus de store                        |
| Une vingtaine de`<button>`, 7 `<select>` et 2 `<svg>` bruts dans molécules, organismes et pages                 | atomes`BaseChip`, `BaseSelect`, `IconButton` ; icônes ajoutées à `BaseIcon` |
| Style « pastille de filtre » copié dans 2 pages, « type Dépense/Revenu » dans 2 autres,`.field__select` dans 3 | un seul composant chacun (`BaseChip`, `TypeToggle`, `BaseSelect`)                |
| Cadre + marque + erreur dupliqués (connexion, inscription)                                                            | `AuthShell` (organisme), `AuthBrand`, `AlertBanner` (molécules)                 |
| 6 encadrés d'erreur faits main dans les pages                                                                         | `AlertBanner`                                                                        |
| Icônes trompeuses : « supprimer » = flèche de déconnexion, « modifier » = étiquette                            | `trash`, `pencil`, `pause`, `play`                                             |

**Exceptions** : aucune — la liste `RAW_CONTROL_EXCEPTIONS` du test est vide (le test échoue si une exception devient inutile).

**Pages** : plus aucune page ne porte de formulaire en dur ; les formulaires sont des organismes prêts à être ouverts
en modale (§5).

## 4. Tests SQL — ce qui est couvert

`make test-db` (PostgreSQL réel, données de test préfixées puis supprimées) :

| Fichier          | Vérifie                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `schema`       | table`users`, unicité et index de `email_hash`, trigger, extensions                                          |
| `tables`       | colonnes / types / longueurs / nullabilité des 3 autres tables, pas de donnée en clair                          |
| `constraints`  | FK, NOT NULL, valeurs par défaut, 8 CHECK — chaque règle est violée exprès, sous le bon nom                  |
| `cascades`     | effacement RGPD (rien ne reste, rien ne touche les autres),`SET NULL`, promotion des sous-catégories           |
| `triggers`     | `updated_at` sur chaque table, `created_at` intact                                                            |
| `indexes`      | index utiles aux requêtes de l'API                                                                               |
| `prisma-drift` | `schema.prisma` ↔ base : colonnes, types, longueurs, nullabilité, défauts, index, FK + règle de suppression |
| `migrations`   | `prisma migrate deploy` rejoué deux fois : structure inchangée (idempotence)                                  |

---

## 5. Audit — points encore ouverts

### Sécurité

- [X] **Robustesse imposée aussi côté API**, à l'inscription et au changement de mot de passe : port TypeScript de
  l'estimateur front (`backend/src/utils/passwordStrength.ts`, mêmes seuils, vecteurs de test partagés pour détecter
  une dérive entre les deux). `409` → `WEAK_PASSWORD`. Seed migré (`demo1234` → `Tirelire_Abyss-99`, README et
  `make user` mis à jour) ; vérifié : l'API nue refuse `Bonjour42` à l'inscription et au changement de mot de passe
- [X] **Jeton en cookie `httpOnly` + protection CSRF** (remplace le jeton dans `sessionStorage`, illisible par tout
  script injecté ; résout aussi le point suivant) : `fastify.authenticate` accepte le cookie de session
  (`backend/src/utils/session.ts`) en plus d'un `Authorization: Bearer` classique (tests, outillage) — seul le
  cookie déclenche `fastify.csrfIfCookie` (`@fastify/csrf-protection`, double soumission) sur chaque route qui
  modifie des données ; un client Bearer, jamais exposé à la contrefaçon intersite, en est dispensé. Le front
  (`useApi.js`) envoie systématiquement `credentials: 'include'` et pose `X-CSRF-Token` sur les requêtes
  mutantes ; `auth.store.js` ne garde plus qu'un indice non secret (`localStorage`) pour le garde de route et le
  jeton CSRF en mémoire. Vérifié : 13 tests d'intégration dédiés (`backend/tests/session.test.ts`), parcours
  Playwright complet (inscription → connexion → déconnexion → reconnexion) sur navigateur réel, et un `curl`
  manuel bout en bout (connexion, `GET /api/user` au cookie seul, `POST` refusé sans jeton CSRF puis accepté avec)
- [X] **Session perdue à la fermeture de l'app installée** : corrigé par le point précédent — le cookie de session
  survit à la fermeture de l'app (le navigateur le gère, pas `sessionStorage`), et l'indice de garde de route vit
  désormais en `localStorage` (persistant) plutôt qu'en `sessionStorage` (vidé à chaque fermeture d'onglet/PWA).
  Vérifié avec un script Playwright dédié : connexion dans un premier contexte, `storageState` capturé, nouveau
  contexte navigateur (simulant un redémarrage complet de l'app) restauré depuis cet état → la page d'accueil
  reste accessible sans repasser par la connexion
- [X] **Chiffrement à clé unique — modèle de menace documenté, colonnes inutilisées retirées** :
  `auth_salt` / `key_salt` / `key_fragment` (jamais exploitées, « phase 2 ») retirées de `schema.prisma`
  et de l'inscription ; drop rétroactif sur la base existante, absentes de la migration initiale. Le compromis « une dérivation par
  utilisateur rendrait un mot de passe oublié irrécupérable » est expliqué dans ARCHITECTURE.md

### Fiabilité des données

### Performance

### Interface & accessibilité

### PWA

- [X] **Image de production** : `frontend/Dockerfile.prod` (build Vite + nginx, `nginx.conf` avec repli SPA et
  cache différencié) + `docker-compose.prod.yml` (recouvrement, jamais utilisé seul) qui bascule les images,
  retire toute publication de port et attache front/API à Traefik — un domaine, `/api` vers l'API, le reste
  vers le front (même origine, HTTPS terminé par Traefik). `make up-prod` / `make down-prod`. Vérifié : image
  buildée et testée seule (repli SPA, en-têtes de cache) puis la pile complète démarrée sur un réseau Traefik
  de test — API et front sains, connexion sur le compte démo réussie, données intactes après recréation des
  conteneurs. Piège rencontré et corrigé : front dev et prod partageaient le même nom d'image (`abyss2-frontend`)
  — le build prod écrasait le tag dont dépend `make up`, image prod renommée `abyss2-frontend-prod`

### Tests & qualité

### Dépendances

`npm audit --omit=dev` (dépendances d'exécution) : **0 alerte**, front et API — contrôlé par la CI. Restent les outils de
développement :

- [X] **`vitest` 5, `happy-dom` 20, `vite` 8** (+ `vite-plugin-pwa` 1.x, `@vitejs/plugin-vue` 6.x, requis par vite 8) : montés,
  775 tests inchangés. Le nouveau minifieur CSS de Vite (lightningcss, plus strict) a débusqué un vrai bug latent dans
  `_variables.css` : le bloc de couleurs de robustesse (mot de passe) du repli `@media (prefers-color-scheme: light)` sans
  thème choisi était tombé hors de son sélecteur — jamais appliqué dans ce cas précis, invisible en dev (le navigateur
  ignore juste la déclaration en silence), fatal seulement au build de production. Corrigé, et couvert par un test qui
  minifie réellement le fichier (`lightningcss`) pour empêcher la régression

### Outillage






les données de chaque user doit etre chiffré, et stocker de maniere chiffré, il faut recupere et afficher les donéne en clair ! (attention il faut que l'affichage soit rapide !) je veux pas trop de charge dans l'affichage donc lorsque on dechiffre ce qu'on veux afficher !

Il faut identifier ce qu'on estime sensible, et donc utile de chiffré, sa permettra d'avoir moins d'opération de dechiffrement

il y a certaines route de l'api qui doit etre securiser, ou il est obliger d'etre authentifier ! et que sa soit la bonen personne authentifie, chaque donnée est cloisonnée a son utilisateur !!
