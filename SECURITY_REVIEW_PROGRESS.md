# Security Review Progress

## Completado
- Revisada configuracion base de Next, Supabase, proxy y backend FastAPI.
- Revisadas rutas API principales, migraciones RLS y configuracion de Render del servicio Python.
- Ejecutado `npm audit --audit-level=moderate`: reporta 13 vulnerabilidades, 5 high y 8 moderate.
- Ejecutado `npm run lint`: falla por errores existentes de lint/React hooks y `any`.
- Agregado `render.yaml` raiz con frontend Next y backend FastAPI privado.
- Agregada autenticacion `X-API-Key` al backend FastAPI.
- Cerrado proxy Next para exigir `ERGO_QUANT_API_KEY` y usar red privada de Render.
- Agregada migracion `016_lock_down_informes_history_rls.sql`.
- Endurecido `ir-extract` para exigir usuario y bloquear URLs internas/no HTTPS.
- Fijado Python del backend Render en `3.11.11` para compatibilidad con `dowhy`/`econml`.
- Agregada respuesta raiz en FastAPI para distinguir backend de frontend durante el deploy en Render.
- Documentado deploy manual/free de Render con dos Web Services y variables `ERGO_QUANT_API_URL`/`ERGO_QUANT_API_KEY` configuradas a mano.
- Diagnosticado que el JSON `service: "ergo-quant-api"` indica que se abrio la URL del backend Render, no la del frontend `dep-coberturas`.
- Revisada la lista de variables de entorno requeridas para Render; no hay `.env*` visible en la raiz local.
- Agregado `scripts/render-start-single.sh` para desplegar frontend Next y backend FastAPI en un unico Web Service Render.
- Documentada la opcion manual de un solo Web Service con `ERGO_QUANT_API_URL=http://127.0.0.1:8000`.
- Agregados `.python-version` y `runtime.txt` en la raiz para que el servicio unico Render use Python `3.11.11` al instalar dependencias del backend.

## En progreso
- Resolver vulnerabilidades de dependencias y errores de lint existentes.

## Pendiente
- Proteger o rate-limitear endpoints Next publicos que consumen APIs externas o computo pesado.
- Actualizar dependencias vulnerables y decidir reemplazo o mitigacion para `xlsx`.
- Configurar variables `sync: false` en Render y aplicar migraciones Supabase.
- Verificar en Render que exista un servicio Node publico `dep-coberturas` creado desde la raiz del repo y abrir esa URL para login/dashboard.
- Cargar en Render las variables requeridas del frontend y backend antes de redeploy.
- Si se usa un solo Web Service, actualizar Build Command y Start Command en Render segun `DEPLOY_RENDER.md`.
- Tras cambiar version de Python en Render, ejecutar "Clear build cache & deploy".

## Decisiones tomadas
- El backend se deja como private service en el Blueprint raiz; no debe exponerse publicamente salvo necesidad explicita.
- No se leyeron archivos `.env*`; solo se verifico que no hay archivos `.env*` visibles en la raiz.
