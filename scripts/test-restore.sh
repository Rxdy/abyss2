#!/usr/bin/env bash
#
# Vérifie qu'une sauvegarde se restaure : pg_dump de la base courante → base
# vierge construite par `prisma migrate deploy` → chargement des données → mêmes
# tests SQL que sur la base d'origine (make test-db).
#
#   make test-restore
#
# La base temporaire est supprimée à la fin, succès ou échec. La base courante
# n'est jamais modifiée (pg_dump ne fait que lire).

set -euo pipefail
cd "$(dirname "$0")/.."

set -a; source .env; set +a   # DB_USER, DB_NAME
COMPOSE="docker compose -f docker-compose.yml --env-file .env"
TMP="abyss2_restore_check"
DUMP="$(mktemp)"

pg()  { $COMPOSE exec -T postgres psql -v ON_ERROR_STOP=1 -q -U "$DB_USER" "$@"; }
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

cleanup() { rm -f "$DUMP"; pg -d postgres -c "DROP DATABASE IF EXISTS $TMP" >/dev/null 2>&1 || true; }
trap cleanup EXIT

say "1/5  Base vierge « $TMP » construite par les migrations Prisma"
pg -d postgres -c "DROP DATABASE IF EXISTS $TMP" -c "CREATE DATABASE $TMP" >/dev/null
$COMPOSE exec -T -e TMP_DB="$TMP" -e ORIGINAL_DB="$DB_NAME" api sh -c \
  'DATABASE_URL="$(printf %s "$DATABASE_URL" | sed "s#/$ORIGINAL_DB?#/$TMP_DB?#")" npx prisma migrate deploy' >/dev/null

say "2/5  Sauvegarde de « $DB_NAME » (pg_dump, données seules)"
$COMPOSE exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --schema=dbo --data-only --disable-triggers > "$DUMP"
echo "     $(wc -l < "$DUMP") lignes de SQL"

say "3/5  Restauration dans « $TMP »"
pg -d "$TMP" < "$DUMP" >/dev/null

say "4/5  Comparaison des volumes (base d'origine ↔ base restaurée)"
COUNTS="SELECT 'users', count(*) FROM dbo.users UNION ALL SELECT 'categories', count(*) FROM dbo.categories
        UNION ALL SELECT 'transactions', count(*) FROM dbo.transactions UNION ALL SELECT 'recurring_transactions', count(*) FROM dbo.recurring_transactions ORDER BY 1"
ORIGINAL="$(pg -d "$DB_NAME" -At -c "$COUNTS")"
RESTORED="$(pg -d "$TMP" -At -c "$COUNTS")"
paste -d' ' <(echo "$ORIGINAL") <(echo "$RESTORED" | cut -d'|' -f2) | awk -F'[| ]' '{ printf "     %-24s %6s → %s\n", $1, $2, $3 }'
if [ "$ORIGINAL" != "$RESTORED" ]; then echo "✗ Les volumes diffèrent après restauration." >&2; exit 1; fi

say "5/5  Tests SQL sur la base restaurée"
$COMPOSE exec -T -e TMP_DB="$TMP" -e ORIGINAL_DB="$DB_NAME" api sh -c \
  'DATABASE_URL="$(printf %s "$DATABASE_URL" | sed "s#/$ORIGINAL_DB?#/$TMP_DB?#")" npm run --silent test:db'

say "✓ Sauvegarde restaurable, données identiques, tests verts."
