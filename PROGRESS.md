# PROGRESS — Plataforma de Agentes y Estrategias Cuantitativas

> Notas de trabajo del producto. Lo relativo al despliegue en Render y a la
> auditoría de seguridad vive en `SECURITY_REVIEW_PROGRESS.md` (congelado).

---

## Estado actual

**Último commit verificado:** `74e0892` · Deploy Vercel: success

| Check | Resultado |
|---|---|
| `npm run lint` | **0 problemas** (baseline era 37) |
| `npx tsc --noEmit` | exit 0 |
| `npm run test:run` | **343/343** |
| `npm run build` | exit 0 |

### Mapa de navegación

| # | Sección | Ruta | Subtítulo |
|---|---|---|---|
| 1 | Portafolios | `/portafolios` | Portafolios Algorítmicos de Acciones y Opciones |
| 2 | Agentes | `/agentes` | Agentes IA para Acciones y Opciones |
| 3 | Estrategias | `/estrategias` | Estrategias para Trading de Futuros |
| 4 | Recomendaciones | `/recomendaciones` | Panel de Recomendaciones |

Fuera del menú pero con ruta viva: `/dashboard`, `/ergos-quant`,
`/perfil` y `/fincept-terminal` (estas dos bajo Configuración).

---

## Pendiente

### Funcionalidad por definir
- **Estrategias** (`/estrategias`) — placeholder a la espera de las estrategias
  de trading de futuros.

### Acciones en la app
- **Aplicar la migración `017_agent_recommendations_closed_at.sql` en Supabase.**
  Sin ella el PATCH de cierre falla al escribir `closed_at` y los portafolios
  siguen infiriendo todas las fechas de cierre.
- **Re-ejecutar Gamma y Theta una vez** para que liquiden con datos reales los
  contratos vencidos y recalculen tanto los cerrados con el ±100% cableado como
  los que se liquidaron con el cierre del día anterior al vencimiento. FSLR
  debe pasar de +$905 / +57.46 % a **+$1 195 / +75.87 %**.
- **Verificar que las primas de opciones llegan** en producción: depende de que
  Yahoo cotice los símbolos OCC construidos. Si un contrato aparece con "—" de
  forma sistemática, contrastar el símbolo generado con el `contractSymbol` que
  devuelve la cadena de opciones.

### Decisiones abiertas
- Qué hacer con `/dashboard` y `/ergos-quant`: siguen vivas pero sin entrada de
  menú.
- `OPENROUTER_API_KEY` y `FRED_API_KEY` están vacías en `.env.local`. En Vercel
  sí están cargadas, pero sin ellas no se pueden probar recomendaciones ni
  agentes en local.

---

## Completado

### Entorno de trabajo
- Esta máquina puede commitear y pushear a `main`: token `lriofrio915` con
  `push: true`, `main` sin branch protection, credenciales en
  `credential.helper=store`.
- Deploy automático en Vercel confirmado **sin necesitar credenciales de
  Vercel**: `vercel[bot]` crea un deployment `Production` por cada push a
  `main`, verificable vía GitHub Deployments API.
- `.env.local` repoblado con `NEXT_PUBLIC_SUPABASE_URL` y
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (proyecto Supabase `replbokusvrqdbzuhulm`).
  Sigue gitignored.

### Navegación, marca y rutas
- Marca: "EQF Terminal / Sistema de Análisis de Riesgos" → **"EQF QUANT /
  Agentes y Estrategias Cuantitativas"** en TopBar, login y metadata.
- Landing tras login movido de `/dashboard` a `/agentes`.
- Menú reorganizado en cuatro entradas (ver *Mapa de navegación*). Dashboard y
  ERGOS QUANT salieron del menú conservando sus rutas.
- Rutas renombradas: `/coberturas` → `/estrategias` e `/informes` →
  `/recomendaciones`, con `git mv` para preservar el historial. Los endpoints
  `/api/informes/*` **no** se renombraron.
- **Agujero de seguridad corregido:** `src/proxy.ts` protegía tres rutas
  inexistentes (`/inversion-causal`, `/portafolios`, `/agente-ppo`) y dejaba
  `/agentes`, `/informes`, `/ergos-quant` y `/fincept-terminal` accesibles
  **sin sesión**. Sustituido por la lista real de rutas del grupo `(dashboard)`.

