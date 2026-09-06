# Cascada de selección — Agente Peter y Agente Small

Documento de referencia sobre cómo cada agente elige empresas, cuándo se ejecuta
y qué consume. Verificado contra el código el 2026-09-06.

## Resumen en una frase

Peter y Small **son el mismo pipeline**. Solo cambian dos cosas: el universo de
partida y los umbrales. Todo lo demás —el forecast, el momentum, la revisión
del modelo, el guardado— es código compartido, byte por byte.

---

## La cascada, paso a paso

El orden importa: cada paso solo recibe lo que sobrevivió al anterior, así que
los pasos caros (Yahoo, y sobre todo el modelo) trabajan sobre listas ya cortas.

| # | Paso | Qué evalúa | Corte | Dónde vive |
|---|---|---|---|---|
| 0 | Reevaluación de posiciones abiertas | Recalcula forecast y momentum de lo ya comprado | Vende si fallan ≥2 de 3 señales (Lynch, forecast, momentum) | `AgentePeter.tsx:190`, `AgenteSmall.tsx:193-201`, regla en `AgenteSmall.tsx:255-262` |
| 1 | Screener Lynch | Los 6 criterios fundamentales | **Peter: 6/6 exacto**. **Small: ≥4/6** | `screener.ts:187-196`; cortes en `AgentePeter.tsx:227` y `AgenteSmall.tsx:238` |
| 2 | Forecast a 30 sesiones | Proyección lineal (60%) + EWMA (40%) | Retorno proyectado ≥ **+2 %** | `signals.ts:18,60-88` |
| 3 | Momentum | RSI, MACD, tendencia de volumen | Score ≥ **2 de 3** | `signals.ts:19,130-155` |
| 4 | Revisión del modelo | Un LLM lee el caso y opina | `conviction ≥ 7` **y** `direction === 'COMPRA'` | `AgentePeter.tsx:378`, `AgenteSmall.tsx:389-393` |
| 5 | Persistencia | Guarda la recomendación | Descarta duplicados con misma `ticker`+`category` y `estado != 'Vender'` | `api/agentes/picks/route.ts:49-59` |

En el paso 0, una señal sin datos cuenta como **aprobada** (`?? true`,
`AgenteSmall.tsx:219-221`): una caída de Yahoo nunca dispara una venta por
accidente.

La columna «dónde vive» apunta a la vía manual, la del botón. La ejecución
programada recorre los mismos cinco pasos con los mismos cortes desde
`src/lib/agentes/cascada.ts`, que no depende de React ni de sesión. Los umbrales
y el cálculo son código compartido (`screener.ts`, `signals.ts`,
`analisis.ts`), así que las dos vías no pueden divergir sin que se rompa una
prueba.

---

## Paso 1 en detalle — los 6 criterios y sus dos juegos de umbrales

Evaluador único (`screener.ts:187-196`); el score es el número de criterios en
verde (`contarScore`, `screener.ts:199`).

| Criterio | Campo | Operador | **Peter** (`LARGE_CAP_OPTIONS`) | **Small** (`SMALL_CAP_OPTIONS`) |
|---|---|---|---|---|
| `pe_historico` | `trailingPE` | `> 0` y `<` umbral | `< 25` | `< 20` |
| `pe_proyectado` | `forwardPE` | `> 0` y `<` umbral | `< 15` | `< 18` |
| `deuda_capital` | `debtToEquity` | `>= 0` y `<` umbral | `< 0.35` | `< 0.5` |
| `crecimiento_eps` | `earningsGrowth` | `>` umbral | `> 15 %` | `> 15 %` |
| `peg` | `pegRatio` | `> 0` y `<` umbral | `< 2` | `< 1.5` |
| `market_cap` | `marketCap` | dentro del rango | `≥ 5 000 M$`, sin techo | `100 M$ – 2 000 M$` |

Dos matices que el nombre esconde:

- **`deuda_capital` no es deuda/patrimonio** pese al nombre del campo. Es
  **deuda neta / capitalización**, con suelo en cero (`screener.ts:204-213`):
  `max(0, totalDebt - totalCash) / marketCap`.
- **`crecimiento_eps` sale de la serie temporal**, no del campo directo: YoY del
  beneficio neto de `fundamentalsTimeSeries` (`crecimientoAnual`,
  `screener.ts:226-232`), y solo si eso falla cae a `financialData.earningsGrowth`
  (`screener.ts:268-269`).

### El corte de score es la única diferencia de comportamiento

Peter exige los seis criterios. Small se conforma con cuatro. Con umbrales más
laxos en P/E y PEG pero un market cap acotado por arriba, Small busca lo que
Peter no puede mirar: compañías pequeñas donde la exigencia perfecta dejaría la
lista vacía.

---

## Pasos 2 y 3 en detalle — señales técnicas

Idénticos en ambos agentes, sin excepción.

