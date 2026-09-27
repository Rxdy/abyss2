#!/usr/bin/env bash
#
# Sauvegarde la base de production : pg_dump compressé dans backups/, les 14 plus récentes gardées.
#
#   ./scripts/backup.sh          (ou : make backup)
#
# Appelé par scripts/deploy.sh avant chaque déploiement manuel, et chaque nuit par cron sur le
# serveur (voir README, « Déploiement continu ») : les mises à jour d'images faites par watchtower
# ne passent pas par deploy.sh, c'est cette sauvegarde quotidienne qui les couvre.
#
# Sans effet (et sans erreur) si la base ne tourne pas encore — premier déploiement.

set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR=backups
BACKUPS_KEPT=14

if ! docker ps --format '{{.Names}}' | grep -qx abyss2_postgres; then
  echo "Base pas encore démarrée — rien à sauvegarder."
  exit 0
fi

mkdir -p "$BACKUP_DIR"
backup="$BACKUP_DIR/abyss-$(date -u +%Y%m%d-%H%M%S).sql.gz"

# Identifiants lus DANS le conteneur, comme PostgreSQL les connaît : pas de .env à analyser ici.
docker exec abyss2_postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$backup"
if [ ! -s "$backup" ]; then
  rm -f "$backup"
  echo "✗ sauvegarde vide — pg_dump a échoué." >&2
  exit 1
fi
echo "$backup ($(du -h "$backup" | cut -f1))"

# Garde les plus récentes seulement (noms horodatés : l'ordre alphabétique est chronologique).
find "$BACKUP_DIR" -maxdepth 1 -name 'abyss-*.sql.gz' | sort -r | tail -n +$((BACKUPS_KEPT + 1)) | xargs -r rm --
