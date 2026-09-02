# Deploy en Render

Fecha: 2026-05-27 · Reescrito el 2026-09-02 al borrar el backend FastAPI.

> Hasta el 2026-09-02 este documento describía **dos** servicios: el frontend
> Next y un backend Python (`ergo-quant-api`) que lo acompañaba. Ese backend se
> borró junto con la sección Ergo Quant, así que el despliegue es ahora una sola
> aplicación Node y todo lo relativo a Python, `X-API-Key`, `CORS_ORIGINS` y el
> arranque combinado dejó de aplicar. La versión anterior sigue en el historial
> de git si hace falta consultarla.

## Servicio

El `render.yaml` de la raíz define un único servicio: `dep-coberturas`, el
frontend Next.js. Se puede desplegar desde el Blueprint o creando el Web
Service a mano.

```text
Name: dep-coberturas
Runtime: Node
Root Directory: dejar vacio / raiz del repo
Build Command: npm ci && npm run build
Start Command: npm run start
```

## Variables

```text
NODE_VERSION=22
NEXT_PUBLIC_SUPABASE_URL=<supabase project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase anon key>
OPENROUTER_API_KEY=<openrouter key>
FRED_API_KEY=<fred key>
```

Nota: `NEXT_PUBLIC_*` se inyecta en el bundle durante `npm run build`; si
cambia, hace falta redeploy.

Las variables del cron (`CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
`CRON_USER_ID`) viven en el despliegue de Vercel, que es el de producción. Ver
`PROGRESS.md`.

## Build y start

```bash
npm ci && npm run build
npm run start
```

## Supabase antes de produccion

Aplicar migraciones pendientes, especialmente:

```text
supabase/migrations/016_lock_down_informes_history_rls.sql
```

Esta migracion cierra las policies amplias de `informes_history` y mantiene
acceso por propietario o admin.

## Checklist previo al deploy

- Verificar que Render haya creado el servicio web Node `dep-coberturas`; esa es
  la URL publica que debe mostrar el login.
- Configurar todas las variables `sync: false` en Render.
- Aplicar migraciones Supabase.
- Ejecutar `npm run build`.
- Probar login, dashboard e informes.
