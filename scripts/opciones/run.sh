#!/usr/bin/env bash
# Envoltorio para los crons de opciones (revisión de salidas y archivo de cadenas).
#
# El cron arranca con un PATH mínimo y sin el shell del usuario, así que node no
# está en él. La versión no se escribe a mano: nvm instala cada release en su
# propio directorio y al actualizar desaparece la anterior, que es exactamente
# lo que el 2026-09-08 dejó sin binario a dos crons durante horas. Se prefiere
# la versión con la que se probó el proyecto y, si ya no está, la más reciente
# que haya.
#
# `flock` sustituye al grupo `concurrency` que daba GitHub Actions: dos
# revisiones simultáneas podrían cerrar la misma posición dos veces. Si una
# ejecución sigue viva cuando entra la siguiente, la nueva se descarta sin
# esperar, que es lo que hacía `cancel-in-progress: false`.
#
# Uso: run.sh <salidas|archivo|estado> [--forzar]
set -euo pipefail

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

TAREA="${1:-estado}"
CERROJO="/var/lock/dep-opciones-${TAREA}.lock"

# -n: si no se puede coger el cerrojo, salir en vez de encolarse. Un cron que
# espera acaba apilando procesos cuando la tarea se atasca.
exec flock -n "$CERROJO" npm run --silent opciones -- "$@"
