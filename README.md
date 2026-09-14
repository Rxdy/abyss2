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

## Identifiants de test

| Email | Mot de passe |
|-------|--------------|
| `test@abyss2.dev` | `password123` |
| `demo@abyss2.dev` | `demo1234` |

Les deux comptes sont déjà en base. Après un `make db-reset` ou un `make clean`,
les recréer avec :

```bash
make user
```

Il n'y a pas encore de page d'inscription — l'API, elle, l'expose déjà :

```bash
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"vous@exemple.com","password":"motdepasse123"}'
```

Connexion sur http://localhost:5174/login → la page d'accueil affiche l'état des
trois services (API, PostgreSQL, service worker). La déconnexion est disponible
dans le header et sur la page Profil.

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
| Accueil | `/` | état des services |
| Profil | `/profile` | email, date de création, identifiant |

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

Installable et fonctionnelle hors ligne via
[vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (Workbox) :

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

> Les icônes actuelles sont des placeholders générés depuis `favicon.svg`.
> [prompt-icone.md](prompt-icone.md) contient les prompts pour en générer de
> vraies, et la procédure de remplacement.

## Tests

Trois suites, une par service, exécutées dans les conteneurs :

```bash
make test          # les trois
make test-back     # API   — 41 tests
make test-front    # front — 95 tests
make test-db       # base  — 12 tests
make test-coverage # rapport de couverture front + back
```

| Suite | Emplacement | Couvre |
|-------|-------------|--------|
| **Back** | `backend/tests/` | crypto (blind index, AES-GCM, altération), `/health`, `/api/db-status`, register (201/409/400, hash bcrypt, aucun email en clair), login (JWT, 401 indifférenciés), `/api/user` (401 sans token, token étranger, utilisateur supprimé). Prisma est mocké : **aucune base requise**. |
| **Front** | `frontend/tests/` | atoms (`BaseInput`, `BaseButton`, `BaseText`), `ThemeToggle`, `NavItem`, `AppNavbar`, `AppHeader`, stores `auth` et `app`, composable `useApi`, pages `LoginPage`, `HomePage` et `ProfilePage`. `fetch` est mocké. |
| **BDD** | `backend/tests/db/` | schéma `dbo` réel : colonnes et types, nullabilité, unicité de `email_hash`, index de lookup, trigger `updated_at`, extensions, CRUD Prisma. **Nécessite PostgreSQL démarré.** |

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
| `backend-db`   | tests d'intégration contre un vrai PostgreSQL (service container + `postgres/init.sql`) |
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
- `useApi()` : fetch + `Authorization: Bearer` automatique + erreurs normalisées
- Store `auth` en `sessionStorage`, session revalidée au démarrage via `/api/user`
- Page `LoginPage` : validation, état de chargement, erreurs par champ + globale

**Back**
- Factory `buildApp()` séparée de `server.ts` (testable avec Prisma mocké)
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/user` (JWT)
- Email jamais en clair : blind index HMAC-SHA256 + chiffrement AES-256-GCM
- bcrypt 12 rounds, JWT 7 jours, Helmet, CORS restreint au front
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

- CI/CD : les trois commandes de test sont prêtes à être branchées (voir
  ci-dessous)
- Page d'inscription (`RegisterPage`) + jauge de robustesse du mot de passe
- Modèle de données des dépenses (comptes, opérations, catégories)
- Vraies icônes générées depuis [prompt-icone.md](prompt-icone.md)
- Migrations Prisma versionnées (aujourd'hui : `postgres/init.sql`)

### Pour la CI

Les étapes à enchaîner, sans Docker Compose côté runner :

```yaml
# back — aucun service requis
- run: npm ci --prefix backend
- run: npm test --prefix backend

# front — aucun service requis
- run: npm ci --prefix frontend
- run: npm test --prefix frontend
- run: npm run build --prefix frontend      # vérifie aussi le manifest PWA

# bdd — nécessite un service postgres:15-alpine
- run: psql "$DATABASE_URL" -f postgres/init.sql
- run: npx prisma generate --schema backend/prisma/schema.prisma
- run: npm run test:db --prefix backend
```

Variables nécessaires : `DATABASE_URL`, `JWT_SECRET`, `MASTER_SECRET` (les deux
derniers peuvent être des valeurs jetables en CI).

## Documentation

L'architecture détaillée est dans [ARCHITECTURE.md](ARCHITECTURE.md).
