# 🌑 Abyss2

Application web : **Vue.js 3 (Vite)** en front, **Fastify 5 + Prisma** en back,
**PostgreSQL 15** en base — le tout orchestré par Docker Compose.

Même architecture qu'Abyss, repartie de zéro. L'app est une **PWA installable**
avec **thème clair/sombre** et une suite de tests sur les trois services.

## Démarrage

```bash
make setup    # crée .env à partir de .env.example (JWT_SECRET / MASTER_SECRET générés)
make build    # build les 3 images
make up       # démarre postgres + api + frontend
```

| Service    | URL                          |
|------------|------------------------------|
| Frontend   | http://localhost:5174        |
| API        | http://localhost:3002        |
| Swagger    | http://localhost:3002/docs   |
| PostgreSQL | localhost:5434               |

> Les ports sont décalés par rapport à Abyss (5173 / 3000 / 5432) pour pouvoir
> faire tourner les deux projets en parallèle.

**Réseau** : par défaut, les trois services ne sont joignables que depuis cette machine (`127.0.0.1`).
Pour tester la PWA depuis un téléphone sur le même réseau, `make up-lan` ouvre l'API et le front au réseau
local (l'adresse est injectée dans CORS et dans l'URL d'API du front) ; PostgreSQL reste local dans tous les cas.
Ouvrez alors `http://<IP de la machine>:5174`. `make up` referme l'accès.

**Production** : `make up-prod` construit une image de production du front (nginx, plus le serveur de
dev de Vite) et lance l'API sans watcher ni volumes, les deux derrière un Traefik déjà en place sur le
serveur (même domaine, `/api` routé vers l'API, le reste vers le front — Traefik termine le TLS). Voir
« Déploiement en production » dans [ARCHITECTURE.md](ARCHITECTURE.md) et les variables `DOMAIN` /
`TRAEFIK_*` de `.env.example`. `make down-prod` arrête cette pile.

## Identifiants de test

| Email | Mot de passe | Contenu |
|-------|--------------|---------|
| `demo@abyss2.dev` | `Tirelire_Abyss-99` | **compte rempli** — 6 mois d'historique (`make seed`) |
| `test@abyss2.dev` | `Loutre-Marine_2026!` | compte vide, pour tester les écrans « aucune donnée » |

Les deux comptes sont créés vides avec `make user` (utile après un `make db-reset`
ou un `make clean`). Pour remplir le compte de démo :

```bash
make seed
```

Le seed passe par l'API (chiffrement, validations et génération des charges fixes
sont ceux de l'app) : catégories et sous-catégories, ~110 dépenses courantes, revenus
ponctuels, une transaction sans catégorie, et 12 charges fixes dont une terminée,
une en pause et une au 29 du mois. Rejouable à volonté : le compte est supprimé puis
recréé. Les dates suivent le jour d'exécution (toujours 6 mois glissants), les
montants et la forme des données sont déterministes
([backend/scripts/demo-data.ts](backend/scripts/demo-data.ts)).

## Navigation

Un seul composant [AppNavbar.vue](frontend/src/components/organisms/AppNavbar.vue),
monté dans le header, qui change de place selon la largeur :

| Largeur | Position | Libellés |
|---------|----------|----------|
| Mobile et tablette (< 1024 px) | barre **fixée en bas** de l'écran | masqués — icônes seules |
| Desktop (≥ 1024 px) | **dans le header**, à côté de la marque | affichés |

Sous 1024 px la barre sort visuellement du header via `position: fixed`, avec
`env(safe-area-inset-bottom)` pour les téléphones à barre de gestes. Les
libellés restent dans le DOM (technique *sr-only*) : masqués à l'œil, toujours
lus par les lecteurs d'écran, jamais des icônes muettes.

| Entrée | Route | Contenu |
|--------|-------|---------|
| Transactions | `/transactions` | liste filtrable (type, catégorie, période) |
| Accueil | `/` | solde, revenus/dépenses du mois, dernières transactions |
| Profil | `/profile` | email, date de création, identifiant, réglages |

Depuis Profil : `/profile/categories` (catégories et sous-catégories) et
`/profile/recurring` (dépenses et revenus fixes mensuels).

Le header contient la marque, la navigation (desktop), la bascule de thème et le
**bouton de déconnexion**. Ajouter une entrée de navigation = une ligne dans le
tableau `ROUTES` d'`AppNavbar.vue` (+ la route dans le router).

## Thème clair / sombre

Tout passe par des variables CSS sur `:root`
([_variables.css](frontend/src/assets/styles/_variables.css)) :

| Sélecteur | Rôle |
|-----------|------|
| `:root` | tokens communs (espacements, typo, rayons…) + palette **sombre** par défaut |
| `[data-theme="light"]` | palette **claire** |
| `[data-theme="dark"]` | palette sombre explicite (si l'OS est en clair) |
| `@media (prefers-color-scheme: light)` sur `:root:not([data-theme])` | suit l'OS tant qu'aucun choix n'a été fait |

`data-theme` est posé sur `<html>` par le store
[app.store.js](frontend/src/stores/app.store.js), avec cet ordre de priorité :
**choix de l'utilisateur (localStorage) > préférence système > sombre**. Le
thème est appliqué dans `main.js` avant le montage, donc sans flash de couleur.
Le bouton de bascule est le composant
[ThemeToggle.vue](frontend/src/components/molecules/ThemeToggle.vue), présent
sur la page de connexion et dans le header.

Pour ajouter une couleur : la déclarer dans les trois blocs (`:root`,
`[data-theme="light"]`, `[data-theme="dark"]`) et n'utiliser que
`var(--color-…)` dans les composants — aucune couleur en dur.

## PWA

Installable via [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (Workbox).
L'interface est mise en cache, mais les données restent en ligne uniquement
(l'API n'est jamais cachée, voir ci-dessous) :

- manifest complet (nom, description, `display: standalone`, `lang: fr`)
- icônes `192`, `512` et une **maskable** dédiée (zone de sécurité Android)
- service worker en `autoUpdate`, `navigateFallback` sur `index.html` pour la SPA
- **l'API n'est jamais mise en cache** (`navigateFallbackDenylist: [/^\/api/]`) :
  ni JWT ni données personnelles ne traînent dans le cache du navigateur
- `devOptions.enabled` → le service worker tourne aussi en `npm run dev`, donc
  l'installabilité se teste sans build

```bash
make pwa-build   # build de prod + affiche le manifest et les fichiers du SW
```

Vérification manuelle : Chrome DevTools → Application → Manifest / Service
Workers, ou l'icône d'installation dans la barre d'adresse.

**Bouton « Installer »** dans le header : il n'apparaît que lorsque l'installation
est possible (invite native Chrome/Edge/Android via `beforeinstallprompt`) et disparaît
une fois l'app installée ou lancée en mode standalone. Sur iOS, qui n'expose pas cet
événement, le bouton affiche les instructions manuelles (Partager → Sur l'écran d'accueil).

Icône : la tirelire de [branding/abyss2-icon.png](branding/abyss2-icon.png) ; les
tailles PWA en sont dérivées (commandes dans [prompt-icone.md](prompt-icone.md)).

## Tests

Trois suites, une par service, exécutées dans les conteneurs :

```bash
make test          # les trois
make test-back     # API   — 280 tests
make test-front    # front — 780 tests
make test-db       # base  — 116 tests
make test-restore  # pg_dump → base vierge (prisma migrate deploy) → restauration → mêmes tests SQL
make test-e2e      # Playwright : vrai navigateur (mobile + ordinateur) sur la pile qui tourne
make lint          # ESLint (API + front) + typage de l'API
make test-coverage # rapport de couverture front + back
```

| Suite | Emplacement | Couvre |
|-------|-------------|--------|
| **Back** | `backend/tests/` | crypto (blind index, AES-GCM, altération), `/health`, `/api/db-status`, register/login/`/api/user`, `/api/categories` (sous-catégories, recatégorisation à la suppression), `/api/transactions` + `/api/summary`, `/api/recurring` (CRUD + calcul pur des échéances dans `recurring-utils.test.ts`). Prisma est mocké : **aucune base requise**. |
| **Front** | `frontend/tests/` | atoms (`BaseInput`, `BaseButton`, `BaseText`, `BaseChip`, `BaseSelect`, `IconButton`), molecules, organisms (`AppHeader`, `PwaInstallButton`, `ThemeToggle`…), stores (`auth`, `app`, `transactions` avec pagination), composables (`useApi`, `usePwaInstall`, `useDocumentTheme`), pages (`Login`, `Register`, `Home`, `Profile`, `Transactions`), utilitaire `passwordStrength`. `fetch` est mocké. **`tests/architecture/atomic.test.js`** lit le code source et fait échouer la CI si l'atomic design n'est pas respecté (voir ci-dessous). |
| **BDD** | `backend/tests/db/` | PostgreSQL réel, **8 fichiers** : `tables` (colonnes, types, chiffrement), `constraints` (clés étrangères, NOT NULL, CHECK — chaque règle est violée exprès et doit être refusée *par la base*), `cascades` (effacement RGPD, `SET NULL`, promotion des sous-catégories), `triggers` (`updated_at`), `indexes`, **`prisma-drift`** (compare `schema.prisma` et la base : types, nullabilité, index, clés étrangères), **`migrations`** (`prisma migrate deploy` est idempotent : le rejouer ne doit rien changer), plus `schema` (table `users`). **Nécessite PostgreSQL démarré.** |

### Atomic design

Les composants sont rangés en `atoms` / `molecules` / `organisms`, et
`tests/architecture/atomic.test.js` vérifie automatiquement :

- **le sens des dépendances** : un atome n'importe aucun composant, une molécule n'importe que des
  atomes, un organisme compose atomes, molécules et organismes, une page ne dépend jamais d'une autre page ;
- **atomes et molécules présentationnels** : ni store, ni appel API (c'est le rôle des organismes) ;
- **aucun élément brut** (`<button>`, `<input>`, `<select>`, `<svg>`) hors des atomes, sauf trois exceptions
  documentées dans le test (calendrier, palette de couleurs, champs date) ; le test échoue si une exception
  devient inutile.

Les trois commandes renvoient un code de sortie non nul en cas d'échec : elles
sont utilisables telles quelles dans une CI. `test-back` et `test-front` ne
dépendent d'aucun service externe ; `test-db` a besoin d'un PostgreSQL
(service `postgres` du compose, ou un service de base dans le runner).

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) tourne sur chaque push et chaque
pull request vers `main`, `staging` et `dev` :

| Job | Contenu |
|-----|---------|
| `backend-unit` | tests API, Prisma mocké — aucune base requise |
| `backend-db`   | tests d'intégration contre un vrai PostgreSQL (service container + `prisma migrate deploy`) |
| `frontend`     | tests front + `vite build` |

Un merge est bloqué tant que les trois jobs ne sont pas verts.

## Workflow Git

Trois branches longues, protégées (pas de push direct — uniquement des pull
requests, CI obligatoire) :

```
dev  →  staging  →  main
```

- **`dev`** : intégration continue, cible par défaut des branches de
  fonctionnalité (`feat/…`, `fix/…`).
- **`staging`** : pré-production, recette avant mise en ligne.
- **`main`** : production. Reflète toujours ce qui est déployé.

Une fonctionnalité se développe sur une branche dédiée créée depuis `dev`,
puis remonte par pull requests successives : `feat/xxx → dev → staging → main`.
Aucune de ces trois branches n'accepte de commit poussé directement.

## Ce qui est en place

**Front**
- Vue 3 `<script setup>`, Pinia, Vue Router avec système de layouts
  (`auth` sans chrome / `default` pour l'app) et guard `requiresAuth`
- Design tokens CSS (thème sombre + variante claire), reset, typographie
- Atomic design : `BaseInput` (avec toggle mot de passe), `BaseButton`, `BaseText`
- `useApi()` : fetch avec cookie de session (`credentials: 'include'`) + jeton `X-CSRF-Token`
  automatique sur les requêtes qui modifient des données, erreurs normalisées
- Store `auth` : jeton de session en cookie `httpOnly` (rien en `sessionStorage`), juste un indice
  non secret en `localStorage` pour le garde de route ; session revalidée au démarrage via `/api/user`
- Page `LoginPage` : validation, état de chargement, erreurs par champ + globale
- Tableau de bord (`HomePage`) : solde, revenus/dépenses du mois, dernières
  transactions, ajout rapide
- Transactions : liste filtrable (type, catégorie, période), formulaire dépense/revenu
- Catégories : couleur libre, sous-catégories (1 niveau), réorganisation
  (monter/descendre), suppression avec confirmation et recatégorisation
  optionnelle des transactions concernées
- Formulaires en modale (`BaseModal` / `FormModal`) : bottom sheet sur mobile, centrée sur ordinateur, bouton flottant `+`,
  confirmation avant d'abandonner une saisie modifiée
- Inscription : robustesse du mot de passe estimée par l'entropie (barre à 5 niveaux, libellé au survol) ; niveau « Fort » (≥ 60 bits) requis
- Dépenses/revenus fixes (`RecurringPage`) : pause/reprise, prochaine échéance affichée

**Back**
- Factory `buildApp()` séparée de `server.ts` (testable avec Prisma mocké)
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/user` (JWT)
- Email jamais en clair : blind index HMAC-SHA256 + chiffrement AES-256-GCM
- bcrypt 12 rounds, JWT 7 jours, Helmet, CORS restreint au front
- Limitation de débit (`@fastify/rate-limit`, en mémoire) : connexion 10 essais / 15 min par IP + email et
  60 / 15 min par IP, inscription 20 / heure par IP — réponse `429` `RATE_LIMITED` avec `Retry-After`
- Export des données déchiffrées : `GET /api/user/export?format=json|csv`
- Variables d'environnement optionnelles de l'API : `TRUST_PROXY=true` (derrière un reverse proxy de confiance,
  sinon toutes les IP sont celle du proxy), `RATE_LIMIT_DISABLED=true` (coupe-circuit), `APP_TIMEZONE`
  (défaut `Europe/Paris`, pour le « mois courant »)
- `/api/categories`, `/api/transactions` + `/api/summary` (chiffrés AES-256-GCM,
  montants en centimes)
- `/api/recurring` : dépenses/revenus fixes mensuels — un rattrapage
  (`runDueRecurring`) génère les transactions dues à chaque lecture des
  transactions/du résumé/de la liste des charges fixes
- Swagger UI sur `/docs`

## Dépannage

**`Error: EMFILE: too many open files, watch ...` au démarrage de l'api ou du front**

Les instances inotify sont une ressource de l'hôte partagée entre tous les
conteneurs (`fs.inotify.max_user_instances`, 128 par défaut) et elles sont vite
épuisées quand plusieurs projets tournent en parallèle. Les deux services sont
donc démarrés avec `CHOKIDAR_USEPOLLING=true` (voir `docker-compose.yml`), ce qui
évite complètement inotify au prix d'un peu de CPU.

Pour repasser sur inotify (HMR plus réactif), retirer ces variables et relever la
limite côté hôte :

```bash
sudo sysctl -w fs.inotify.max_user_instances=512   # + /etc/sysctl.d/ pour persister
```

## Prochaines étapes

Le détail — feuille de route, audit du code et améliorations potentielles classées
par priorité — est dans **[todo.md](todo.md)**.

## Documentation

L'architecture détaillée est dans [ARCHITECTURE.md](ARCHITECTURE.md).
