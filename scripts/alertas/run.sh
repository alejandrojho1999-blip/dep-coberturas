#!/usr/bin/env bash
# Envoltorio para el cron.
#
# El cron arranca con un PATH mínimo y sin el shell del usuario, así que node no
# está en él: la ruta de nvm se fija aquí y no en cada línea del crontab. Todo
# lo demás lo resuelve npm desde el directorio del proyecto.
#
# Uso: run.sh <guerra|macro|snapshot|calendario|prueba|diagnostico> [--dry-run]
set -euo pipefail

export PATH="/root/.nvm/versions/node/v22.22.0/bin:$PATH"
cd "$(dirname "$0")/../.."

exec npm run --silent alertas -- "$@"
