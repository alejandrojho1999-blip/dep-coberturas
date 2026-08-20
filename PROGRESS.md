# PROGRESS — Plataforma de Agentes y Estrategias Cuantitativas

> Notas de trabajo del producto. Lo relativo al despliegue en Render y a la
> auditoría de seguridad vive en `SECURITY_REVIEW_PROGRESS.md` (congelado).

## Completado

### Entorno de trabajo (sesión del 2026-08-20)
- Confirmado que esta máquina puede commitear y pushear a `main`: token `lriofrio915`
  con `push: true`, `main` sin branch protection, credenciales en `credential.helper=store`.
- Confirmado el deploy automático en Vercel sin necesitar credenciales de Vercel:
  `vercel[bot]` crea un deployment `Production` por cada push a `main`. Se verifica
  vía GitHub Deployments API.
- `.env.local` repoblado con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (proyecto Supabase `replbokusvrqdbzuhulm`). Sigue gitignored.

### Reorganización de navegación y marca
- Menú reducido y reordenado: **Agentes**, **Portafolio Quant** (`/coberturas`),
  **Recomendaciones** (`/informes`). Dashboard y ERGOS QUANT salen del menú
  (sus rutas siguen existiendo y son accesibles por URL).
- Landing tras login movido de `/dashboard` a `/agentes` (`src/app/page.tsx`,
  `login/page.tsx`, `src/proxy.ts`).
- Marca: "EQF Terminal / Sistema de Análisis de Riesgos" → **"EQF QUANT /
  Agentes y Estrategias Cuantitativas"** en TopBar, login y metadata.

### Corrección de rutas protegidas
- `src/proxy.ts` protegía tres rutas inexistentes (`/inversion-causal`,
  `/portafolios`, `/agente-ppo`) y dejaba `/agentes`, `/informes`,
  `/ergos-quant` y `/fincept-terminal` accesibles **sin sesión**. Sustituido
  por la lista real de rutas del grupo `(dashboard)`.

### Portafolio Quant (antes Coberturas)
- Eliminados los 13 componentes de pricing manual de `coberturas/_components/`
  (Black-Scholes, Greeks, CFDs, IV, FairValue, PositionBuilder, etc.).
- `CoberturasClient.tsx` queda como placeholder "Sección en construcción".
- Conservado `/api/options/analyze` y todo `src/lib/options/`: los consumen
  los agentes Gamma y Theta.

### Seguimiento en vivo de recomendaciones
- **Bug corregido:** `fetchLivePrices` solo se alimentaba de `history`, así que
  los tickers de las recomendaciones de agentes nunca se cotizaban y las columnas
  P.Actual / Rendim. / G/P / Comisión de las tablas Peter y Small Cap mostraban
  "—" de forma permanente. Ahora cotiza la unión de tickers del operador y de
  todos los agentes.
- Tope de `/api/informes/live-prices` subido de 25 a 100 tickers.
- Nuevo `src/lib/options/occ-symbol.ts`: deriva el símbolo OCC de un contrato a
  partir de ticker + vencimiento + strike + tipo. 14 tests en Vitest.
- Nuevo `POST /api/informes/option-prices`: cotiza la prima actual de cada
  contrato usando el mid bid/ask, con fallback al último cruce.
- Tablas Gamma y Theta con columnas **Prima Act.** y **Rendim.** El signo se
  invierte en Theta (`direction: 'INCOME'`), que cobra la prima al abrir y gana
  cuando esta cae.
- DTE de Theta recalculado contra la fecha actual con `daysToExpiration`
  en vez de leer el valor congelado de `ai_report`. Vencidos marcados `VENC.`
- Forecast de Gamma renombrado a "Forecast ini." para dejar claro que es del
  momento de la recomendación.

### Correcciones de la sección Recomendaciones (commit `9e9e3c5`)
- **Bug corregido — precio de entrada inventado en Agente Peter.** Tras la
  llamada a la IA el paso 4 sobrescribía `lastPrice` con
  `precio_objetivo / 1.15`, y ese valor se guardaba como `precio_entrada`. La
  división revertía el fallback de `analyze/route` (`objetivo = lastPrice * 1.15`),
  así que cuando la IA devolvía objetivo propio el número no significaba nada.
  Caso reportado: APA con objetivo $48.50 registró entrada $42.17 con el mercado
  en 44.40. `AgenteSmall` nunca tuvo este defecto.