| Señal | Cálculo | Aprueba si | Descarta también si |
|---|---|---|---|
| Forecast | `lineal * 0.6 + ewma * 0.4` sobre 30 sesiones | Retorno ≥ `FORECAST_UMBRAL = 0.02` | Menos de 30 cierres, o error de Yahoo |
| RSI | RSI(14) | `> 50` y `< 75` | — |
| MACD | MACD vs. su señal | `macd > signal` | — |
| Volumen | media 5d / media 20d | `≥ 1.1` | Menos de 20 volúmenes |

Momentum necesita **2 de esas 3** para pasar (`MOMENTUM_MIN_SCORE = 2`).

---

## Universo de partida

Listas estáticas en `screener.ts`, hidratadas en vivo desde Yahoo Finance
(`yahoo-finance2`).

| Agente | Lista | Tamaño | Selección |
|---|---|---|---|
| Peter | `SP500_NASDAQ100_TICKERS` (`screener.ts:26-88`) | ~443 tickers | S&P 500 + Nasdaq 100 |
| Small | `SMALL_CAP_TICKERS` (`screener.ts:91-144`) | ~307 tickers | S&P 600 + Russell 2000 |

Se piden en lotes de 25 (`screener.ts:318`) vía `quoteSummary` +
`fundamentalsTimeSeries` desde 2018-01-01. Los tickers que fallan se descartan
en silencio (`Promise.allSettled`, `screener.ts:303-305`). Dos cachés en memoria
independientes con **TTL de 6 h**; `?refresh=1` las invalida.

Ninguna tabla de Supabase alimenta el universo. Supabase solo guarda el
resultado (`agent_recommendations`).

---

## ¿Usa crons? ¿Cada cuánto se ejecuta?

**Sí, desde el 2026-09-06: una vez al día, una hora antes del cierre de Nueva
York, de lunes a viernes.** Antes de esa fecha la cascada solo existía en el
navegador y no se evaluaba nada si nadie abría `/agentes` y pulsaba el botón.

| Programador | Cadencia | Qué dispara |
|---|---|---|
| Crontab del VPS | `*/15 19-22 * * 1-5` (hora de Madrid) | `scripts/agentes/run.sh` — **Peter y Small** |
| GitHub Actions `review-exits.yml` | `0,30 14-20 * * 1-5` UTC | `/api/cron/review-exits` — salidas de Gamma y Theta |
| GitHub Actions `archive-chains.yml` | `15 21,22 * * 1-5` UTC | `/api/cron/archive-chains` — cadenas de opciones |
| Crontab del VPS | de 2 min a diario | Motor de alerta temprana (`scripts/alertas/run.sh`) |

### Por qué en el VPS y no en la nube

La hora importa: la recomendación llega una hora antes del cierre para que dé
tiempo a abrir o cerrar la posición ese mismo día. Ninguno de los dos
planificadores de la nube puede prometer esa hora.

- **Vercel, plan Hobby**: invoca el cron en cualquier instante de la hora
  indicada, para repartir carga entre cuentas. `0 19 * * *` puede saltar a las
  19:59, que en verano es un minuto antes del cierre. Además solo admite dos
  crons diarios, y mata la función a los **300 s** — Small llega a hacer quince
  llamadas al modelo y no cabe con holgura.
- **GitHub Actions**: no garantiza la puntualidad de `schedule` y se retrasa sin
  aviso cuando la plataforma tiene carga.
- **El VPS** ya sostiene el motor de alerta temprana con este mismo patrón, ya
  tiene los secretos en `.env.local`, y no impone límite de duración. No añade
  una dependencia nueva: reutiliza la que ya existe.

### Por qué cada cuarto de hora si solo corre una vez

Estados Unidos y Europa cambian la hora en fines de semana distintos, así que
durante dos o tres semanas al año el desfase entre Nueva York y Madrid no es el
habitual y una hora fija del crontab caería fuera. La ventana ancha lo absorbe,
y dos guardas dejan pasar un solo disparo:

1. `enVentanaPrecierre` (`src/lib/market-hours.ts`) exige que falten entre 75 y
   15 minutos para el cierre. El extremo inferior lo marca `MARGEN_CIERRE_MIN`,
   porque más tarde `marketStatus` ya cierra la puerta por su cuenta.
2. Un sello en `/var/lib/dep-coberturas/agentes-ultimo-dia` guarda la última
   fecha **en hora de Nueva York** que se ejecutó. Si coincide con hoy, el
   script sale sin tocar Yahoo ni el modelo.

Manda el primer disparo que cae dentro; los demás cuestan un proceso de Node de
medio segundo y nada más.

### Cómo se dispara a mano

```bash
scripts/agentes/run.sh --estado          # informa y no ejecuta nada
scripts/agentes/run.sh                   # respeta ventana y sello
scripts/agentes/run.sh peter --forzar    # ignora ventana y sello, un solo agente
```

`--forzar` no salta la comprobación de mercado abierto: fuera de sesión Yahoo
devuelve el último cierre y la recomendación nacería anclada a un precio que ya
no existe.

### El endpoint HTTP sigue existiendo