### Estrategias (antes Coberturas)
- Eliminados los 13 componentes de pricing manual (Black-Scholes, Greeks, CFDs,
  IV, FairValue, PositionBuilder…). La pantalla queda como placeholder.
- Conservados `/api/options/analyze` y todo `src/lib/options/`: los consumen los
  agentes Gamma y Theta.

### Seguimiento en vivo de recomendaciones
- **Bug corregido:** `fetchLivePrices` solo se alimentaba de `history`, así que
  los tickers de las recomendaciones de agentes nunca se cotizaban y las
  columnas P.Actual / Rendim. / G/P / Comisión de Peter y Small mostraban "—"
  de forma permanente. Ahora cotiza la unión de tickers del operador y de todos
  los agentes.
- Tope de `/api/informes/live-prices` subido de 25 a 100 tickers.
- Nuevo `lib/options/occ-symbol.ts`: deriva el símbolo OCC de un contrato desde
  ticker + vencimiento + strike + tipo.
- Nuevo `POST /api/informes/option-prices`: cotiza la prima actual de cada
  contrato usando el mid bid/ask, con fallback al último cruce.
- DTE de Theta recalculado contra la fecha actual con `daysToExpiration` en vez
  de leer el valor congelado de `ai_report`. Vencidos marcados `VENC.`

### Correcciones de la sección Recomendaciones (commit `9e9e3c5`)
- **Bug corregido — precio de entrada inventado en Agente Peter.** Tras la
  llamada a la IA, el paso 4 sobrescribía `lastPrice` con
  `precio_objetivo / 1.15` y ese valor se guardaba como `precio_entrada`. La
  división revertía el fallback de `analyze/route`
  (`objetivo = lastPrice * 1.15`), así que cuando la IA devolvía objetivo propio
  el número no significaba nada. Caso reportado: APA con objetivo $48.50
  registró entrada $42.17 con el mercado en 44.40. `AgenteSmall` nunca tuvo
  este defecto.
- **Bug corregido — liquidación de opciones cableada.** Gamma marcaba siempre
  −100% al vencer y Theta siempre +100%, sin mirar el subyacente. Nuevos
  `lib/options/settlement.ts` (valor intrínseco y P&L por contrato) y
  `lib/options/settle-picks.ts` (orquestación), más
  `POST /api/informes/settlement-prices` que devuelve el cierre histórico del
  subyacente en la fecha de vencimiento.
- **Bug corregido — no se podía borrar un precio de venta.** El `onBlur` era
  `if (!isNaN(val))`, así que vaciar el campo no guardaba nada. Ahora un campo
  vacío guarda `null` y libera el rendimiento. Aplicado a P.Compra, P.Venta,
  Cantidad y P.Objetivo.
- **Incoherencia corregida:** la columna Rendim. de Peter y Small ignoraba
  `precio_venta` y seguía moviéndose con el mercado tras vender, al contrario
  que la columna G/P. Ahora se congela y muestra candado.
- El precio de venta de Peter y Small pasa a solo lectura: lo registra el agente
  al cerrar por deterioro de la tesis.
- Gamma y Theta: columna Rendim. sustituida por **Result. ($)** y
  **Result. (%)** con el P&L de 1 contrato (100 acciones) y tooltip con el
  desglose. "Forecast ini." aclara en su tooltip que es la señal de entrada, no
  el resultado.
- `precio_objetivo` pasa a tomarse del consenso de analistas
  (`targetMeanPrice`), con la cifra de la IA en `ai_report.precio_objetivo_ia` y
  el origen en `ai_report.objetivo_fuente`. Es informativo: **no dispara
  ventas**.
- "Agente Small Cap" renombrado a "Agente Small" en las etiquetas visibles.

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

### Blindaje del precio de entrada (commit `26457e3`)
- **Agente Small nunca tuvo el bug de APA**: su paso 4 no sobrescribe
  `lastPrice`. Sus recomendaciones existentes son válidas.
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

