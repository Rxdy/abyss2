#!/usr/bin/env bash
#
# Déploie la version présente dans ce dossier sur le serveur de production (meliodas).
#
#   ./scripts/deploy.sh          (ou : make deploy)
#
# Lancé par la CI après chaque merge sur main (voir .github/workflows/ci.yml, job « deploy »),
# une fois le dépôt placé sur le commit testé ; lançable aussi à la main sur le serveur.
#
#   1. sauvegarde la base (pg_dump compressé, 14 dernières gardées dans backups/) ;
#   2. reconstruit et relance la pile de production (make up-prod) — l'API applique les
#      migrations à son démarrage (prisma migrate deploy, voir docker-compose.prod.yml) ;
#   3. attend que l'API et le front répondent, sinon échoue en affichant leurs logs.
#
# Pas de retour arrière automatique : les migrations ont pu avancer le schéma, et une ancienne
# version de l'API sur un schéma plus récent est plus risquée qu'une panne franche. En cas d'échec,
# corriger et redéployer, ou restaurer la sauvegarde prise à l'étape 1.

set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR=backups
BACKUPS_KEPT=14
HEALTH_TIMEOUT=120 # secondes

step() { printf '\n▶ %s\n' "$*"; }
fail() { printf '\n✗ %s\n' "$*" >&2; exit 1; }

[ -f .env ] || fail ".env absent dans $(pwd) — à créer une fois sur le serveur (voir README, « Déploiement »)."
grep -q '^DOMAIN=' .env || fail "DOMAIN manquant dans .env (utilisé par Traefik pour router le domaine)."

step "Version $(git rev-parse --short HEAD) — $(git log -1 --format=%s)"

# ── 1. Sauvegarde ────────────────────────────────────────────
# Seulement si la base tourne déjà (premier déploiement : rien à sauvegarder). Les identifiants
# sont lus DANS le conteneur, comme PostgreSQL les connaît : pas de .env à analyser ici.
if docker ps --format '{{.Names}}' | grep -qx abyss2_postgres; then
  step "Sauvegarde de la base"
  mkdir -p "$BACKUP_DIR"
  backup="$BACKUP_DIR/abyss2-$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD).sql.gz"
  docker exec abyss2_postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$backup"
  [ -s "$backup" ] || fail "sauvegarde vide ($backup) — déploiement interrompu, rien n'a été modifié."
  echo "  $backup ($(du -h "$backup" | cut -f1))"
  # Garde les plus récentes seulement (noms horodatés : l'ordre alphabétique est chronologique).
  find "$BACKUP_DIR" -maxdepth 1 -name 'abyss2-*.sql.gz' | sort -r | tail -n +$((BACKUPS_KEPT + 1)) | xargs -r rm --
else
  step "Base pas encore démarrée — premier déploiement, pas de sauvegarde"
fi

# ── 2. Build + relance ───────────────────────────────────────
step "Build et relance de la pile de production"
make --no-print-directory up-prod

# ── 3. Santé ─────────────────────────────────────────────────
step "Attente de l'API et du front (${HEALTH_TIMEOUT}s max)"
healthy() {
  [ "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' abyss2_api 2>/dev/null)" = healthy ] &&
    docker exec abyss2_frontend wget -q --spider http://127.0.0.1/ 2>/dev/null
}

deadline=$((SECONDS + HEALTH_TIMEOUT))
until healthy; do
  if [ $SECONDS -ge $deadline ]; then
    # `docker logs` par nom de conteneur : ne dépend pas du nom de projet Compose (dossier).
    echo "--- logs API ---";   docker logs --tail 60 abyss2_api      2>&1 || true
    echo "--- logs front ---"; docker logs --tail 20 abyss2_frontend 2>&1 || true
    fail "l'API ou le front ne répond pas après ${HEALTH_TIMEOUT}s."
  fi
  sleep 3
done

# Images des versions précédentes, devenues orphelines après le rebuild.
docker image prune -f >/dev/null

printf '\n✓ Déployé : %s sur https://%s\n' "$(git rev-parse --short HEAD)" "$(grep '^DOMAIN=' .env | cut -d= -f2)"