`/api/cron/run-agents` hace exactamente lo mismo desde la aplicación desplegada,
autenticado con `Authorization: Bearer $CRON_SECRET`. No hay ningún
planificador apuntándole —el VPS llama a las librerías directamente, sin pasar
por HTTP— pero queda disponible por si el despliegue se mueve a un plan que sí
permita cronometrar con precisión:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
     "$APP_URL/api/cron/run-agents?agente=peter&forzar=1"
```

Sin `CRON_SECRET` responde 503 y no ejecuta nada: falla cerrado a propósito,
porque una tarea que escribe en la base no debe quedar abierta por un descuido
de configuración.

### El botón sigue estando

El cron no lo sustituye: `/agentes` conserva la ejecución manual con el detalle
paso a paso. Lo que comparten es el destino y las reglas, no la presentación.

---

## ¿Qué consume cada ejecución? ¿Gasta tokens?

Distinción importante, porque solo un paso de los cinco cuesta dinero de modelo.

Medido el 2026-09-06 con una corrida real de extremo a extremo:

| Agente | Screener | Embudo | Llegan al modelo | Total |
|---|---|---|---|---|
| Peter | 35-44 s (424 evaluados, 20 con 6/6) | 8 tras forecast, 3 tras momentum | **3** | ~69 s |
| Small | 25-30 s (260 evaluados, 92 con ≥4/6) | 46 tras forecast, 15 tras momentum | **15** | ~2-4 min |

| Paso | Recurso | ¿Gasta tokens? | Coste real |
|---|---|---|---|
| 0-3 | Yahoo Finance | **No** | Tiempo y cuota de Yahoo. Determinista: los mismos datos dan el mismo resultado. `maxDuration = 300` en la ruta del screener |
| 4 | OpenRouter | **Sí** | **Una llamada por candidato que llega vivo al paso 4** |
| 5 | Supabase | No | Un `insert` por recomendación |

Detalle del paso 4 (`api/agentes/analyze/route.ts`): modelo
`deepseek/deepseek-chat-v3-0324` por defecto (`OPENROUTER_MODEL` lo cambia),
`temperature: 0` a propósito —la frontera de `conviction >= 7` no debe moverse
entre ejecuciones idénticas— y `max_tokens: 600`.

El gasto real de una corrida es por tanto **pequeño y acotado**: la cascada solo
manda al modelo lo que ya sobrevivió a tres filtros deterministas. Con Peter
exigiendo 6/6, lo normal es que lleguen unos pocos tickers, a veces ninguno.

El modelo tampoco tiene la última palabra sobre los números: `stop_loss` se
fuerza a `lastPrice * 0.92` si viene ausente o inválido, y para
`precio_objetivo` manda el `targetMeanPrice` de Yahoo por delante de la cifra
del modelo.

---

## Rutas que se llaman en una corrida

| Paso | Peter | Small |
|---|---|---|
| 0 | `GET /api/agentes/picks?category=PETER_LYNCH` | `…?category=SMALL_CAPS` |
| 1 | `GET /api/peter-lynch/screen` | `GET /api/peter-lynch/screen?universe=small_cap` |
| 2 | `GET /api/agentes/forecast?tickers=…` | igual |
| 3 | `GET /api/agentes/momentum?tickers=…` | igual |
| 4 | `POST /api/agentes/analyze` `{category:'PETER_LYNCH'}` | `{category:'SMALL_CAPS'}` |
| 5 | `POST /api/agentes/picks`, `PATCH` para ventas | igual |

`/api/peter-lynch/screen` es el único conmutador de universo: cualquier valor de
`universe` distinto de `small_cap` cae a large cap en silencio.

Hay además un presupuesto de tiempo en el paso 4
(`PRESUPUESTO_ANALISIS_MS`, 210 s): si se agota, la cascada deja de analizar y
lo dice en `truncadas`. Lo ya guardado se escribe candidato a candidato, así que
no se pierde; el resto se retoma al día siguiente, que es inofensivo porque el
screener es determinista.

El cron no pasa por ninguna de esas rutas: llama directamente a las librerías
(`lib/peter-lynch/screener.ts`, `lib/agentes/historicos.ts`,
`lib/agentes/analisis.ts`) desde `lib/agentes/cascada.ts`, y escribe en
Supabase con el cliente de servicio filtrando por `CRON_USER_ID`. Las rutas y el
cron comparten esas librerías precisamente para que las dos vías no puedan
divergir en silencio.

---

## Rarezas conocidas (documentadas, no corregidas)

1. **Todos los criterios Lynch son *fail-on-null***. Un campo que Yahoo no
   devuelve no es «desconocido», es un punto perdido. Para Peter, que exige 6/6,
   un solo hueco de datos basta para descartar una empresa que quizá cumplía.
2. **`FFIN` y `HWC` están en los dos universos** (`screener.ts:61` y `:110`). El
   `new Set()` deduplica dentro de una lista, no entre listas, así que ambos
   agentes pueden recomendar el mismo papel.
3. **`/api/peter-lynch/screen` no comprueba sesión**, a diferencia de
   `forecast`, `momentum` y `analyze`, que sí exigen sesión de Supabase.
