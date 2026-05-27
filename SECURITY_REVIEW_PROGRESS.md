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
- Cambiado `ergo-quant-api/render.yaml` a private service y documentado que el Blueprint principal es el `render.yaml` raiz.

## En progreso
- Resolver vulnerabilidades de dependencias y errores de lint existentes.

## Pendiente
- Proteger o rate-limitear endpoints Next publicos que consumen APIs externas o computo pesado.
- Actualizar dependencias vulnerables y decidir reemplazo o mitigacion para `xlsx`.
- Configurar variables `sync: false` en Render y aplicar migraciones Supabase.

## Decisiones tomadas
- El backend se deja como private service en el Blueprint raiz; no debe exponerse publicamente salvo necesidad explicita.
- No se leyeron archivos `.env*`; solo se verifico que no hay archivos `.env*` visibles en la raiz.
