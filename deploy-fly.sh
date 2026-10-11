#!/usr/bin/env bash
# Deploiement Fly.io en une fois. Usage : ./deploy-fly.sh mon-nom-d-app [cle-api-anthropic]
set -euo pipefail
APP="${1:?Indique un nom, ex. ./deploy-fly.sh garde-manger-pierre}"
KEY="${2:-}"
cd "$(dirname "$0")"
sed -i.bak "s/^app = .*/app = \"$APP\"/" fly.toml && rm -f fly.toml.bak
fly apps create "$APP" 2>/dev/null || echo "Application $APP deja creee, on continue."
fly volumes list -a "$APP" 2>/dev/null | grep -q " data " || fly volumes create data --app "$APP" --region cdg --size 1 --yes
if [ -n "$KEY" ]; then fly secrets set --app "$APP" ANTHROPIC_API_KEY="$KEY" --stage; fi
fly deploy --app "$APP" --ha=false
echo
echo "En ligne : https://$APP.fly.dev  (ouvre cette adresse et cree ton compte)"
