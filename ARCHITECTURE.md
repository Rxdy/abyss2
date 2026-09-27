# Architecture Abyss2

## Vue d'ensemble de l'infrastructure

```
┌─────────────────────────────────────────────────────────────────┐
│                      DOCKER NETWORK                             │
│                       (abyss2_network)                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         FRONTEND (Vue.js 3 + Vite)                       │   │
│  │         Port: 5174 → 5173                                │   │
│  │         ✓ HMR (Hot Module Replacement)                   │   │
│  │         ✓ Volume mounted for dev                         │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     │                                           │
│                     │ HTTP/REST                                 │
│                     ↓                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         API (Fastify 5 - Node.js)                        │   │
│  │         Port: 3002 → 3000                                │   │
│  │         ✓ JWT + CORS + Helmet                            │   │
│  │         ✓ Swagger UI sur /docs                           │   │
│  │         ✓ Volume mounted for dev (tsx watch)             │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     │                                           │
│                     │ TCP (Prisma / pg)                         │
│                     ↓                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         DATABASE (PostgreSQL 15)                         │   │
│  │         Port: 5434 → 5432                                │   │
│  │         ✓ Persistent volume (postgres_data)              │   │
│  │         ✓ Health checks enabled                          │   │
│  │         ✓ Auto-initialization (schéma dbo)               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> Les ports hôte sont décalés (+1 / +1 / +1) par rapport à Abyss pour que les
> deux projets puissent tourner en même temps sur la même machine.

## Services détaillés

### 1. Frontend (Vue.js)
- **Image**: node:20-alpine
- **Port**: 5174 (hôte) → 5173 (conteneur)
- **Technologie**: Vue 3 (`<script setup>`) + Vite + Pinia + Vue Router
- **Structure**: atomic design (`atoms` / `molecules` / `organisms` / `pages`)
- **Volumes**: `./frontend/src`, `./frontend/public`, `./frontend/index.html`

### 2. API (Fastify)
- **Image**: node:20-alpine
- **Port**: 3002 (hôte) → 3000 (conteneur)
- **Technologie**: Fastify 5 + TypeScript (tsx) + Prisma
- **Volumes**: `./backend/src`, `./backend/scripts`, `./backend/prisma`, `./backend/tests`
- **Plugins**: `@fastify/jwt`, `@fastify/cors`, `@fastify/helmet`, `@fastify/swagger(-ui)`

### 3. Database (PostgreSQL)
- **Image**: postgres:15-alpine
- **Port**: 5434 (hôte) → 5432 (conteneur)
- **Schéma**: `dbo` (toutes les tables)
- **Volumes**: `postgres_data` (schéma construit par `prisma migrate deploy`, lancé au démarrage de l'API — voir `backend/prisma/migrations`)

## Arborescence

```
abyss2/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma           # source de vérité du modèle
│   │   └── migrations/             # historique versionné (prisma migrate)
│   ├── scripts/                    # demo-data.ts (jeu de données pur) + seed-demo.ts (via l'API)
│   ├── src/
│   │   ├── server.ts               # entrée : listen + shutdown
│   │   ├── app.ts                  # factory buildApp() (réutilisée par les tests)
│   │   ├── lib/prisma.ts
│   │   ├── routes/                 # auth · user · categories · transactions · recurring · stats
│   │   └── utils/                  # crypto.ts (blind index + AES-256-GCM) · recurring.ts
│   ├── tests/                      # API + crypto (Prisma mocké)
│   │   └── db/                     # schéma PostgreSQL réel
│   ├── vitest.config.ts            # suite unitaire
│   └── vitest.db.config.ts         # suite base de données
├── frontend/
│   ├── public/                     # favicon.svg/.png + icônes PWA (192/512/maskable) + apple-touch-icon
│   ├── src/
│   │   ├── main.js · App.vue       # thème appliqué avant le montage
│   │   ├── assets/styles/          # design tokens + reset + typo
│   │   ├── components/
│   │   │   ├── atoms/              # BaseInput · BaseButton · BaseText · BaseIcon · BaseChip · BaseSelect · IconButton · AppLogo
│   │   │   ├── molecules/          # AlertBanner · AuthBrand · TypeToggle · PasswordStrengthMeter · NavItem · DateRangePicker · graphiques…
│   │   │   └── organisms/          # AuthShell · AppHeader · AppNavbar · ThemeToggle · PwaInstallButton · OfflineBanner · TransactionForm/List/Detail
│   │   ├── composables/            # useApi · usePwaInstall · useOnlineStatus · useDocumentTheme
│   │   ├── layouts/                # AuthLayout · DefaultLayout
│   │   ├── pages/                  # Login · Register · Home · Transactions · Stats · Recurring · Profile · Categories · NotFound
│   │   ├── router/index.js         # routes + guard auth
│   │   └── stores/                 # auth · app (thème) · transactions · categories · recurring · stats
│   ├── tests/                      # composants, stores, composables, pages
│   └── vite.config.js              # Vite + PWA + config Vitest
├── branding/abyss2-icon.png        # icône source (tirelire) — les tailles PWA en dérivent
├── prompt-icone.md                 # prompt de génération + commandes de redimensionnement
├── todo.md                         # tâches + audit / améliorations potentielles
├── docker-compose.yml
└── Makefile
```

## Sécurité de l'authentification

L'email n'est **jamais stocké en clair** :

| Colonne           | Contenu                                        | Usage                    |
|-------------------|------------------------------------------------|--------------------------|
| `email_hash`      | HMAC-SHA256(email, `MASTER_SECRET`) — 64 hex   | lookup (blind index)     |
| `email_encrypted` | AES-256-GCM(email), clé dérivée par scrypt     | affichage / JWT          |
| `password_hash`   | bcrypt, 12 rounds                              | vérification du mot de passe |

Le login se fait donc en un `findUnique({ emailHash })` + `bcrypt.compare`, puis
signature d'un JWT (7 jours) contenant `{ userId, email }`.

**Décision — chiffrement à clé unique (`MASTER_SECRET`), pas de dérivation par utilisateur.** L'email et les
autres champs sensibles (libellés, montants, notes) sont chiffrés avec une seule clé serveur, dérivée de
`MASTER_SECRET` par `scrypt`. C'est le même modèle qu'un disque chiffré : ça protège d'une fuite de la
seule base de données (dump SQL volé, sauvegarde égarée), pas d'un accès au serveur lui-même — qui porte
la clé et peut donc tout déchiffrer, comme celui qui exploite n'importe quelle application avec une clé
d'API ou une clé de session côté serveur.

Trois colonnes (`auth_salt`, `key_salt`, `key_fragment`) existaient pour une dérivation de clé *par
utilisateur* (« phase 2 »), jamais implémentée, et ont été retirées. Une vraie dérivation par utilisateur
(par ex. une clé issue du mot de passe, via Argon2id) durcirait ce modèle — le serveur ne pourrait plus
déchiffrer sans que l'utilisateur soit connecté — mais c'est un changement lourd et à double tranchant :
il faudrait migrer tout le contenu déjà chiffré, et un mot de passe oublié deviendrait irrécupérable par
construction (aucune porte dérobée n'est alors possible, y compris pour vous). Documenter honnêtement ce
choix, plutôt que de porter du code de dérivation à moitié fait, a semblé le compromis le plus sûr pour
l'instant.

Le login est protégé contre la force brute par une limitation de débit (10 essais / 15 min par
IP + email, 60 par IP) et répond en temps constant, que le compte existe ou non.

**Décision — l'inscription dit qu'un email est déjà pris (409).** Un formulaire d'inscription qui répond
de la même façon dans les deux cas ne peut le faire qu'en écrivant à l'adresse (« si ce compte n'existe pas,
il vient d'être créé »), et l'app n'envoie aucun email : l'utilisateur ne saurait pas pourquoi son inscription
échoue. On garde donc le 409 explicite ; ce qu'il révèle (« cette adresse a un compte ») est borné par la
limitation de débit (20 inscriptions / heure / IP) et n'est pas plus informatif que le formulaire lui-même.
À revoir le jour où l'app envoie des emails (vérification d'adresse, récupération de mot de passe).

**Décision — jeton de session en cookie `httpOnly` + protection CSRF.** Le JWT ne voyage plus en clair
dans `sessionStorage` (lisible par tout script injecté, XSS) : `POST /api/auth/login` et
`PUT /api/user/password` le posent dans un cookie `httpOnly` (`backend/src/utils/session.ts`), inaccessible
en JavaScript. `fastify.authenticate` accepte ce cookie en plus d'un `Authorization: Bearer` classique
(tests, outillage, un futur client non-navigateur) — l'en-tête, quand il est présent, a priorité.

Un cookie envoyé automatiquement par le navigateur expose en retour à la contrefaçon de requête intersite
(CSRF) : un site tiers ne connaît pas le jeton, mais peut faire cliquer la victime et le cookie suivra
tout seul. `@fastify/csrf-protection` (double soumission) protège donc chaque route qui modifie des
données (`preHandler: [fastify.authenticate, fastify.csrfIfCookie]`) — mais seulement quand
l'authentification vient du cookie : un client qui présente son propre `Authorization: Bearer` n'est pas
exposé à cette attaque (aucun navigateur ne l'attache tout seul), et en est dispensé. `csrfIfCookie`
tranche sur la présence de l'en-tête `Authorization`.

Côté front, `useApi()` envoie systématiquement `credentials: 'include'` (le cookie part avec chaque
requête) et pose `X-CSRF-Token` sur les requêtes qui modifient des données, avec le jeton reçu à la
connexion ou au dernier `GET /api/user`. Le store Pinia `auth` ne garde donc plus de jeton : juste un
indice non secret (`hasSession`, en `localStorage` — et non `sessionStorage`, pour survivre à la
fermeture de l'app installée, voir plus bas) qui laisse le garde de route décider avant tout aller-retour
réseau, et le jeton CSRF en mémoire (jamais persisté, redemandé à chaque démarrage via `GET /api/user`).
`POST /api/auth/logout` efface le cookie côté serveur ; appelable sans session active (idempotent).

## Variables d'environnement

Fichier `.env` (voir `.env.example`) :

```
DB_USER=abyss2_user
DB_PASSWORD=...
DB_NAME=abyss2_db
DB_PORT=5434
DATABASE_URL=postgresql://...
FRONTEND_URL=http://localhost:5174
JWT_SECRET=<32 bytes hex>
MASTER_SECRET=<32 bytes hex>
```

`MASTER_SECRET` est **critique** : le perdre rend les emails chiffrés
irrécupérables et casse tous les blind index.

## Flow de communication

```
Utilisateur (Browser)
    ↓ HTTP (5174)
