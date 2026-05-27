# Auditoria de seguridad y preparacion para Render

Fecha: 2026-05-27

## Resumen

Primera revision de seguridad de la aplicacion antes de aplicar fixes. El objetivo fue identificar riesgos reales en autenticacion, Supabase/RLS, rutas API, backend FastAPI, dependencias y despliegue en Render.

Actualizacion posterior: se aplicaron correcciones de preparacion para Render en `render.yaml`, `ergo-quant-api/main.py`, `src/app/api/ergos-quant/[...path]/route.ts`, `src/app/api/causal/ir-extract/route.ts` y `supabase/migrations/016_lock_down_informes_history_rls.sql`.

## Hallazgos criticos

### 1. RLS demasiado permisivo en `informes_history`

Archivos:
- `supabase/migrations/009_informes_multiuser.sql`
- `supabase/migrations/013_informes_fixes.sql`

Problema:
- La migracion `009` crea una policy que permite a cualquier usuario autenticado leer todo `informes_history`.
- La migracion `013` permite UPDATE a cualquier usuario autenticado.
- Aunque algunas rutas filtran por `user_id`, la base de datos queda demasiado abierta como ultima linea de defensa.

Riesgo:
- Exposicion de informes de otros usuarios.
- Posible modificacion cruzada de datos si alguna query futura no filtra correctamente.

Prioridad:
- Alta.

Recomendacion:
- Restaurar RLS por propietario: `auth.uid() = user_id`.
- Si se necesita rol admin, implementarlo con claims, tabla de perfiles/roles o una funcion segura, no con `auth.uid() IS NOT NULL`.

### 2. Backend FastAPI sin autenticacion real

Archivos:
- `ergo-quant-api/main.py`
- `ergo-quant-api/render.yaml`
- `src/app/api/ergos-quant/[...path]/route.ts`

Problema:
- El proxy Next envia `X-API-Key` si existe `ERGO_QUANT_API_KEY`.
- El backend declara `API_KEY` en Render, pero no valida ningun header.
- Los routers de FastAPI quedan accesibles si la URL de Render es publica.

Riesgo:
- Cualquiera podria ejecutar endpoints pesados de causal/portfolio/signals.
- Cualquiera podria leer, insertar o borrar configs in-memory en `/configs`.
- Coste y DoS por computo intensivo.

Prioridad:
- Alta.

Recomendacion:
- Agregar dependency global en FastAPI que valide `X-API-Key`.
- Dejar `/health` sin auth solo si Render lo necesita.
- Rotar la key si ya fue expuesta.

### 3. Endpoint `ir-extract` permite uso no autenticado y SSRF parcial

Archivo:
- `src/app/api/causal/ir-extract/route.ts`

Problema:
- La ruta llama `supabase.auth.getUser()`, pero no retorna `401` si no hay usuario.
- Acepta `irUrl` del body y hace `fetch(irUrl)`.
- Puede consumir OpenRouter si hay `OPENROUTER_API_KEY`.

Riesgo:
- Consumo de API/LLM por usuarios anonimos.
- SSRF hacia destinos no previstos si se envia una URL interna o privada.
- Retorna `irContent`, que puede exponer contenido descargado desde una URL arbitraria.

Prioridad:
- Alta.

Recomendacion:
- Exigir usuario autenticado al inicio.
- Validar protocolo `https:`.
- Bloquear IPs privadas, localhost y metadatos cloud.
- Limitar dominios o aceptar solo URLs derivadas de `ir-discover`.
- No devolver `irContent` completo al cliente.

## Hallazgos altos/medios

### 4. Rutas publicas consumen APIs externas o computo pesado

Rutas observadas:
- `src/app/api/cfds/market-analysis/route.ts`
- `src/app/api/cfds/analysis/route.ts`
- `src/app/api/peter-lynch/screen/route.ts`
- `src/app/api/faros/analyze/route.ts`
- `src/app/api/options/analyze/route.ts`
- `src/app/api/market/quotes/route.ts`
- `src/app/api/informes/search/route.ts`
- `src/app/api/causal/search/route.ts`
- `src/app/api/causal/ir-discover/route.ts`
- `src/app/api/informes/live-prices/route.ts`

Problema:
- Varias rutas no verifican usuario.
- Algunas llaman Yahoo Finance o ejecutan analisis pesado.
- No hay rate limiting centralizado.

