#!/usr/bin/env bash
#
# (Re)déploie Abyss sur le serveur de production (meliodas), à la main.
#
#   ./scripts/deploy.sh          (ou : make deploy)
#
# Le déploiement courant n'a pas besoin de ce script : après chaque merge sur main, la CI publie
# les images sur GHCR (job « images ») et watchtower, déjà en place sur le Pi, les installe dans
# les 5 minutes. Ce script sert au premier déploiement, après un changement de docker-compose*.yml
# ou de .env, ou pour forcer une mise à jour sans attendre :
#
#   1. sauvegarde la base (scripts/backup.sh) ;
#   2. télécharge les images publiées et relance la pile (make up-prod) — RIEN n'est construit sur
#      le serveur ; l'API applique les migrations à son démarrage (prisma migrate deploy) ;
#   3. attend que l'API et le front répondent, sinon échoue en affichant leurs logs.
#
# Pas de retour arrière automatique : les migrations ont pu avancer le schéma, et une ancienne
# version de l'API sur un schéma plus récent est plus risquée qu'une panne franche. En cas d'échec,
# corriger et redéployer, ou restaurer la sauvegarde prise à l'étape 1.

set -euo pipefail

cd "$(dirname "$0")/.."

HEALTH_TIMEOUT=180 # secondes

step() { printf '\n▶ %s\n' "$*"; }
fail() { printf '\n✗ %s\n' "$*" >&2; exit 1; }

[ -f .env ] || fail ".env absent dans $(pwd) — à créer une fois sur le serveur (voir README, « Déploiement continu »)."
grep -q '^DOMAIN=' .env || fail "DOMAIN manquant dans .env (utilisé par Traefik pour router le domaine)."

# ── 1. Sauvegarde ────────────────────────────────────────────
step "Sauvegarde de la base"
./scripts/backup.sh || fail "sauvegarde impossible — déploiement interrompu, rien n'a été modifié."

# ── 2. Images + relance ──────────────────────────────────────
step "Téléchargement des images et relance"
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

# Images des versions précédentes, devenues orphelines après la mise à jour.
docker image prune -f >/dev/null

printf '\n✓ Déployé : %s sur https://%s\n' \
  "$(docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' abyss2_api 2>/dev/null | cut -c1-7)" \
  "$(grep '^DOMAIN=' .env | cut -d= -f2)"