### Liquidación con el día correcto y lectura de las tablas (commit `74e0892`)
- **Bug corregido — se liquidaba con el cierre del día anterior.** El endpoint
  filtraba con `fecha_barra <= vencimiento` comparando timestamps, pero las
  barras diarias llevan la hora de apertura del mercado mientras el vencimiento
  se construía a medianoche UTC, así que la barra del propio día quedaba fuera.
  FSLR CALL $230 venc. 2026-06-18 cerró a 257.70 y se liquidó con los 254.80
  del 17. La comparación pasa a hacerse por día natural.
- La liquidación anota `underlyingAtExpiry` en `ai_report`; su ausencia marca
  las filas pendientes de recalcular. El PATCH conserva el resto del informe
  (`ai_report` añadido a `EDITABLE` en `/api/agentes/picks`).
- **Corrección de una lectura errónea previa:** se dio por perdedora la
  operación de FSLR leyendo el valor de P.Subyac. como el precio al vencer,
  cuando era el precio del día en curso. El contrato venció ITM y ganó.
- **Causa de fondo, corregida:** P.Subyac. mostraba el precio de hoy incluso en
  contratos ya vencidos. En posiciones cerradas muestra el cierre del
  vencimiento, etiquetado "al vencer".
- Eliminada la columna que repetía el literal "OPCIÓN" en todas las filas de
  Gamma y Theta. En su lugar, cada tabla lleva junto al título un distintivo
  con el lado de la operación: **COMPRA DE OPCIONES** en Gamma (paga la prima,
  gana si sube) y **VENTA DE OPCIONES** en Theta (cobra la prima, gana si baja
  o vence sin valor).

### Limpieza de lint (commit `d9869a5`)
- `npm run lint` queda en **0 problemas** (venía de 37).
- **Bug corregido:** los timeouts de Yahoo Finance nunca se aplicaban. Se pasaba
  `{ signal }` como tercer argumento de `quote()`/`search()`, pero ese objeto es
  `ModuleOptions` y solo reenvía a `fetch()` lo que venga en `fetchOptions`, así
  que el `AbortSignal` se descartaba en silencio. Corregido en
  `/api/options/search`, `/api/informes/live-prices` y
  `/api/informes/option-prices`.
- **Bug corregido:** `MarketTicker` no cancelaba la petición en curso al
  desmontar, así que una respuesta tardía escribía estado sobre un componente ya
  desmontado. Ahora `fetchQuotes` vive dentro del efecto con un flag `cancelled`.
- `Sidebar` abría el submenú de Configuración desde un efecto que encadenaba un
  re-render; ahora se ajusta durante el render comparando el pathname anterior.
- Los 16 `as any` del test de `causal/assets` pasan por un helper tipado.
- ESLint configurado para respetar el prefijo `_` en `no-unused-vars`.

### Portafolios algorítmicos (`/portafolios`)
- Sección renombrada de **Portafolios Quant** a **Portafolios**, con la ruta
  movida por `git mv` de `/portafolios-quant` a `/portafolios`. Actualizados
  `Sidebar.tsx`, su test y `proxy.ts`. De paso quedan arreglados los dos
  enlaces a `/portafolios` de `dashboard/page.tsx`, que daban 404.
- La página pasa a server component con guardia de auth propia, además del
  proxy.
- **Migración `017`:** nueva columna `closed_at` en `agent_recommendations`.
  La escriben los tres caminos de cierre: la venta de Peter y Small (`now()`),
  la liquidación de Gamma y Theta (**fecha de vencimiento**, no `now()`) y el
  cierre manual de `/recomendaciones`. Añadida a la whitelist `EDITABLE` del
  PATCH.
- **Código extraído para reusar, no duplicar:** `AgentRec` sale de
  `recomendaciones/page.tsx` a `lib/agentes/types.ts` (con `rentabilidad` y
  `closed_at`, que faltaban), y `optionRefFromRec()` + `optionOutcome()` a
  `lib/options/mark.ts`, ahora con tests propios.
- **Nuevos módulos puros** en `lib/portafolios/`: `config` (reglas de cartera),
  `types`, `closed-date` (inferencia para las filas anteriores a la migración),
  `positions`, `metrics` y `equity`. 73 tests nuevos.
