#!/usr/bin/env bash
# Comprueba si el archivo diario de cadenas de opciones capturo de verdad.
#
# El workflow se dispara solo a las 21:15 UTC, dentro de la ventana de captura
# (16:00-19:00 de Nueva York). Que el job salga verde no basta: la guarda de
# calendario responde 200 con `ejecutado:false` fuera de la ventana, asi que lo
# unico que demuestra que el camino completo funciona es que aparezcan filas en
# `options_chain_snapshots`.
#
# Deja el informe en un fichero porque este script corre desde cron, sin nadie
# delante. Se borra a si mismo del crontab al terminar: es una comprobacion
# puntual, no una tarea recurrente.

set -uo pipefail
cd /var/www/dep-coberturas || exit 1

INFORME=/var/www/dep-coberturas/INFORME-ARCHIVO-CADENAS.md
MARCA='verificar-archivo-cadenas'

set -a
. ./.env.local 2>/dev/null
set +a

{
  echo "# Verificación del archivo de cadenas"
  echo
  echo "Generado: $(date -u '+%Y-%m-%d %H:%M UTC') · $(TZ=America/New_York date '+%H:%M ET')"
  echo

  echo "## Última ejecución del workflow"
  echo '```'
  gh run list --workflow=archive-chains.yml --limit 3 \
    --json createdAt,conclusion \
    --jq '.[]|"\(.createdAt[0:16])  \(.conclusion // "en curso")"' 2>&1
  echo '```'
  echo

  echo "## Respuesta del endpoint"
  ID=$(gh run list --workflow=archive-chains.yml --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null)
  if [ -n "${ID:-}" ]; then
    JOB=$(gh api "repos/alejandrojho1999-blip/dep-coberturas/actions/runs/$ID/jobs" --jq '.jobs[0].id' 2>/dev/null)
    echo '```json'
    gh api "repos/alejandrojho1999-blip/dep-coberturas/actions/jobs/$JOB/logs" 2>/dev/null \
      | sed -e 's/\x1b\[[0-9;]*m//g' | grep -oE '\{"ejecutado".*' | tail -1
    echo '```'
  else
    echo "No se pudo leer la ejecución."
  fi
  echo

  echo "## Filas en options_chain_snapshots"
  FILAS=$(curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/options_chain_snapshots?select=id" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Prefer: count=exact" -I 2>/dev/null | grep -i content-range | tr -d '\r')
  echo "\`$FILAS\`"
  echo
  TOTAL=$(echo "$FILAS" | sed -E 's|.*/||')
  if [ "${TOTAL:-0}" -gt 0 ] 2>/dev/null; then
    echo "**VERIFICADO**: la captura escribió $TOTAL filas. El camino completo funciona."
  else
    echo "**SIGUE SIN CAPTURAR**: la tabla continúa vacía. Revisar la respuesta de arriba:"
    echo "si dice \`fuera-de-ventana\` es horario; si dice otra cosa, es un fallo real."
  fi
} > "$INFORME" 2>&1

# Quitarse del crontab: esta comprobación era para una noche concreta.
crontab -l 2>/dev/null | grep -v "$MARCA" | crontab - 2>/dev/null