Riesgo:
- Uso abusivo por bots.
- Bloqueos/rate limit de Yahoo.
- Coste y degradacion del servicio en Render.

Prioridad:
- Media/alta segun si deben ser publicas.

Recomendacion:
- Definir cuales endpoints son publicos.
- Para endpoints privados, usar helper comun `requireUser()`.
- Para endpoints publicos, agregar rate limiting y caching defensivo.

### 5. Dependencias vulnerables

Comando ejecutado:

```bash
npm audit --audit-level=moderate
```

Resultado:
- 13 vulnerabilidades: 5 high, 8 moderate.

Principales:
- `next@16.2.1`: multiples advisories high; fix sugerido por npm a `16.2.6`.
- `mathjs@15.1.1`: high.
- `xlsx`: high, sin fix disponible.
- `vite`: high.
- `fast-uri`, `hono`, `postcss`, `ws`, `qs`, `brace-expansion`, `ip-address`: moderate/high.

Riesgo:
- DoS, XSS, path traversal, prototype pollution y otras clases segun paquete.

Prioridad:
- Alta para `next`, `mathjs`, `xlsx`.

Recomendacion:
- Subir Next a version parcheada compatible.
- Actualizar dependencias con `npm audit fix` revisando diff.
- Reemplazar o aislar uso de `xlsx`; si no se reemplaza, limitar tamano, tipos y parsing, y considerar procesamiento fuera del proceso principal.

### 6. Admins hardcodeados por email

Archivos:
- `src/app/api/informes/history/route.ts`
- `src/app/api/informes/redownload/route.ts`

Problema:
- La autorizacion admin depende de una lista hardcodeada de emails.

Riesgo:
- Dificil auditoria y rotacion.
- Cambios de permisos requieren deploy.
- No hay fuente central de roles.

Prioridad:
- Media.

Recomendacion:
- Usar tabla `profiles` con rol o custom claims.
- Centralizar helper `isAdmin(user)`.

## Riesgos de despliegue en Render

### 7. Config Render incompleta

Archivo:
- `ergo-quant-api/render.yaml`

Problema:
- Solo existe config para el servicio Python.
- No hay `render.yaml` raiz para frontend Next.
- CORS de FastAPI apunta a Vercel y localhost, no a dominio Render final.

Riesgo:
- Despliegue inconsistente.
- CORS roto o demasiado permisivo al intentar arreglarlo rapido.
- Variables no documentadas para ambos servicios.

Prioridad:
- Media/alta antes de produccion.

Recomendacion:
- Definir dos servicios Render:
  - Web service Next.
  - Web service FastAPI.
- Configurar variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `OPENROUTER_API_KEY`
  - `FRED_API_KEY`
  - `ERGO_QUANT_API_URL`
  - `ERGO_QUANT_API_KEY`
  - `API_KEY`
- Alinear `ERGO_QUANT_API_KEY` del frontend con `API_KEY` del backend.
- Actualizar CORS con el dominio real del frontend en Render.

## Verificaciones ejecutadas

### `npm audit`

Estado:
- Falla porque encontro vulnerabilidades.
- Se ejecuto con red aprobada.

Nota:
- `npm audit` modifico `package-lock.json` agregando metadata opcional de Tailwind/oxide. No fue una correccion aplicada manualmente.

### `npm run lint`

Estado:
- Falla.

Resumen:
- 24 errores y 13 warnings.
- Errores principales: `no-explicit-any`, reglas React hooks `set-state-in-effect`, imports/variables sin uso.

Impacto:
- El repo no esta listo para CI estricto hasta resolver estos errores.

## Plan recomendado de correccion

1. Corregir RLS de `informes_history`.
2. Agregar autenticacion `X-API-Key` obligatoria en FastAPI.
3. Exigir auth en endpoints privados y rate limit en endpoints publicos.
4. Endurecer `ir-extract` contra SSRF y uso anonimo.
5. Actualizar dependencias vulnerables.
6. Definir despliegue Render completo para frontend y backend.
7. Resolver lint y agregar tests de seguridad para RLS/API auth.

## Estado actual

La foto inicial de riesgos queda documentada arriba. La primera fase de correccion dejo listo el Blueprint de Render, backend privado con API key, proxy interno endurecido, migracion RLS y cierre basico de `ir-extract`.