Frontend (Vue.js)
    ↓ HTTP/REST (3002)
API (Fastify)
    ↓ TCP (5434)
Database (PostgreSQL)
```

## Endpoints

| Méthode | Route                 | Auth | Description               |
|---------|-----------------------|------|---------------------------|
| GET     | `/health`             | —    | Health check              |
| GET     | `/api/db-status`      | —    | Statut PostgreSQL         |
| POST    | `/api/auth/register`  | —    | Inscription (mot de passe 8–72 car.) — 20 / h / IP |
| POST    | `/api/auth/login`     | —    | Connexion → JWT — 10 essais / 15 min / IP + email, 60 / IP |
| GET     | `/api/user`           | JWT  | Profil de l'utilisateur   |
| GET     | `/api/summary`        | JWT  | Solde global + totaux et dernières transactions d'un mois (`?month=yyyy-mm`) |
| GET     | `/api/user/export`    | JWT  | Export déchiffré (`?format=json` ou `csv`) |
| GET     | `/docs`               | —    | Swagger UI                |

## Navigation (mobile-first)

```
mobile + tablette (< 1024px)          desktop (≥ 1024px)
┌────────────────────────┐            ┌──────────────────────────────────┐
│ ABYSS2      ☀  ⏻       │            │ ABYSS2  Accueil Profil    ☀  ⏻   │
├────────────────────────┤            ├──────────────────────────────────┤
│                        │            │                                  │
│ main (scrollable)      │            │ main (scrollable)                │
│                        │            │                                  │
├────────────────────────┤            └──────────────────────────────────┘
│   ⌂          ☺         │  ← fixed
└────────────────────────┘
```

`AppNavbar` est monté **dans** `AppHeader` : un seul composant, deux positions.
Sous 1024 px il en sort visuellement grâce à `position: fixed` ; au-delà il
repasse en `static` et s'aligne à côté de la marque.

| | < 1024px | ≥ 1024px |
|---|---|---|
| `--navbar-height` | `4rem` | `0` |
| Position | `fixed` bas d'écran | `static` dans le header |
| Libellés | masqués (*sr-only*) | visibles |

Le `main` réserve `--navbar-height + env(safe-area-inset-bottom)` en bas, ce qui
tombe naturellement à zéro sur desktop puisque la variable y vaut `0`.

Les libellés ne sont jamais retirés du DOM, seulement masqués visuellement : des
icônes de navigation sans nom accessible seraient illisibles au lecteur d'écran.
La déconnexion est dans le header (icône seule, `aria-label`) et reprise en
toutes lettres sur `ProfilePage`.

## Thème clair / sombre

Une seule source de vérité : les variables CSS de `assets/styles/_variables.css`.

```
:root                                   tokens communs + palette sombre
[data-theme="light"]                    palette claire
[data-theme="dark"]                     palette sombre explicite
@media (prefers-color-scheme: light)    :root:not([data-theme]) → suit l'OS
   ↑ appliqué tant qu'aucun choix utilisateur n'est enregistré
