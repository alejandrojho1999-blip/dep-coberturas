# Deploy en Render

Fecha: 2026-05-27

## Servicios

El archivo `render.yaml` de la raiz define dos servicios:

- `dep-coberturas`: frontend Next.js.
- `ergo-quant-api`: backend FastAPI privado en `ergo-quant-api/`.

Importante:
- El deploy de la aplicacion completa se hace desde el `render.yaml` de la raiz del repositorio.
- No uses `ergo-quant-api/render.yaml` para publicar la app: ese archivo es solo para el backend.
- Si al abrir la URL ves un JSON con `service: "ergo-quant-api"`, estas abriendo el backend. La URL correcta del login es la del servicio `dep-coberturas`.

El backend queda como private service de Render y tambien protegido con `X-API-Key`. El frontend recibe `ERGO_QUANT_API_URL` y `ERGO_QUANT_API_KEY` desde `fromService` en el Blueprint.

## Variables del frontend `dep-coberturas`

Configurar en Render:

```text
NODE_VERSION=22
NEXT_PUBLIC_SUPABASE_URL=<supabase project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase anon key>
OPENROUTER_API_KEY=<openrouter key>
FRED_API_KEY=<fred key>
ERGO_QUANT_API_URL=<generada por fromService: ergo-quant-api hostport>
ERGO_QUANT_API_KEY=<generada desde API_KEY del backend>
```

Notas:
- `NEXT_PUBLIC_*` se inyecta en el bundle durante `npm run build`; si cambia, redeploy del frontend.
- Si se usa el Blueprint, no completar manualmente `ERGO_QUANT_API_URL` ni `ERGO_QUANT_API_KEY`.

## Variables del backend `ergo-quant-api`

Configurar en Render:

```text
PYTHON_VERSION=3.11.11
FRED_API_KEY=<fred key>
OPENROUTER_API_KEY=<openrouter key>
API_KEY=<generada por Render>
CORS_ORIGINS=https://<frontend-service>.onrender.com,http://localhost:3000
```

Notas:
- `PYTHON_VERSION` debe quedarse en Python 3.11.x porque `dowhy`/`econml` no resuelven correctamente con el default actual de Render ni con Python 3.12+ en este proyecto.
- `API_KEY` se genera automaticamente con `generateValue: true`.
- `CORS_ORIGINS` acepta multiples origenes separados por coma.
- `/health` queda sin API key, pero el servicio es privado si se despliega desde el Blueprint raiz.
- El resto de routers exige `X-API-Key`.

## Build y start

Frontend:

```bash
npm ci && npm run build
npm run start
```

Backend:

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port $PORT
```

## Supabase antes de produccion

Aplicar migraciones pendientes, especialmente:

```text
supabase/migrations/016_lock_down_informes_history_rls.sql
```

Esta migracion cierra las policies amplias de `informes_history` y mantiene acceso por propietario o admin.

## Checklist previo al deploy

- Crear ambos servicios desde el Blueprint `render.yaml` de la raiz.
- Verificar que Render haya creado un servicio web Node llamado `dep-coberturas`; esa es la URL publica que debe mostrar el login.
- Configurar todas las variables `sync: false` en Render.
- Confirmar que `API_KEY` fue generada en el backend.
- Confirmar que `ERGO_QUANT_API_URL` del frontend viene de `fromService` y apunta a `ergo-quant-api`.
- Confirmar que `CORS_ORIGINS` incluye el dominio final del frontend Render.
- Aplicar migraciones Supabase.
- Ejecutar `npm run build`.
- Probar login, dashboard, informes y llamadas a `/api/ergos-quant/*`.

## Verificacion rapida post-deploy

Abrir el frontend Render y probar una pantalla que use `/api/ergos-quant/*`. El backend es privado, por lo que no tendra URL publica para `curl` desde internet si se usa el Blueprint raiz.
