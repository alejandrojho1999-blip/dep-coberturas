#!/usr/bin/env bash
# Envoltorio para el cron de los agentes Peter y Small.
#
# El cron arranca con un PATH mínimo y sin el shell del usuario, así que node no
# está en él: la ruta de nvm se fija aquí y no en cada línea del crontab. Todo
# lo demás lo resuelve npm desde el directorio del proyecto.
#
# Uso: run.sh [peter|small] [--forzar|--estado]
set -euo pipefail

# La versión de Node no se escribe a mano: nvm instala cada release en su propio
# directorio y al actualizar desaparece la anterior. El 2026-09-08 la ruta fija a
# v22.22.0 dejó sin binario a dos procesos durante horas. Se prefiere la versión
# con la que se probó el proyecto y, si ya no está, la más reciente que haya.
NVM_DIR=/root/.nvm/versions/node
NODE_PREFERIDO="$NVM_DIR/v22.22.0/bin"

if [ -x "$NODE_PREFERIDO/node" ]; then
  export PATH="$NODE_PREFERIDO:$PATH"
elif [ -d "$NVM_DIR" ]; then
  ULTIMO=$(ls -1 "$NVM_DIR" 2>/dev/null | sort -Vr | while read -r v; do
    [ -x "$NVM_DIR/$v/bin/node" ] && echo "$NVM_DIR/$v/bin" && break
  done)
  [ -n "${ULTIMO:-}" ] && export PATH="$ULTIMO:$PATH"
fi
cd "$(dirname "$0")/../.."

exec npm run --silent agentes -- "$@"
