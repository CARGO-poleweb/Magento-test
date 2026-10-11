#!/usr/bin/env bash
# Déploiement Fly.io en une fois. Usage : ./deploy-fly.sh mon-nom-d-app [clé-api-anthropic]
# Prérequis : flyctl installé (https://fly.io/docs/flyctl/install/) et `fly auth login` effectué.
set -euo pipefail
APP="${1:?Donne un nom d'application, ex. ./deploy-fly.sh garde-manger-pierre}"
KEY="${2:-}"
cd "$(dirname "$0")"
sed -i.bak "s/^app = .*/app = \"$APP\"/" fly.toml && rm -f fly.toml.bak
fly apps list 2>/dev/null | grep -q "^$APP\b" || fly apps create "$APP"
fly volumes list -a "$APP" 2>/dev/null | grep -q " data " || fly volumes create data --app "$APP" --region cdg --size 1 --yes
if [ -n "$KEY" ]; then fly secrets set --app "$APP" ANTHROPIC_API_KEY="$KEY" --stage; fi
fly deploy --app "$APP" --ha=false
echo
echo "C'est en ligne : https://$APP.fly.dev  — ouvre l'adresse et crée ton compte."
