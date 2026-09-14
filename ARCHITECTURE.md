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
- **Volumes**: `./backend/src`, `./backend/prisma`
- **Plugins**: `@fastify/jwt`, `@fastify/cors`, `@fastify/helmet`, `@fastify/swagger(-ui)`

### 3. Database (PostgreSQL)
- **Image**: postgres:15-alpine
- **Port**: 5434 (hôte) → 5432 (conteneur)
- **Schéma**: `dbo` (toutes les tables)
- **Volumes**: `postgres_data`, `./postgres/init.sql`

## Arborescence

```
abyss2/
├── backend/
│   ├── prisma/schema.prisma        # source de vérité du modèle
│   ├── src/
│   │   ├── server.ts               # entrée : listen + shutdown
│   │   ├── app.ts                  # factory buildApp() (réutilisée par les tests)
│   │   ├── lib/prisma.ts
│   │   ├── routes/{auth,user}.ts
│   │   └── utils/crypto.ts         # blind index + AES-256-GCM
│   ├── tests/                      # API + crypto (Prisma mocké)
│   │   └── db/                     # schéma PostgreSQL réel
│   ├── vitest.config.ts            # suite unitaire
│   └── vitest.db.config.ts         # suite base de données
├── frontend/
│   ├── public/                     # favicon.svg + icônes PWA (192/512/maskable)
│   ├── src/
│   │   ├── main.js · App.vue       # thème appliqué avant le montage
│   │   ├── assets/styles/          # design tokens + reset + typo
│   │   ├── components/
│   │   │   ├── atoms/              # BaseInput · BaseButton · BaseText · BaseIcon
│   │   │   ├── molecules/          # ThemeToggle · NavItem
│   │   │   └── organisms/          # AppHeader · AppNavbar
│   │   ├── composables/useApi.js
│   │   ├── layouts/                # AuthLayout · DefaultLayout
│   │   ├── pages/                  # LoginPage · HomePage · ProfilePage · NotFoundPage
│   │   ├── router/index.js         # routes + guard auth
│   │   └── stores/                 # auth.store.js · app.store.js (thème)
│   ├── tests/                      # composants, stores, composables, pages
│   └── vite.config.js              # Vite + PWA + config Vitest
├── postgres/init.sql
├── prompt-icone.md                 # prompts de génération des icônes
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
| `auth_salt` · `key_salt` · `key_fragment` | aléatoires par utilisateur     | dérivation de clé (phase 2) |

Le login se fait donc en un `findUnique({ emailHash })` + `bcrypt.compare`, puis
signature d'un JWT (7 jours) contenant `{ userId, email }`.

Côté front, le token et l'utilisateur sont gardés en `sessionStorage` (store
Pinia `auth`), injectés en `Authorization: Bearer` par `useApi()`, et validés au
démarrage contre `GET /api/user`.

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
| POST    | `/api/auth/register`  | —    | Inscription               |
| POST    | `/api/auth/login`     | —    | Connexion → JWT           |
| GET     | `/api/user`           | JWT  | Profil de l'utilisateur   |
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
| Stratégie | `registerType: 'autoUpdate'` — le SW se met à jour tout seul |
| Précache | JS, CSS, HTML, images, polices du build |
| Navigation | `navigateFallback: index.html` (SPA) |
| API | `navigateFallbackDenylist: [/^\/api/]` — **jamais** de cache sur `/api` |
| Icônes | 192, 512 et une maskable 512 dédiée + `favicon.svg` |
| Dev | `devOptions.enabled` — SW actif en `npm run dev` |

L'API est délibérément exclue du cache : les réponses portent des données
personnelles et un JWT, elles n'ont rien à faire dans le Cache Storage.

## Tests

| Suite | Fichiers | Dépendances | Commande |
|-------|----------|-------------|----------|
| API | `backend/tests/*.test.ts` | aucune (Prisma mocké) | `make test-back` |
| Front | `frontend/tests/**/*.test.js` | aucune (`fetch` mocké) | `make test-front` |
| Base | `backend/tests/db/*.test.ts` | PostgreSQL démarré | `make test-db` |

Le back est testable sans base parce que `buildApp()` accepte une instance
Prisma injectée : `buildApp({ testing: true, prisma: mockPrisma })`. Le logger
et Swagger sont désactivés dans ce mode.

Les tests de base vérifient le schéma physique produit par `postgres/init.sql`
(colonnes, types, nullabilité, unicité, index, trigger `updated_at`,
extensions) — ils échouent donc si `init.sql` et `schema.prisma` divergent.

## Commandes principales

```bash
make setup     # crée le .env (secrets générés)
make build     # build les images
make up        # lance tous les services
make services  # statut + URLs
make user      # crée un compte de test
make test      # les trois suites de tests
make pwa-build # build de prod + vérification manifest/SW
make logs      # logs de tous les services
make down      # arrêt
make clean     # arrêt + suppression des volumes
```
