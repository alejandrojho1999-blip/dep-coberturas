# Deploy en Render

Fecha: 2026-05-27

## Servicios

El archivo `render.yaml` de la raiz define dos servicios si tienes acceso a Blueprints:

- `dep-coberturas`: frontend Next.js.
- `ergo-quant-api`: backend FastAPI privado en `ergo-quant-api/`.

Modo manual/free:
- Si no puedes crear Blueprints o private services, crea dos Web Services manuales.
- `dep-coberturas` es el frontend publico y debe usar la raiz del repo.
- `ergo-quant-api` es el backend publico protegido con `X-API-Key` y debe usar `ergo-quant-api` como root directory.
- En modo manual, `ERGO_QUANT_API_URL` y `ERGO_QUANT_API_KEY` se configuran a mano en el frontend.

Importante para no abrir el servicio equivocado:
- El deploy de la aplicacion completa se hace desde el `render.yaml` de la raiz del repositorio.
- No uses `ergo-quant-api/render.yaml` para publicar la app completa: ese archivo es solo para el backend.
- Si al abrir la URL ves un JSON con `service: "ergo-quant-api"`, estas abriendo el backend. La URL correcta del login es la del servicio `dep-coberturas`.

Con Blueprint, el backend queda como private service de Render y tambien protegido con `X-API-Key`. Sin Blueprint, el backend queda publico, pero las rutas de negocio siguen protegidas por `X-API-Key`.

## Deploy manual en Render

### Opcion A: un solo Web Service

Usa esta opcion si quieres mantener frontend y backend en un unico servicio Render.

Crear un Web Service desde la raiz del repo:

```text
Name: dep-coberturas
Runtime: Node
Root Directory: dejar vacio / raiz del repo
Build Command: npm ci && npm run build && cd ergo-quant-api && pip install -r requirements.txt
Start Command: bash scripts/render-start-single.sh
```

Variables:

```text
NODE_VERSION=22
PYTHON_VERSION=3.11.11
NEXT_PUBLIC_SUPABASE_URL=<supabase project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase anon key>
OPENROUTER_API_KEY=<openrouter key>
FRED_API_KEY=<fred key>
API_KEY=<un secreto largo generado por ti>
ERGO_QUANT_API_KEY=<mismo valor que API_KEY>
ERGO_QUANT_API_URL=http://127.0.0.1:8000
CORS_ORIGINS=https://<este-mismo-servicio>.onrender.com,http://localhost:3000
```

En esta opcion, la URL publica del servicio debe mostrar el frontend. FastAPI no queda expuesto publicamente; solo escucha dentro del contenedor en `127.0.0.1:8000`.

### Opcion B: dos Web Services

Usa esta opcion si quieres separar frontend y backend manualmente.

### 1. Backend `ergo-quant-api`

Crear un Web Service:

```text
Name: ergo-quant-api
Runtime: Python
Root Directory: ergo-quant-api
Build Command: pip install -r requirements.txt
Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
```

Variables:

```text
PYTHON_VERSION=3.11.11
FRED_API_KEY=<fred key>
OPENROUTER_API_KEY=<openrouter key>
API_KEY=<un secreto largo generado por ti>
CORS_ORIGINS=https://<frontend-service>.onrender.com,http://localhost:3000
```

Despues de crear el backend, guarda su URL publica, por ejemplo:

```text
https://ergo-quant-api.onrender.com
```

### 2. Frontend `dep-coberturas`

Crear otro Web Service:

```text
Name: dep-coberturas
Runtime: Node
Root Directory: dejar vacio / raiz del repo
Build Command: npm ci && npm run build
Start Command: npm run start
```

Variables:

```text
NODE_VERSION=22
NEXT_PUBLIC_SUPABASE_URL=<supabase project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase anon key>
OPENROUTER_API_KEY=<openrouter key>
FRED_API_KEY=<fred key>
ERGO_QUANT_API_URL=https://<backend-service>.onrender.com
ERGO_QUANT_API_KEY=<mismo valor que API_KEY del backend>
```

La URL que muestra el login es la del frontend `dep-coberturas`.

## Variables del frontend `dep-coberturas`

Configurar en Render:

```text
NODE_VERSION=22
NEXT_PUBLIC_SUPABASE_URL=<supabase project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase anon key>
OPENROUTER_API_KEY=<openrouter key>
FRED_API_KEY=<fred key>
ERGO_QUANT_API_URL=<url del backend ergo-quant-api>
ERGO_QUANT_API_KEY=<mismo valor que API_KEY del backend>
```

Notas:
- `NEXT_PUBLIC_*` se inyecta en el bundle durante `npm run build`; si cambia, redeploy del frontend.
- Si se usa el Blueprint, `ERGO_QUANT_API_URL` y `ERGO_QUANT_API_KEY` pueden venir de `fromService`. En deploy manual se completan a mano.

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
- En deploy manual, `API_KEY` debe ser un secreto largo creado por ti y debe coincidir con `ERGO_QUANT_API_KEY` en el frontend.
- `CORS_ORIGINS` acepta multiples origenes separados por coma.
- `/health` queda sin API key.
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

- Crear ambos servicios desde el Blueprint `render.yaml` de la raiz, o manualmente si no tienes Blueprint/private services.
- Verificar que Render haya creado un servicio web Node llamado `dep-coberturas`; esa es la URL publica que debe mostrar el login.
- Configurar todas las variables `sync: false` en Render.
- Confirmar que `API_KEY` existe en el backend.
- Confirmar que `ERGO_QUANT_API_URL` del frontend apunta a la URL publica del backend en deploy manual, o viene de `fromService` en Blueprint.
- Confirmar que `ERGO_QUANT_API_KEY` del frontend tiene el mismo valor que `API_KEY` del backend.
- Confirmar que `CORS_ORIGINS` incluye el dominio final del frontend Render.
- Aplicar migraciones Supabase.
- Ejecutar `npm run build`.
- Probar login, dashboard, informes y llamadas a `/api/ergos-quant/*`.

## Verificacion rapida post-deploy

Abrir el frontend Render y probar una pantalla que use `/api/ergos-quant/*`. El backend es privado, por lo que no tendra URL publica para `curl` desde internet si se usa el Blueprint raiz.

En deploy manual, el backend si tiene URL publica. Abrir esa URL debe mostrar `service: "ergo-quant-api"`; eso solo confirma que abriste la API, no el login.