- **Nuevo `POST /api/portafolios/history`**: cierres diarios por ticker vía
  `yf.chart(...)` con `adjclose`, autenticado, máx. 60 símbolos.
- **Recharts 3.10.1** instalado — el proyecto no tenía ninguna librería de
  gráficos. Nuevos `components/charts/`: donut de composición, curva de equity
  vs benchmark y barras de resultado por posición.
- Refresco en vivo cada 60 s de recomendaciones, precios y primas; los
  históricos cada 15 min. Al releer la tabla, una posición vendida sale sola
  del pastel y entra en el track record.

---

## Decisiones tomadas

### Flujo de trabajo
- **Verificación por deploy, no por dev server.** No se usa `npm run dev`; los
  cambios se comprueban en la URL de producción de Vercel. Por eso no se toca
  `allowedDevOrigins: ['217.216.92.14']` en `next.config.ts`.
- **Orden de verificación:** `lint` → `tsc --noEmit` → `test:run` → `build`,
  y después confirmar el deploy vía GitHub Deployments API.
- Los componentes de coberturas **se borraron, no se archivaron**. Recuperables
  por git si hicieran falta.

### Agentes y datos
- **La venta se dispara solo por deterioro de las condiciones de mercado**
  (≥2 de 3 filtros fallando al re-ejecutar). Sin take-profit por objetivo.
- **El precio de entrada es siempre el precio real de mercado.** Si falta, el
  ticker se descarta: nunca se sustituye por una proyección ni por cero.
- **El precio de referencia de un contrato vencido es su valor intrínseco**
  calculado contra el cierre real del subyacente ese día, nunca un valor
  asumido.
- **Para opciones se cotiza la prima real del contrato**, no solo el subyacente:
  es la única forma de medir el P&L real. El precio de referencia es el **mid
  bid/ask**, no el último cruce, que en contratos ilíquidos puede ser de días
  atrás.
- **Los contratos que Yahoo no cotiza se omiten en silencio** y la celda cae al
  guion, en vez de fallar toda la petición.
- **La deduplicación de `/api/agentes/picks` se mantiene.** Sin ella, cada
  ejecución sobrescribiría `precio_entrada` con el precio del día y el
  rendimiento se reiniciaría a cero, perdiendo el seguimiento desde la fecha de
  recomendación. Los datos corruptos se corrigen borrando filas, no cambiando
  esta regla.
- **La categoría en BD sigue siendo `SMALL_CAPS`** pese al renombrado visible,
  para no dejar huérfanas las recomendaciones existentes.

### Portafolios
- **El portafolio es derivado, no una tabla.** Se calcula aplicando las reglas
  de `lib/portafolios/config.ts` a `agent_recommendations` en cada carga. Por eso
  una venta del agente se refleja sola y corregir un dato corrige el pasado.
- **Sizing fijo:** $100 000 y $1 000 por recomendación en acciones (cantidad
  fraccional), $100 000 y 1 contrato por señal en opciones. `cantidad_acciones`
  de la tabla se **ignora**: es la cartera manual del operador, no la del
  portafolio algorítmico.
- **El peso de una opción en el pastel es el capital que inmoviliza**, no la
  prima: colateral del strike en un put vendido y valor de las acciones en una
  call cubierta. Con la prima, Theta parecería una posición diminuta siendo la
  que más capital retiene.
- **La curva de opciones es escalonada a propósito.** Yahoo no publica histórico
  de primas, así que la línea solo se mueve con cada liquidación real. Se
  descartó revaluar con Black-Scholes: sería una curva suave pero teórica.
- **Las filas con precio de entrada fabricado se excluyen** del portafolio y se
  informa del recuento. Contarlas inventaría rendimiento en el track record.
- **Cifras brutas**, sin comisión de rendimiento ni costes de transacción.
- **Benchmark SPY** en ambos portafolios, normalizado al mismo capital.

### Congelado
- Todo lo de Render y las vulnerabilidades de `npm audit`, documentado en
  `SECURITY_REVIEW_PROGRESS.md`.