- **Bug corregido — liquidación de opciones cableada.** Gamma marcaba siempre
  −100% al vencer y Theta siempre +100%, sin mirar el subyacente. Nuevos
  `lib/options/settlement.ts` (valor intrínseco y P&L por contrato) y
  `lib/options/settle-picks.ts` (orquestación), más
  `POST /api/informes/settlement-prices` que devuelve el cierre histórico del
  subyacente en la fecha de vencimiento. Las posiciones cerradas con el ±100%
  cableado se recalculan solas en la siguiente ejecución del agente.
- **Bug corregido — no se podía borrar un precio de venta.** El `onBlur` era
  `if (!isNaN(val))`, así que vaciar el campo no guardaba nada. Ahora un campo
  vacío guarda `null` y libera el rendimiento. Aplicado a P.Compra, P.Venta,
  Cantidad y P.Objetivo.
- **Incoherencia corregida:** la columna Rendim. de Peter y Small ignoraba
  `precio_venta` y seguía moviéndose con el mercado tras vender, al contrario
  que la columna G/P. Ahora se congela y muestra candado.
- El precio de venta de Peter y Small pasa a solo lectura: lo registra el agente
  al cerrar por deterioro de la tesis.
- Gamma y Theta: columna Rendim. sustituida por **Result. ($)** y **Result. (%)**
  con el P&L de 1 contrato (100 acciones) y tooltip con el desglose. "Forecast
  ini." gana un tooltip que aclara que es la señal de entrada, no el resultado.
  Gamma marca los vencidos con `VENC.`, como ya hacía Theta.
- `precio_objetivo` pasa a tomarse del consenso de analistas (`targetMeanPrice`),
  con la cifra de la IA en `ai_report.precio_objetivo_ia` y el origen en
  `ai_report.objetivo_fuente`. Es informativo: **no dispara ventas**.
- "Agente Small Cap" renombrado a "Agente Small" en las etiquetas visibles.

### Menú definitivo (commit `04537ed`)
Cuatro entradas, en este orden:
1. **Portafolios Quant** → `/portafolios-quant` (nueva, vacía)
2. **Agentes** → `/agentes` — *Agentes IA para Acciones y Opciones*
3. **Estrategias** → `/coberturas` — *Estrategias para Trading de Futuros*
4. **Recomendaciones** → `/informes`

- "Estrategias" **conserva la ruta `/coberturas`**: renombrar la carpeta rompería
  enlaces existentes sin ganar nada, ya que el nombre visible es lo que importa.
- `/portafolios-quant` añadida a `isProtectedRoute` en `proxy.ts`; sin ello
  quedaría accesible sin sesión.

## Pendiente

- **Definir e implementar Portafolios Quant** (`/portafolios-quant`) — sección
  vacía a la espera de su lógica.
- **Definir e implementar Estrategias** (`/coberturas`) — placeholder a la
  espera de las estrategias de trading de futuros.
- **Borrar a mano las recomendaciones de Agente Peter marcadas con
  `⚠ ENTRADA NO FIABLE`** y volver a ejecutar el agente. La tabla las señala
  sola desde el commit `fa012a3`; re-ejecutar sin borrarlas no las corrige
  porque la deduplicación las omite. Las de Agente Small sí son válidas.
- Re-ejecutar Gamma y Theta una vez para que liquiden con datos reales los
  contratos vencidos y recalculen los cerrados con el ±100% cableado.
- Verificar en producción que las primas de opciones llegan: depende de que
  Yahoo cotice los símbolos OCC construidos. Si algún contrato aparece con "—"
  de forma sistemática, revisar el formato del símbolo contra el
  `contractSymbol` que devuelve la cadena de opciones.
- Decidir qué pasa con `/dashboard` y `/ergos-quant` a medio plazo: hoy siguen
  vivas pero sin entrada de menú.
- `OPENROUTER_API_KEY` y `FRED_API_KEY` están vacías en `.env.local`. En Vercel
  sí están cargadas, pero sin ellas no se puede probar informes/agentes en local.
### Limpieza de lint (commit `d9869a5`)
- `npm run lint` queda en **0 problemas** (venía de 37).
- **Bug corregido:** los timeouts de Yahoo Finance nunca se aplicaban. Se pasaba
  `{ signal }` como tercer argumento de `quote()`/`search()`, pero ese objeto es
  `ModuleOptions` y solo reenvía a `fetch()` lo que venga en `fetchOptions`, así
  que el `AbortSignal` se descartaba en silencio. Corregido en
  `/api/options/search`, `/api/informes/live-prices` y `/api/informes/option-prices`.
- **Bug corregido:** `MarketTicker` no cancelaba la petición en curso al
  desmontar, así que una respuesta tardía escribía estado sobre un componente ya
  desmontado. Ahora `fetchQuotes` vive dentro del efecto con un flag `cancelled`.