```

`app.store.js` résout le thème (localStorage > `prefers-color-scheme` > sombre),
pose `data-theme` sur `<html>` et le persiste. `main.js` l'applique **avant** le
montage de l'app pour éviter le flash de couleur au chargement.

## PWA

`vite-plugin-pwa` en mode `generateSW` (Workbox) :

| Aspect | Choix |
|--------|-------|
| Stratégie | `registerType: 'prompt'` — la nouvelle version est téléchargée puis annoncée (`UpdateBanner`, « Mettre à jour » / « Plus tard ») ; recherche toutes les heures et au retour au premier plan |
| Précache | JS, CSS, HTML, images, polices du build |
| Navigation | `navigateFallback: index.html` (SPA) |
| API | `navigateFallbackDenylist: [/^\/api/]` — **jamais** de cache sur `/api` |
| Icônes | 192, 512 et une maskable 512 dédiée + `apple-touch-icon` + `favicon.svg` / `favicon-32.png` |
| Installation | `usePwaInstall` capte `beforeinstallprompt` (écouté dans `main.js`, avant le montage) ; `PwaInstallButton` dans le header ; sur iOS, pas d'événement → instructions « Partager → Sur l'écran d'accueil » |
| Installation enrichie | captures d'écran (`public/screenshots/`, `scripts/pwa-screenshots.cjs`) et écrans de démarrage iOS (`public/splash/`, `scripts/ios-splash.cjs`) — non précachés, tailles vérifiées par un test |
| Dev | `devOptions.enabled` — SW actif en `npm run dev` |

L'API est délibérément exclue du cache : les réponses portent des données
personnelles et un JWT, elles n'ont rien à faire dans le Cache Storage.

## Déploiement en production

**Décision — image de production séparée pour le front, Traefik en reverse proxy, même origine.**
`frontend/Dockerfile` (développement) lance le serveur de dev de Vite ; il n'a jamais été pensé pour
tourner ainsi en production (HMR, pas de minification stricte, pas de HTTPS — que l'installation de
la PWA exige hors `localhost`). `frontend/Dockerfile.prod` construit plutôt le bundle (`vite build`)
et le sert avec nginx (`frontend/nginx.conf` : repli SPA, cache long sur les fichiers hashés, jamais
de cache sur `index.html`/le service worker pour que les mises à jour restent visibles). L'API
tourne sans watcher (`npm start`) ni volumes montés.

`docker-compose.prod.yml` est un **recouvrement** de `docker-compose.yml` (jamais utilisé seul) :
il bascule ces deux images, retire toute publication de port sur l'hôte, et attache front et API à
un réseau Docker externe où tourne déjà Traefik. Un seul domaine, deux routes : `/api` vers l'API,
le reste vers le front — même origine, condition nécessaire pour que le cookie de session `httpOnly`
(voir plus haut) fonctionne avec `SameSite=Lax` sans avoir à jongler avec `SameSite=None` (qui exigerait
`Secure` partout, y compris pour du outillage interne). Traefik termine le TLS (résolveur de certificats
déjà configuré côté Traefik, pas ici) ; `NODE_ENV=production` y active `Secure` sur le cookie de session.

```bash
make up-prod    # build + déploiement (équivalent à build-prod puis up sur les deux fichiers compose)
make down-prod
```

Variables à définir dans `.env` (voir `.env.example`) : `DOMAIN` (nom de domaine public déjà pointé
vers ce serveur), `TRAEFIK_NETWORK` (réseau Docker de Traefik, `traefik` par défaut),
`TRAEFIK_ENTRYPOINT` et `TRAEFIK_CERT_RESOLVER` (noms déjà configurés côté Traefik).

L'image `abyss2-frontend-prod` (nginx) porte un nom distinct de l'image de développement
(`abyss2-frontend`, Vite) : les deux partagent le même nom de service dans le compose, mais pas la
même image — sans ce nom explicite, `docker compose build` sur l'un écraserait le tag de l'autre, et
`make up` redémarrerait nginx à la place du serveur de dev (piège rencontré et corrigé en écrivant
ce recouvrement).

## Tests

| Suite | Fichiers | Dépendances | Commande |
|-------|----------|-------------|----------|
| API | `backend/tests/*.test.ts` | aucune (Prisma mocké) | `make test-back` |
| Front | `frontend/tests/**/*.test.js` | aucune (`fetch` mocké) | `make test-front` |
| Base | `backend/tests/db/*.test.ts` | PostgreSQL démarré | `make test-db` |
| Restauration | `scripts/test-restore.sh` | PostgreSQL démarré | `make test-restore` — `pg_dump` → base vierge (`prisma migrate deploy`) → mêmes tests SQL |
| Bout en bout | `e2e/tests/*.spec.js` (Playwright, mobile + ordinateur) | la pile complète (`make up`) | `make test-e2e` |
| Lint / types | `eslint.config.js` (API et front), `tsc --noEmit` (API) | aucune | `make lint` |

Le back est testable sans base parce que `buildApp()` accepte une instance
Prisma injectée : `buildApp({ testing: true, prisma: mockPrisma })`. Le logger
et Swagger sont désactivés dans ce mode.

Les tests de base vérifient le schéma physique produit par `prisma/migrations` :
structure, contraintes (FK, NOT NULL, CHECK), comportement des suppressions
(CASCADE / SET NULL), triggers, index, **cohérence avec `schema.prisma`**
(`prisma-drift.test.ts`) et **idempotence de `prisma migrate deploy`** (`migrations.test.ts`).
Les règles CHECK et les triggers ne sont pas exprimables dans `schema.prisma` : ils vivent en SQL
brut dans la migration initiale (`prisma/migrations/20260922060000_init/migration.sql`).

**Décision — migrations Prisma versionnées, à la place d'un `init.sql` rejoué à la main.**
`postgres/init.sql` a été retiré : chaque changement de schéma est désormais un fichier de
migration horodaté dans `prisma/migrations/`, appliqué par `prisma migrate deploy` (exécuté
automatiquement au démarrage de l'API — voir `backend/package.json`, script `dev`). La migration
initiale (`20260922060000_init`) a été construite à partir du dernier état de l'ancien `init.sql`
et vérifiée bit à bit identique (colonnes, contraintes, index, triggers) sur une base entièrement
vierge avant d'être marquée comme déjà appliquée sur la base existante (`prisma migrate resolve
--applied`) — aucune donnée n'a été perdue dans la bascule.

Le code de l'API est intégralement typé (`strict`, aucun `any` dans `src/`) : le client Prisma est typé sur
l'instance Fastify, le jeton JWT a sa charge utile typée (`src/types.ts`), chaque route déclare son corps, ses
paramètres et sa requête. ESLint interdit d'y réintroduire `any`.

Le front a en plus un test d'architecture (`frontend/tests/architecture/`) qui
impose l'atomic design : dépendances atoms → molecules → organisms → pages, pas
de store dans les atoms/molecules, pas d'élément de formulaire brut hors atoms.

## Commandes principales

```bash
make setup     # crée le .env (secrets générés)
make build     # build les images
make up        # lance tous les services
make services  # statut + URLs
make user      # crée test@ et demo@ (comptes vides)
make seed      # remplit demo@abyss2.dev : 6 mois de données réalistes
make test      # les trois suites de tests
make pwa-build # build de prod + vérification manifest/SW
make logs      # logs de tous les services
make down      # arrêt
make clean     # arrêt + suppression des volumes
```