- `Sidebar` abría el submenú de Configuración desde un efecto que encadenaba un
  re-render; ahora se ajusta durante el render comparando el pathname anterior.
- Los 16 `as any` del test de `causal/assets` pasan por un helper tipado.
- ESLint configurado para respetar el prefijo `_` en `no-unused-vars`.

## Decisiones tomadas

- **Verificación por deploy, no por dev server.** No se usa `npm run dev`; los
  cambios se comprueban en la URL de producción de Vercel. Por eso no se toca
  `allowedDevOrigins: ['217.216.92.14']` en `next.config.ts`.
- **Los componentes de coberturas se borran, no se archivan.** Recuperables por
  git si hicieran falta.
- **Para opciones se cotiza la prima real del contrato**, no solo el subyacente:
  es la única forma de medir el P&L real de la recomendación.
- **El precio de referencia de un contrato es el mid bid/ask**, no el último
  cruce, que en contratos ilíquidos puede ser de días atrás.
- **Los contratos que Yahoo no cotiza se omiten en silencio** y la celda cae al
  guion, en vez de fallar toda la petición.
- Render y las vulnerabilidades de `npm audit` quedan congelados por decisión
  del usuario.

### Señalización de entradas no fiables (commit `fa012a3`)
- Re-ejecutar el Agente Peter **no** corrige las filas afectadas por el bug del
  precio de entrada: la deduplicación de `/api/agentes/picks` omite los tickers
  con posición activa y conserva la fila original.
- Nuevo `lib/agentes/legacy-entry-price.ts`: identifica esas filas exigiendo dos
  señales a la vez — la huella `entrada × 1.15 == objetivo` y la ausencia de
  `ai_report.objetivo_fuente`. Ambas son necesarias, porque el fallback vigente
  también genera un objetivo un 15 % por encima de la entrada, solo que ahí la
  entrada sí es el precio real.
- La tabla de Peter marca las filas con `⚠ ENTRADA NO FIABLE` y muestra un aviso
  con el recuento en la cabecera. No se muta ningún dato automáticamente.
- El log de Peter y Small explica que al omitir un ticker se conserva la
  recomendación original sin modificar.

### Blindaje del precio de entrada (commit `26457e3`)
- **Agente Small nunca tuvo el bug de APA**: su paso 4 no sobrescribe
  `lastPrice`. Sus recomendaciones existentes son válidas y no hay que borrarlas.
  Solo hay que limpiar las de Peter marcadas con `⚠ ENTRADA NO FIABLE`.
- El detector se restringe a propósito a `PETER_LYNCH`: una fila **buena** de
  Small anterior al arreglo también puede cumplir `entrada × 1.15 == objetivo`,
  porque el fallback antiguo ponía el objetivo justo un 15 % sobre el precio
  real. Extenderlo a Small marcaría filas correctas.
- Eliminado `t.lastPrice ?? t.forecastPrice ?? 0` de ambos agentes:
  `forecastPrice` es la proyección a 30 días y `0` daría rendimiento infinito.
  Eran inalcanzables solo por el filtro `paso2Pass`. Ahora, sin precio real, el
  ticker se descarta en el paso 4 (sin gastar la llamada a la IA) y no se guarda
  en el paso 5.
- `AgenteSmall` enviaba `category: 'SMALL_CAP'` a `/api/agentes/analyze` y
  guardaba `'SMALL_CAPS'`. Solo afectaba a la cabecera `X-Title`; unificado.

## Decisiones sobre agentes

- **La venta se dispara solo por deterioro de las condiciones de mercado**
  (≥2 de 3 filtros fallando al re-ejecutar). Sin take-profit por objetivo.
- **El precio de referencia de un contrato vencido es su valor intrínseco**
  calculado contra el cierre real del subyacente ese día, nunca un valor
  asumido.
- **La categoría en BD sigue siendo `SMALL_CAPS`** pese al renombrado visible,
  para no dejar huérfanas las recomendaciones existentes.
- **La deduplicación de `/api/agentes/picks` se mantiene.** Sin ella, cada
  ejecución sobrescribiría `precio_entrada` con el precio del día y el
  rendimiento se reiniciaría a cero, perdiendo el seguimiento desde la fecha de
  recomendación. Los datos corruptos se corrigen borrando filas, no cambiando
  esta regla.

## Estado de verificación (commit `04537ed`)

| Check | Resultado |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run test:run` | **269/269** (45 nuevos: liquidación de opciones, detector y orden del menú) |
| `npm run lint` | **0 problemas** (baseline 37) |
| `npm run build` | exit 0 |
| Deploy Vercel | success |
