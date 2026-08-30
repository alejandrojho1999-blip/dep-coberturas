# PROGRESS — Plataforma de Agentes y Estrategias Cuantitativas

> Notas de trabajo del producto. Lo relativo al despliegue en Render y a la
> auditoría de seguridad vive en `SECURITY_REVIEW_PROGRESS.md` (congelado).

---

## Estado actual

**Último commit:** `a6ec1a3` (cartera única del admin y cron por GitHub Actions)

| Check | Resultado |
|---|---|
| `npm run lint` | **0 problemas** |
| `npx tsc --noEmit` | exit 0 |
| `npm run test:run` | **415/415** |
| `npm run build` | exit 0 |
| `node scripts/build-estrategias.mjs` | las 6 estrategias y la cartera cuadran con el expediente |

### Mapa de navegación

| # | Sección | Ruta | Subtítulo |
|---|---|---|---|
| 1 | Portafolios | `/portafolios` | Portafolios Algorítmicos de Acciones, Opciones y Futuros · 4 pestañas |
| 2 | Agentes | `/agentes` | Agentes IA para Acciones y Opciones |
| 3 | Estrategias | `/estrategias` | Seis sistemas algorítmicos de futuros sobre el Nasdaq |
| 4 | Recomendaciones | `/recomendaciones` | Panel de Recomendaciones |

Fuera del menú pero con ruta viva: `/dashboard`, `/ergos-quant`,
`/perfil` y `/fincept-terminal` (estas dos bajo Configuración).

---

## Pendiente

### PARA EL LUNES 2026-08-31 — activar el archivo de cadenas
> Aplazado a propósito el 2026-08-29 (sábado). El **lunes 31 es día de mercado**,
> que es cuando se puede verificar de verdad: la guarda de calendario impide
> probar la captura en fin de semana.
>
> El código está desplegado y en producción desde el commit `f0f6797`, pero
> **no graba nada todavía** porque falta la tabla. Nada se rompe mientras tanto:
> el cron responde 500 y el job de GitHub sale en rojo, sin tocar ninguna otra
> parte de la aplicación.

**1. Aplicar la migración 019 — bloqueante.**
`supabase/migrations/019_options_chain_snapshots.sql`, desde el SQL Editor de
Supabase o con la CLI. Solo crea la tabla `options_chain_snapshots` y sus
políticas; no toca ni una fila existente. No pude aplicarla desde la sesión
porque el MCP de Supabase no estaba conectado.

**2. Confirmar `CRON_SECRET` y la variable `APP_URL`** en la configuración del
repositorio en GitHub. El workflow de `review-exits` ya los usa, así que deberían
estar — pero si aquel llevara tiempo fallando en silencio, este heredaría el
problema sin avisar.

**3. Verificar la primera captura real.** El camino completo —descargar, filtrar,
escribir— **no está probado de extremo a extremo**: en sábado solo pude
comprobar la autorización (401 sin cabecera y con secreto inválido) y la guarda
de fin de semana. Qué mirar:
- GitHub → Actions → «Archivo diario de cadenas de opciones». Se puede forzar con
  *Run workflow* sin esperar al horario, **pero tiene que caer entre las 16:00 y
  las 19:00 de Nueva York** o responderá `ejecutado: false` sin error.
- La respuesta debe traer `archivados` cerca de 36, con `contratos` y `kb`.
- En Supabase, `select count(*) from options_chain_snapshots where fecha = ...`
  debe dar ~36 filas.
- Si algún ticker aparece en `vacios` o `fallidos` de forma **sistemática** varios
  días seguidos, mirarlo: uno suelto es normal (Yahoo tiene huecos), uno fijo
  significa que ese subyacente no se está archivando.

**Referencia de tamaño**, para detectar a tiempo que algo se desmadra: ~0,5 MB al
día, 10 MB al mes, 125 MB al año. Si un día pasa mucho de 1 MB, el filtro dejó de
aplicarse.


### DEUDA ABIERTA — activar el cron y la cartera única
> Estado a 2026-08-23: **el código está desplegado y en producción, pero
> inactivo a propósito**. Falta configuración manual que solo puede hacer el
> dueño de las cuentas. Retomar cuando estén a mano las credenciales.
>
> Nada de lo pendiente rompe la app mientras tanto: sin la migración sigue
> vigente `own_data` (cada usuario ve lo suyo, como siempre) y sin las
> variables el endpoint del cron responde 503 sin tocar nada.

Commits que dejaron esto listo: `85dc8de`, `58f164c`, `a6ec1a3`.

#### Paso 1 — Variables en Vercel (Settings → Environment Variables, Production)

| Variable | De dónde sale |
|---|---|
| `CRON_SECRET` | generar con `openssl rand -base64 32` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` |
| `CRON_USER_ID` | Supabase → Authentication → Users → UID de `lriofrio915@gmail.com` |

⚠️ `CRON_USER_ID` tiene que ser el UID **del admin y de nadie más**: la clave de
servicio se salta RLS, así que ese uuid es la única frontera entre cuentas.
⚠️ `SUPABASE_SERVICE_ROLE_KEY` nunca lleva el prefijo `NEXT_PUBLIC_`. Con él
acabaría en el JavaScript que descarga cualquier visitante.

Redesplegar después de añadirlas: las variables se leen en el arranque.

#### Paso 2 — GitHub (Settings del repositorio)
- *Secrets and variables → Actions → Secrets*: `CRON_SECRET`, **mismo valor**
  que en Vercel. Si difieren, el workflow recibe 401.
- *Variables*: `APP_URL` con la URL de producción, **sin barra final**.

#### Paso 3 — Aplicar la migración 018
`supabase/migrations/018_agent_recommendations_admin_only.sql` en el SQL Editor
de Supabase. Es el paso que convierte la cartera en compartida.

Para volver atrás si algo sale mal:
```sql
DROP POLICY IF EXISTS "todos_leen_la_cartera_del_admin" ON agent_recommendations;
DROP POLICY IF EXISTS "solo_el_admin_crea"      ON agent_recommendations;
DROP POLICY IF EXISTS "solo_el_admin_actualiza" ON agent_recommendations;
DROP POLICY IF EXISTS "solo_el_admin_borra"     ON agent_recommendations;
CREATE POLICY "own_data" ON agent_recommendations FOR ALL USING (auth.uid() = user_id);
```

#### Paso 4 — Verificar (nada de esto se ha podido comprobar desde la sesión)
1. **Cron a mano:** GitHub → Actions → «Revisión de niveles de salida» → *Run
   workflow*. Con el mercado cerrado la respuesta correcta es
   `{"ejecutado": false, "motivo": "fin-de-semana" | "fuera-de-horario"}` y el
   job en verde. Un 401 significa que los dos `CRON_SECRET` no coinciden; un
   503, que falta alguna variable en Vercel.
2. **Cron en vivo:** repetir en horario de sesión (10:00–15:45 ET) y confirmar
   que devuelve `ejecutado: true` con el detalle por categoría.
3. **Cartera compartida:** entrar con una segunda cuenta que no sea el admin y
   comprobar que ve las recomendaciones del admin en `/recomendaciones` y
   `/portafolios`, que en `/agentes` aparece el aviso de solo lectura en vez
   del botón, y que la API responde 403 a un `PATCH`.
4. **El admin sigue pudiendo todo:** ejecutar un agente y editar una fila.

#### Riesgo conocido que conviene mirar en esa sesión
Al aplicar la 018, las recomendaciones que hubiera creado **cualquier otro
usuario** dejan de ser visibles para su dueño (la lectura pasa a limitarse a
las del admin). No se han borrado y siguen en la tabla; si hubiera filas así,
decidir si migrarlas al admin o dejarlas ocultas.

### Niveles de salida — lo que queda
- ~~Recorrido visual de la columna «Salida»~~ — **confirmado en producción por
  el usuario** el 2026-08-23: se ven objetivo y stop en las tablas de opciones.
- ~~Extraer el pipeline a una API route~~ — hecho para la revisión de niveles
  (`/api/agentes/review-exits`, commit `85dc8de`).
- **Lo que sigue en el navegador:** los pasos 1-6 de los cuatro agentes, o sea
  la *generación* de señales nuevas. Sacarlos al servidor es más trabajo que la
  revisión —una llamada de IA por candidato, con 36 tickers en Theta— y no cabe
  en una sola función sin trocearlo. Hasta entonces las señales nuevas siguen
  necesitando que alguien pulse el botón; lo automatizado es solo el cierre por
  nivel.

### Sección Estrategias — cierre
- **Recorrido visual autenticado** de `/estrategias`, las seis fichas y la nueva
  sección de `/portafolios`.

### Rebrand SynerGy — cierre
- **Commitear y pushear.** El rebrand está completo y verificado pero sigue en
  el working tree, sin commit.
- **Recorrido visual autenticado** de las 8 rutas del dashboard. Solo se
  comprobaron en navegador `/login`, `/register` y el shell del dashboard (con
  una ruta temporal ya borrada). `recomendaciones/page.tsx` concentraba 419
  sustituciones de color y es la de mayor riesgo de regresión.
- **Generar un informe DOCX real** para confirmar la paleta azul del manual
  (`1C3042` / `003D66`), la tipografía Roboto y el pie con "SynerGy".
- Posible **segunda pasada de ajuste fino** en las pantallas densas
  (`recomendaciones`, `fincept-terminal`): sin acento cálido, la jerarquía
  depende de peso y relleno y puede necesitar retoques al verla en uso.

### Ergo Quant y su backend FastAPI — congelado, candidato a borrado
Decisión del usuario (2026-08-23): no interesa. **No se toca ni se mantiene**;
más adelante se decide si se borra.

Estado actual: **ya está fuera de la navegación** — el sidebar no tiene ningún
enlace a `/ergos-quant` (solo se llega escribiendo la URL, y sigue protegida por
`proxy.ts:45`). No hace falta ocultar nada más.

Inventario para el día que se borre:
- `src/app/(dashboard)/ergos-quant/` — 5 archivos, ~464 líneas
  (`ErgoQuantClient`, `SignalsTable`, `PortfolioOptimizer`, `PpoAgent`, `page`).
- `src/app/api/ergos-quant/[...path]/route.ts` — el proxy con `X-API-Key`.
- `ergo-quant-api/` — backend FastAPI en Python, 240 KB.
- En `render.yaml`: el servicio `pserv` completo y las dos variables
  `ERGO_QUANT_API_URL` / `ERGO_QUANT_API_KEY` del servicio web.
- Las rutas en `proxy.ts:45` y las menciones de `DEPLOY_RENDER.md` /
  `SECURITY_AUDIT_RENDER.md`.

Borrarlo es además el requisito previo para consolidar el despliegue en Vercel:
ese FastAPI es la única pieza que no es Next, y sin él la migración deja de
tener parte difícil.

### Deudas conocidas en los agentes de opciones
Detectadas al escribir las fichas técnicas. Ninguna se tocó: son cambios de
comportamiento con dinero real detrás y merecen su propia sesión.

- **Gamma no tiene stop ni toma de beneficios.** Guarda `precio_objetivo`
  (prima × 2,5) y `stop_loss` (prima × 0,5) que **ningún proceso consulta**: la
  posición vive hasta el vencimiento pase lo que pase. Lo mismo en Theta con
  `stop_loss = prima × 2`, que no tiene un solo lector en `src/`. O se
  implementan o se dejan de escribir, pero guardar cifras que nadie usa invita a
  creer que hay una protección que no existe. La ficha de cada agente lo dice.
- **Todo covered-call se valora con `strike × 100`.** `positions.ts` lee el
  precio del subyacente de `ai_report.underlying`, campo que Theta nunca guarda.
  Ahora los agentes sí capturan `underlyingPrice` de la cadena para el análisis
  de IA, así que persistirlo en `ai_report` cerraría el hueco casi gratis.
- **Los rangos de delta no coinciden entre el score y los filtros.**
  `strategy-scoring.ts` premia 0,20–0,35 (venta) y 0,45–0,65 (compra), pero los
  agentes aceptan 0,15–0,35 y 0,30–0,65: un contrato puede pasar el filtro
  arrastrando la penalización de −10 que le impuso el score.
- **Nadie comprueba que se posean las acciones de un covered-call.** La
  estrategia solo está «cubierta» por convención; el sistema no lo verifica.

### Funcionalidad por definir
- *(nada pendiente: `/estrategias` ya está implementada)*

### Acciones en la app
- **Re-ejecutar Gamma y Theta una vez** para que liquiden con datos reales los
  contratos vencidos y recalculen tanto los cerrados con el ±100% cableado como
  los que se liquidaron con el cierre del día anterior al vencimiento. FSLR
  debe pasar de +$905 / +57.46 % a **+$1 195 / +75.87 %**.
- **Verificar que las primas de opciones llegan** en producción: depende de que
  Yahoo cotice los símbolos OCC construidos. Si un contrato aparece con "—" de
  forma sistemática, contrastar el símbolo generado con el `contractSymbol` que
  devuelve la cadena de opciones.

### Acceso a Google Drive
El conector de Drive sigue la cuenta con la que está autenticado Claude Code.
La carpeta `Emporium/` pertenece a **lriofrio915@gmail.com**; con
`tefybel@gmail.com` no se ve nada de ella. Antes de trabajar con material de
Drive, comprobar la cuenta activa (`list_recent_files` muestra el `owner`).

### Decisiones abiertas
- **Las capas técnicas de Peter y Small.** Quitarlas mejora CAGR, Sharpe, IR y
  t-stat en los dos agentes de forma consistente, pero la ventana honesta son 28
  meses de un solo régimen de mercado y el t-stat se queda en 0,82. No es base
  suficiente para tocar producción, al contrario que en Gamma, donde había 21
  años y la ventaja aguantaba en 10 de 12 supuestos. Se decide con datos
  point-in-time o con forward-test real, no alargando la interpretación de esta
  muestra.
- **Qué aporta el Agente Theta frente a comprar el índice.** No bate a `^PUT` en
  ninguna corrida que no arruine la cartera: IR negativo con el supuesto
  calibrado. Seleccionar 36 subyacentes no mejora a vender puts sobre el índice
  sin seleccionar nada. Merece decidir si el agente cambia o si el capital que
  tiene asignado está mejor en otro sitio.
- **Verificar una descarga del dataset con sesión iniciada.** Que devuelva 401
  sin sesión está comprobado en producción; que el fichero llegue bien a quien sí
  tiene derecho, solo por pruebas unitarias. Se cierra abriendo
  `/agentes/backtest` y pulsando un enlace del panel de descargas.
- Qué hacer con `/dashboard` y `/ergos-quant`: siguen vivas pero sin entrada de
  menú.
- `OPENROUTER_API_KEY` y `FRED_API_KEY` están vacías en `.env.local`. En Vercel
  sí están cargadas, pero sin ellas no se pueden probar recomendaciones ni
  agentes en local.

---

## Completado

### Calmar en la cartera de futuros (2026-08-30)

La sección publicaba **Net/DD** (21,79) como ratio principal. Esa cifra es neto
*total* sobre drawdown, así que crece sola con la longitud del backtest: 11,6
años la inflan y no es comparable con la de ningún otro gestor. Se añade el
**Calmar** —beneficio de un año medio sobre el peor drawdown— que sí está
normalizado por tiempo.

Se calcula de forma **aritmética** (`neto / años / |maxDD|`) porque la cartera
opera a tamaño fijo, un contrato por bot: no hay reinversión que un CAGR pudiera
capturar. El resultado es idéntico se mida en dólares o en porcentaje de la
cuenta, ya que ambos términos se escalan por la misma base. En acciones y
opciones (`CurveMetrics`) sí se usa `cagr / maxDrawdown`, porque allí la curva
compone sobre capital. Son dos definiciones y está dicho en el `ayuda` de cada
tarjeta.

**Bug corregido de paso.** `porAnio` contaba *etiquetas de año distintas* en las
fechas: del 14/01/2015 al 14/08/2026 salían 12 años cuando son 11,58. El
beneficio anual publicado era **7.445 $** y el expediente dice **7.714 $** — un
3,6 % de menos. `aniosCubiertos()` ahora mide de punta a punta y las dos cifras
cuadran. Cualquier captura anterior de la pantalla lleva el número viejo.

Lo que sale, y es el argumento entero de la cartera en un solo número:

| | Calmar | Net/DD |
|---|---|---|
| **Cartera** | **1,88** | 21,79 |
| RSI2 Reversion | 0,86 | 9,23 |
| Weekend Effect | 0,59 | 6,63 |
| Momentum de Apertura | 0,56 | 6,48 |
| Overnight Drift | 0,54 | 5,82 |
| ZigZag Breakout | 0,40 | 4,67 |
| IBS Reversion | 0,23 | 2,43 |

Ninguna estrategia suelta llega a 1. Juntas, 1,88.

Por escenario, derivado al render del drawdown medido (no se guarda, así no
puede desincronizarse): régimen actual **3,10**, media histórica **1,88**,
régimen antiguo **0,52**.

**Tocado:** `scripts/build-estrategias.mjs` (`aniosCubiertos`, `calmar`),
`src/lib/estrategias/types.ts` (`anios`, `netoPorAnio`, `calmar`,
`BloqueRegimenCartera`), `src/lib/portafolios/{metrics,types}.ts`,
`QuantPortfolioSection.tsx` (KPI + tabla de componentes + régimen + escenarios),
`EstrategiasClient.tsx`, `FichaEstrategia.tsx`, `PortfolioSection.tsx`.
Verificado: lint 0, tsc 0, **622 tests**, build OK, y el script imprime
`Calmar 1.88 (expediente: 1,88)`.

**Pendiente relacionado:** `MetricasCurva` en `src/lib/backtest/stats.ts` (Peter,
Small, Gamma, Theta) no lleva Calmar. Ahí ya están `cagr` y `maxDrawdown`, así
que es una línea — pero obliga a republicar `resumen-publicado.json` y
`opciones-resumen-publicado.json` y a regenerar los datasets descargables.

### Responsive de /agentes/backtest: la causa real era `min-width: auto` (2026-08-29)
El panel «Qué aporta cada capa» ya se había pasado a tarjetas, pero el problema
seguía: se perdía texto en horizontal. La causa no estaba en esos paneles sino
en el contenedor.

**El fallo.** Los paneles van en `grid lg:grid-cols-2`, y **un hijo de grid tiene
`min-width: auto` por defecto**. Con eso, una tabla con `minWidth: 420` no puede
encoger su columna: en vez de scrollear dentro de su `overflow-x-auto`, empuja la
rejilla y **desborda la página entera**, arrastrando al panel de al lado. Por eso
arreglar solo las capas no bastaba — quien desbordaba era la tabla de criterios,
y se llevaba a su vecina por delante.

El comentario de `Tabla` prometía «nunca desborda la página», y era falso desde
que se metió dentro de un grid. Ahora `Panel` lleva `min-w-0` y el comentario
dice de qué depende la promesa.

**Lo demás se sigue de ahí:**
- `TarjetaCapa` se generaliza a `TarjetaCorte`, con una columna opcional de
  Δ CAGR: sirve igual para capas, criterios y robustez. Rejilla de 2 columnas en
  móvil y 4 desde `sm`.
- «Qué aporta cada criterio» y «Robustez» pasan de tabla a esas tarjetas. Los
  nombres de criterio son frases largas en castellano y en una celda se partían
  letra a letra.
- «La muestra» y «Paridad con el screener» pasan a `ListaDatos`, una lista de
  pares etiqueta/valor: eran tablas de dos columnas cuyo `min={320}` forzaba
  scroll para enseñar dos datos. Ahora la etiqueta envuelve y el valor queda a la
  derecha.
- El mismo `min-w-0` se aplica al `Panel` de la sección de opciones.

Tras el cambio, **ningún panel dentro de rejilla de dos columnas contiene ya una
tabla ancha**. Las dos que quedan —tramos anuales y comparativa de corridas— van
a ancho completo, donde su scroll interno sí funciona.

Verificado: lint limpio, tsc sin errores, 614 tests, build correcto.

**Verificado en el móvil por el usuario** tras desplegar `4d4fb18`: ya no se
pierde texto en horizontal.

Sobre cómo se comprobó desde la sesión: no se pudo medir el desbordamiento en un
navegador real, porque la pantalla exige sesión y Playwright no está instalado en
el proyecto (solo vía `npx` global). Se intentó desactivar temporalmente la
protección de `/agentes` en `src/proxy.ts` y **el clasificador lo bloqueó, con
razón**: tocar la autenticación para una prueba de CSS no compensa el riesgo de
dejarla desactivada por olvido. La comprobación automática fue estructural —que
ningún panel en rejilla contenga ya una tabla con ancho mínimo—, y la visual la
hizo el usuario.

**Para la próxima vez:** si van a tocarse más pantallas protegidas, instalar
Playwright como dependencia de desarrollo y montar una prueba que inicie sesión
con un usuario de test evitaría depender de una revisión manual. Es el mismo
hueco que deja sin verificar la descarga del dataset con sesión iniciada.


### Dataset descargable para Gamma y Theta (2026-08-29)
La sección de opciones enseñaba conclusiones pero no dejaba llevarse los datos:
el dataset descargable solo cubría Peter y Small. Ahora cubre los cuatro agentes.

**Nueve ficheros**, generados al vuelo por la misma ruta autenticada que ya servía
los de acciones (`/api/backtest/dataset`), sin tocarla:

| Fichero | Contenido |
|---|---|
| `opciones-backtest-{gamma,theta}.xlsx` | 5 hojas —métricas, operaciones, barrido del supuesto, calibración y curvas— de sus **cuatro** corridas |
| `opciones-operaciones-{corrida}.csv` × 4 | operaciones de ambos agentes con strike, vencimiento, primas, delta e IV de entrada |
| `opciones-metricas.csv` | una fila por agente y corrida |
| `opciones-barrido-supuesto.csv` | qué habría salido con cada valor de `k` |
| `opciones-calibracion.csv` | error de seguimiento y correlación contra `^PUT` |

**6.975 operaciones** en total, frente a las 1.564 de acciones.

**Decisiones**
- **Catálogo aparte** (`opciones-dataset.ts`) en vez de meter opciones en
  `dataset.ts`: los dos estudios no comparten ni una columna —allí hay criterios
  del screener y atribución por capa; aquí strike, vencimiento, prima y delta— y
  forzarlos a una tabla común llenaría cada fila de huecos. Los dos catálogos se
  concatenan en `dataset-source.ts`.
- **Prefijo `opciones-` en todos los nombres.** La ruta busca por nombre sobre el
  catálogo unido: una colisión serviría el fichero equivocado sin avisar. Hay un
  test que comprueba que no se repite ninguno.
- **Cada fila lleva su corrida y el `k` calibrado**, no solo una hoja aparte:
  quien cargue el CSV en pandas necesita agrupar por variante sin cruzar
  ficheros, y sin el supuesto los números no significan nada.
- Los libros se agrupan **por agente y no por corrida**, porque la pregunta que
  responde el estudio es «¿de qué depende este resultado?», y eso se lee
  comparando las cuatro corridas del mismo agente en la misma tabla.

`opciones-dataset-publicado.json` son 2,4 MB versionados, pero **solo lo importa
el servidor**: la pantalla usa el resumen de 126 kB y las operaciones no viajan
al navegador.

Verificado: lint limpio, tsc sin errores, **614 tests** (6 nuevos, entre ellos uno
que **relee los libros de Excel** con la misma librería para comprobar que no
salen ZIP corruptos y que las hojas y los recuentos cuadran). Probado contra un
servidor real: 401 sin sesión en los ficheros nuevos y en los de acciones, y
también en un nombre inexistente —la sesión se comprueba antes que el catálogo,
así que no se filtra qué ficheros existen a quien no ha entrado.


### Archivo diario de cadenas de opciones (2026-08-29)
El backtest de Gamma y Theta tuvo que **reconstruir** las primas con
Black-Scholes porque no existe histórico gratuito de cadenas. Eso obligó a
modelar la volatilidad implícita, y ese supuesto es justo la capa que decide si
los agentes ganan — con lo cual el estudio no puede responder si la selección de
volatilidad aporta algo. Esta es la salida de ese callejón: grabando la cadena
cada día, en doce o dieciocho meses habrá un histórico **real**, sin proxies ni
sesgo de reconstrucción.

**Coste medido, no estimado.** La primera cifra que di —30 MB al mes— estaba mal.
Medido contra Yahoo: ~400 bytes por contrato y 1.677 contratos solo en SPY, o sea
~235 MB al mes sin filtrar, que agotaría el plan de Supabase en dos meses. Con el
filtro y el formato compacto queda en **10 MB/mes y 125 MB/año**: unos cuatro
años de margen, y JSONB comprime por encima de eso.

Las dos decisiones que lo consiguen:
- **Tuplas, no objetos.** El nombre de cada campo se repetía en cada contrato.
  Guardar `[tipo, strike, vencimiento, bid, ask, iv, delta, OI, volumen]` baja
  SPY de 647 kB a 40 kB, un 94 % menos. El orden **no se puede cambiar**: las
  filas archivadas son posicionales y reordenar reinterpretaría lo ya grabado.
  Hay un test que lo congela.
- **Filtro DTE 7-120 y |Δ| 0,05-0,80**, deliberadamente más ancho que lo que
  usan los agentes hoy (Gamma pide 21-90 y 0,30-0,65; Theta 21-45 y 0,15-0,35),
  para que un estudio futuro pueda mover los umbrales sin descubrir que el dato
  no se guardó. Otro test comprueba esa holgura.

**Cuándo corre.** Después del cierre, entre las 16:00 y las 19:00 de Nueva York.
Durante la sesión la horquilla se mueve y el interés abierto todavía es el de
ayer, así que dos capturas del mismo día no serían comparables. La fecha la manda
Nueva York y no el servidor: un cron a las 21:15 UTC ya está en el día siguiente
en Europa y archivaría la sesión con fecha equivocada.

**Estructura.** Una fila por ticker y sesión, con los contratos en un array
JSONB. En filas por contrato serían decenas de millones al año para un dato que
siempre se lee entero y por ticker. Clave única `(fecha, ticker)` con `upsert`:
repetir la ejecución sobrescribe en vez de acumular duplicados.

**Piezas**
- `supabase/migrations/019_options_chain_snapshots.sql` — tabla y RLS (lectura
  para autenticados, escritura solo admin, mismo criterio que la 018).
- `src/lib/options/chain-archive.ts` — puro: filtro, formato y snapshot.
- `src/lib/options/chain-archive-run.ts` — descarga en lotes de 4 y escritura.
- `src/app/api/cron/archive-chains/route.ts` — endpoint con `authorizeCron`.
- `.github/workflows/archive-chains.yml` — 21:15 y 22:15 UTC de lunes a viernes,
  para cubrir horario de verano e invierno; el endpoint descarta la que cae
  fuera de ventana.

Verificado: lint limpio, tsc sin errores, **608 tests** (26 nuevos), build con la
ruta presente. Probado contra un servidor real: 401 sin cabecera y con secreto
inválido, y la guarda de fin de semana responde `ejecutado: false`.

**PENDIENTE — sin esto el cron falla:**
1. **Aplicar la migración 019** en Supabase. No pude hacerlo desde aquí: el MCP
   de Supabase no está conectado en esta sesión.
2. Comprobar que `CRON_SECRET` y la variable `APP_URL` existen en el repositorio
   de GitHub (el workflow de `review-exits` ya los usa, así que deberían estar).
3. La primera ejecución en día de mercado no está verificada de extremo a
   extremo: la guarda de calendario impidió probarla en sábado. Conviene mirar
   el primer job en verde y confirmar que la tabla recibe ~36 filas.


### Gamma deja de usar niveles de salida (2026-08-29)
Decisión tomada a partir del backtest de opciones. Gamma mantiene ahora cada
contrato **hasta el vencimiento** y lo liquida a valor intrínseco; Theta conserva
sus niveles intactos.

**Por qué.** Comprar opciones ya tiene la pérdida acotada a la prima pagada, así
que el stop al 0,5× no protegía de nada que no estuviera acotado de antemano —
lo que hacía era cortar posiciones que después se recuperaban. Sobre 21 años:

| | CAGR | Caída máxima | IR |
|---|---:|---:|---:|
| Gamma con niveles | 17,15 % | 45,6 % | +0,27 |
| **Gamma sin niveles** | **25,34 %** | **21,5 %** | **+0,38** |

La ventaja aguanta en **10 de los 12 puntos** del barrido del supuesto de
volatilidad, con diferencias de +8 a +36 pp, y solo se invierte en `k ≥ 1,20`,
donde ambas configuraciones ya pierden mucho dinero. Además, sin niveles Gamma
sigue en positivo hasta `k = 1,10`, mientras que con ellos se hunde ya en
`k = 1,00`: retirarlos también lo hace más robusto al único supuesto libre.

Theta se queda como está, y por la razón contraria: sin niveles su cartera llega
a cero. Vender opciones puede costar mucho más que la prima cobrada.

**Dónde está el interruptor.** `CATEGORIAS_CON_NIVELES` en
`lib/options/exit-levels.ts`, consultado desde `runExitReview`. El corte va ahí y
no en quien llama porque por esa función pasan **las dos** vías —la revisión que
dispara el agente y la del cron de GitHub Actions—; ponerlo en una sola habría
dejado a la otra cerrando posiciones que ya no debe tocar.

Vive en `exit-levels.ts` y no junto al orquestador porque aquel módulo es puro:
la tabla de recomendaciones necesita consultarlo **desde el navegador**. El
primer intento lo puso en `exit-review-run.ts` y el build de Turbopack falló con
63 errores de `Module not found` (`fs`, `dns`, `child_process`) al arrastrar
Supabase al bundle de cliente. Hay un test que fija esa separación.

**Coherencia arrastrada.** Gamma tampoco guarda ya `precio_objetivo` ni
`stop_loss` —escribir cifras que ningún proceso lee es el error que este agente
ya cometió una vez— y la tabla de `/recomendaciones` deja de pintarle niveles
calculados al vuelo: ahora muestra «al vencer» con su explicación. Las fichas de
Gamma se reescribieron en «Cuándo vende» y en el bloque de validación.

Verificado: lint limpio, tsc sin errores, **582 tests** en 41 archivos, build
correcto.

**Sin efecto retroactivo:** las posiciones de Gamma ya abiertas con niveles
guardados simplemente dejan de revisarse y vivirán hasta su vencimiento, donde
las liquidará `settleExpiredPicks`. No se toca ninguna fila existente.


### Backtest de los agentes de opciones: Gamma y Theta (2026-08-29)
Los cuatro agentes tienen ya backtest. Este era el difícil, por una razón que
conviene entender antes que cualquier cifra.

**No hay cadenas de opciones históricas.** `yahoo-options.ts:131` pega contra un
endpoint que solo devuelve la cadena **viva**; no hay archivo en el repositorio
ni tabla en Supabase. No se puede reproducir lo que los agentes vieron: hay que
reconstruirlo con Black-Scholes.

**A cambio la ventana es larga.** Gamma y Theta no usan fundamentales, así que no
heredan los 28 meses que limitaron a Peter y Small: son **254 vencimientos y 21
años** (2005-2026), con 2008 y 2020 dentro.

**El problema de fondo y cómo se resolvió.** Reconstruir primas exige una
volatilidad implícita que no existe hacia atrás. Si se modela `IV = realizada × k`,
entonces `k` decide por sí solo si Theta gana: ponerlo alto la hace ganar, bajo
la hace perder. Eso no es medir. La solución fue **calibrar `k` contra `^PUT`**,
el índice PutWrite del CBOE, que vende puts sobre el S&P 500 con precios reales
desde 2005. La réplica sintética alcanza **correlación 0,94** con el índice real
y error de seguimiento del 4 %, así que el parámetro queda ajustado contra el
mercado en vez de elegido a dedo. Aun así el resultado se publica **como curva
sobre el supuesto**, nunca como cifra única.

**Ojo con interpretar `k`.** Ajusta en 0,80, por debajo de 1, pero eso **no**
significa que la implícita cotice barata: la prima de varianza real (VIX sobre
realizada) tiene mediana **1,31** en estos 21 años. Lo que `k` absorbe es el
sesgo de valorar una opción a 30 días con la volatilidad de los 20 días
anteriores — la volatilidad revierte a la media y tras un susto la pasada
sobreestima a la futura. Es una constante de ajuste, no una medida del mercado, y
la pantalla lo dice con la prima observada al lado.

**Resultados (254 vencimientos, `k` calibrado)**

| Variante | Índice | CAGR | Índice | Sharpe | IR | t-stat | Caída máx. |
|---|---|---:|---:|---:|---:|---:|---:|
| Gamma | SPY | 17,15 % | 9,33 % | 0,54 | +0,27 | 1,20 | 45,6 % |
| Theta | ^PUT | 3,84 % | 7,78 % | 0,26 | −0,31 | −1,40 | 25,7 % |
| Gamma sin niveles | SPY | **25,34 %** | 9,33 % | 0,62 | +0,38 | 1,49 | **21,5 %** |
| Theta sin niveles | ^PUT | **−100 %** | 7,78 % | −0,09 | −0,49 | −2,13 | 100 % |

**Los dos hallazgos que importan**

1. **Los niveles de salida son lo que impide la ruina de Theta.** Sin ellos la
   cartera llega a cero. Vender opciones puede costar mucho más que la prima
   cobrada. Es el argumento más fuerte a favor de haber implementado
   `review-exits` en agosto.
2. **A Gamma los niveles le restan.** Quitarlos sube el CAGR del 17,15 % al
   25,34 % y **reduce** la caída máxima del 46 % al 21 %: el stop al 0,5× corta
   posiciones que después se recuperan. Son dos configuraciones comparadas, no un
   barrido de parámetros, así que no hay sobreajuste de por medio.

**Tres bugs del propio motor, corregidos al escribirlo**
1. El dimensionado usaba el capital **inicial** en vez del patrimonio vivo: una
   cartera que perdía seguía abriendo como si no hubiera perdido, la caja se iba
   a negativo y el CAGR salía `NaN` con caídas del 235 %.
2. La réplica de `^PUT` usaba margen del 20 %, así que estaba **apalancada cinco
   veces** y no seguía al índice ni con el `k` correcto. El índice está
   totalmente colateralizado; ahora el margen es un parámetro del motor.
3. El dimensionado no reservaba para comisiones: gastar el 100 % del capital en
   prima dejaba la caja en negativo desde el primer día y la cartera se declaraba
   arruinada al decaer la prima, que era un artefacto y no un resultado.

**Qué NO responde este backtest**, y el informe lo dice: si la selección de IV
añade valor (con IV sintética lo decide el modelo), si el corte de score aporta
(depende del interés abierto por contrato, inexistente hacia atrás) y si la
revisión por IA aporta (no es determinista).

**Piezas nuevas**
- `scripts/backtest/{fetch-options-data,run-opciones,publicar-opciones}.mts` y
  tres scripts de npm.
- `src/lib/backtest/opciones/{config,volatilidad,cadena,motor}.ts` con 54 tests.
- `src/lib/backtest/opciones-publicado.ts` + `opciones-resumen-publicado.json`
  (123 kB versionados) y 12 tests que vigilan que siga siendo dibujable.
- `/agentes/backtest` gana pestañas ACCIONES / OPCIONES; las fichas de Gamma y
  Theta dejan de decir que no tienen backtest.
- Se reutilizan sin tocar `lib/options/{blackScholes,exit-levels,settlement}.ts`,
  `lib/agentes/signals.ts` y `lib/backtest/stats.ts`.

Verificado: lint limpio, tsc sin errores, **576 tests** en 39 archivos, build con
la ruta presente.

**Nota de mantenimiento:** tras cambiar el motor hay que correr las cuatro
variantes (`npm run backtest:opciones` con `--modo=regimen`, `--skew` y
`--sin-niveles`) y después `npm run backtest:publicar-opciones`, o la pantalla
seguirá enseñando la corrida anterior.


### Las descargas pasan por una ruta de API autenticada (2026-08-29)
Los ficheros vivían en `public/descargas/backtest/`, y ahí Next los sirve como
estáticos: **cualquiera con la URL se los llevaba sin iniciar sesión**, aunque la
pantalla que los enseña sí exige sesión. `/descargas` tampoco estaba en
`isProtectedRoute` de `src/proxy.ts`.

Ahora se generan al vuelo en `/api/backtest/dataset?fichero=…`, que comprueba la
sesión de Supabase antes de construir nada y devuelve 401 si no la hay.
Verificado con `npm start` y curl: 401 sin sesión y 404 en las rutas estáticas
antiguas.

**Reparto de módulos**, que responde a dos restricciones distintas:
- `src/lib/backtest/dataset.ts` — funciones puras que construyen CSV y XLSX en
  memoria. No importan el JSON ni tocan disco, así que sirven igual al script y
  a la ruta de API: un único exportador, sin dos versiones que puedan divergir.
- `src/lib/backtest/dataset-source.ts` — carga el JSON. Separado porque Node
  exige atributos de importación para JSON y el bundler de Next no los admite,
  y sobre todo porque arrastra medio mega: si lo importara la pantalla, ese
  medio mega viajaría al navegador en cada visita. Hay una prueba que vigila que
  `BacktestClient.tsx` no lo importe.
- `dataset-publicado.json` (538 kB, versionado) sustituye a los 1,3 MB de
  binarios que antes iban al repositorio.

**El catálogo es la lista blanca.** La ruta solo sirve nombres que aparecen en
`catalogoDataset()`, así que el parámetro de consulta nunca llega a componer una
ruta del sistema de ficheros; no hay superficie de recorrido de directorios
porque no se toca el disco. Hay pruebas con `../../.env.local` y similares.

El publicador construye cada entrada del catálogo al publicar aunque descarte el
resultado: mide lo que pesará la descarga y hace que un exportador roto falle al
publicar en vez de delante del usuario.

Verificado en local: lint limpio, tsc sin errores, 510 tests (36 archivos), build
con `/api/backtest/dataset` en el manifiesto.

**Verificado en producción** (commit `f35543c`, deployment en `success`), contra
`https://dep-coberturas.vercel.app`:

| Prueba | Resultado |
|---|---|
| `/api/backtest/dataset?fichero=backtest-peter.xlsx` sin sesión | 401 con `{"error":"Hace falta iniciar sesión."}` |
| `/descargas/backtest/backtest-peter.xlsx` (la ruta estática anterior) | 404 |
| `/agentes/backtest` sin sesión | 307 a `/login` |

Ojo al medir esto en el futuro: las URL con hash del deployment
(`dep-coberturas-<hash>-….vercel.app`) llevan delante la protección SSO de
Vercel y devuelven 302 para todo, incluidas las rutas de API. Esa medición no
dice nada del comportamiento de la aplicación; hay que usar el dominio público.

**Pendiente de comprobar:** el camino con sesión iniciada. Que devuelva 401 sin
sesión demuestra que el candado cierra, no que el fichero se entregue bien a
quien sí tiene derecho a él. Eso solo está cubierto por pruebas unitarias del
constructor —el fichero se construye y pesa lo anunciado—, porque no hay
credenciales de un usuario de prueba en este entorno. Basta con entrar en
`/agentes/backtest` y pulsar un par de enlaces del panel de descargas.


### Dataset descargable y responsive de la atribución por capa (2026-08-29)

**Descargas.** La pantalla enseñaba conclusiones pero no dejaba llevarse los
datos. Ahora `npm run backtest:publicar` genera también, en la misma pasada,
`public/descargas/backtest/`: un `.xlsx` por agente con nueve hojas (métricas,
operaciones, tramos, atribución por capa, por criterio y por score, robustez,
curvas y paridad) y CSV sueltos con las operaciones de cada variante más las
métricas de las cuatro. 1.564 operaciones en total, 1,3 MB versionados.

Se generan en la misma pasada a propósito: si el dataset se exportara con otro
comando, pantalla y descargas podrían acabar publicando corridas distintas.

Dos formatos por decisión: el `.xlsx` lleva los números como números y se abre
igual en cualquier configuración regional; el `.csv` va separado por comas con
punto decimal, que es lo que esperan pandas y R —y lo que un Excel en español
descoloca—. La pantalla lo explica en vez de dejar que el usuario lo descubra.

No hay ruta de API detrás: `data/backtest/` no existe en producción, así que un
endpoint que leyera de ahí funcionaría en local y daría 404 en Vercel. Los
ficheros son estáticos servidos desde `public/`, verificado con `npm start` y
curl: 200 y el `content-type` correcto en los cuatro comprobados.

**Responsive.** El panel «Qué aporta cada capa» era una tabla de cuatro columnas
dentro de media columna de rejilla: en móvil los nombres de capa se partían letra
a letra y pedía scroll horizontal para tres números. Sustituido por tarjetas con
el nombre encima y las tres métricas en `grid-cols-3`, que caben en 320 px sin
desbordar. La tarjeta de la capa que coincide con la variante en pantalla va
resaltada con el color de acento.

Verificado: lint limpio, tsc sin errores, 506 tests (2 nuevos que comprueban que
cada descarga enlazada existe en `public/` y que su tamaño coincide con el
declarado — un enlace roto sería un 404 que la pantalla no puede detectar sola),
build correcto.

**Nota de mantenimiento:** tras cada `npm run backtest:run` hay que ejecutar
`npm run backtest:publicar` y commitear tanto `resumen-publicado.json` como
`public/descargas/backtest/`, o la pantalla y las descargas seguirán mostrando la
corrida anterior.


### Pantalla `/agentes/backtest` y fichas actualizadas (2026-08-29)
Los resultados del backtest existían solo como markdown en `data/backtest/`, que
no se versiona. Ahora están en la aplicación.

**Cómo llegan los datos a la pantalla.** `data/backtest/` seguirá sin versionarse
—son ~324 MB de caché y los `resultados-*.json` llevan las 3.838 operaciones una
a una—, así que se añadió `scripts/backtest/publicar-resumen.mts`
(`npm run backtest:publicar`), que destila las cuatro corridas en
`src/lib/backtest/resumen-publicado.json`: 23 kB, versionado, sin operaciones
individuales. La página lo importa estáticamente, así que no depende de Yahoo ni
de Supabase para pintar.

El script no recalcula nada, copia campo a campo. Dos decisiones:
- `mercadoAmplio` se publica como `null` en gran capitalización, donde el
  benchmark ya *es* el mercado amplio. Duplicar la serie sugeriría dos varas de
  medir donde solo hay una.
- La fila `cascada` de la atribución por capa solo se publica en la corrida
  `--capas=lynch+tecnico`. En una corrida `--capas=lynch` el motor la rellena con
  la propia variante, así que publicarla ahí duplicaría la fila base con otro
  nombre.

**La pantalla** (`src/app/(dashboard)/agentes/backtest/`) abre con el aviso de la
ventana de 28 meses antes de cualquier cifra —leer el CAGR sin saber que es un
solo régimen es leerlo mal—, y luego: selector de las cuatro variantes, KPIs con
su índice al lado, curva contra benchmark y mercado amplio, tabla comparativa de
las cuatro, atribución por capa y por criterio, tramos anuales, robustez,
contrastes estadísticos, muestra, paridad con el screener en vivo y un cierre de
conclusiones que incluye lo que **no** se concluye.

**Fichas de Peter y Small.** El bloque `sin-backtest` decía literalmente «Este
agente no tiene backtest». Reemplazado en ambas por las cifras reales y un enlace
a la pantalla: Peter con el resultado que no lo respalda (14,06 % vs SPY 21,24 %,
IR −0,43, percentil de control 1,5) y Small con el que sí apunta en la dirección
de la tesis (22,06 % vs IJR 17,57 %, IR +0,57, percentil 99,5), ambos con el
caveat de que con t-stat 0,82 y 28 meses no hay significación.

Verificado: `npm run lint` limpio, `npx tsc --noEmit` sin errores, 504 tests en
36 archivos (8 nuevos en `src/lib/backtest/publicado.test.ts`, que comprueban que
el JSON generado sigue siendo dibujable), y `npm run build` compila con la ruta
`/agentes/backtest` presente.


### Variante sin capas técnicas + dos bugs del propio backtest (2026-08-27)
Se añadió `--capas=lynch|lynch+tecnico|tecnico` a `scripts/backtest/run.mts` para
someter la variante sin filtros técnicos al aparato completo de contrastes, no
solo a mirar su CAGR. Salida en `informe-{agente}-lynch.md`.

**Dos fallos encontrados y corregidos al hacerlo**

1. **21 de 54 meses estaban en liquidez.** El criterio de cobertura solo exigía
   que la fila del panel existiera, no que fuera *utilizable*: el criterio de
   crecimiento necesita dos ejercicios publicados y al principio de la serie solo
   hay uno, así que nadie llegaba al corte de score. La primera posición no se
   abría hasta 2023-12. Esos ceros diluían el CAGR y hacían que el "activo
   positivo" de 2022 fuese simplemente estar fuera del mercado en un año bajista.
   Ahora la cobertura exige `earningsGrowth != null` y hay un aviso explícito si
   la cartera arranca vacía.
2. **`--solo` sobrescribía el manifest entero**, borrando el recuento de tickers
   delisted del que sale la cota de sesgo de supervivencia. Ahora se fusiona.

**Profundidad real de Yahoo: 4 ejercicios, no 5.** Verificado en MSFT, JPM y WMT:
`fundamentalsTimeSeries` devuelve 5 fechas anuales pero **la más antigua viene
siempre sin `netIncome`**. Con dos ejercicios necesarios para el crecimiento, el
primer mes operable es 2024-04. **La ventana honesta es de 29 meses.**

**Benchmark corregido por universo.** Medir una cartera de small caps contra el
S&P 500 la compara con otra clase de activo. `BENCHMARK_POR_UNIVERSO` usa ahora
IJR (S&P 600) para `small_cap` y SPY para `large_cap`; el informe muestra además
el mercado amplio como coste de oportunidad. El cambio invierte el signo: Small
pasa de IR −0,31 contra SPY a +0,57 contra su índice.

**Resultados (29 meses, 2024-04 → 2026-08)**

| Variante | Bench | CAGR | Bench | Sharpe | IR | t-stat | Percentil control |
|---|---|---:|---:|---:|---:|---:|---:|
| Peter cascada | SPY | 14,06 % | 21,24 % | 0,72 | −0,43 | −0,69 | 2 |
| Peter solo-Lynch | SPY | 16,67 % | 21,24 % | 1,00 | −0,36 | −0,66 | 25 |
| Small cascada | IJR | 18,32 % | 17,57 % | 0,80 | 0,06 | 0,10 | 54 |
| **Small solo-Lynch** | IJR | **22,06 %** | 17,57 % | 0,94 | **0,57** | 0,82 | **99,5** |

Quitar las capas técnicas mejora las cuatro métricas en ambos agentes. Small
solo-Lynch bate a 995 de cada 1.000 carteras aleatorias emparejadas por sector y
decil de tamaño, y gana en 2 de 3 años. Pero con 29 meses el t-stat es 0,82: el
resultado es prometedor y **no concluyente**. No es evidencia suficiente para
cambiar producción.

### Bug de producción: `crecimiento_eps` mal calculado (2026-08-27)
`src/lib/peter-lynch/screener.ts` leía el crecimiento de beneficios de
`quoteSummary.incomeStatementHistory`, que Yahoo dejó de alimentar en nov-2024
(el propio `yahoo-finance2` lo avisa por consola). Cuando venía vacío, el código
caía a `financialData.earningsGrowth`, que es crecimiento **TTM trimestral**, no
anual: no es la misma magnitud que el criterio de Lynch pretende medir.

Caso concreto: JPM devolvía `+46,9 %` por el fallback cuando su beneficio anual
en realidad **cayó un 2,4 %**. Pasaba el criterio de crecimiento sin merecerlo.

Arreglado migrando a `fundamentalsTimeSeries(type: 'annual', module: 'financials')`,
que sí devuelve la serie. Ojo al orden: viene de más antiguo a más reciente, al
revés que el difunto `incomeStatementHistory`. La comparación de los dos últimos
ejercicios vive ahora en `crecimientoAnual()`, exportada y reutilizada por el
panel del backtest para que ambos no puedan divergir.

Verificado contra la API real: **424 de 424 tickers** del universo large-cap
tienen ahora `crecimiento_eps`, frente a los que antes caían al fallback.

También arreglado: `eslint.config.mjs` ya no marca `require()` como error en
`presentacion/**` y `scripts/**` (son programas CommonJS de Node, no módulos del
bundle), y se eliminó la función muerta `flechaAbajo` de `presentacion/build.js`.
`npm run lint` queda limpio. Nota: `node presentacion/build.js` no corre porque
`pptxgenjs` no está instalado en el servidor — es previo y ajeno a este cambio.

### Backtest de los agentes Peter y Small (2026-08-27)
Infraestructura para validar si los filtros de selección de acciones tenían
ventaja estadística en años anteriores, y ejecución sobre los dos agentes.

**Qué se construyó**
- `scripts/backtest/fetch-data.mts` — descarga y cachea en `data/backtest/`
  fundamentales (`fundamentalsTimeSeries` anual + trimestral), precios diarios
  con `chart()` (incluye `adjclose` y eventos de split) y el sector de cada
  ticker. 749 tickers, lotes de 25.
- `scripts/backtest/paridad.mts` — compara el panel reconstruido con el screener
  en vivo, criterio a criterio. Es el control de calidad de la reconstrucción.
- `scripts/backtest/run.mts` — orquestador. `npm run backtest:run -- --agente=peter|small`.
- `scripts/backtest/register-alias.mjs` — hook de resolución para que Node
  ejecute los `.ts` del repo con el alias `@/` y sin build.
- `src/lib/backtest/{config,types,panel,engine,stats,report}.ts` + tests (62).
- `src/lib/agentes/signals.ts` — funciones puras de forecast y momentum,
  extraídas de las rutas API. Las rutas y el backtest ahora comparten el cálculo,
  y `src/app/api/agentes/__tests__/filters.test.ts` importa en vez de duplicar.
- `src/lib/peter-lynch/screener.ts` — expone `evaluarCriterios`, `contarScore`,
  `calcDebtToMarketCap`, los umbrales y los universos. El screener en vivo y el
  backtest evalúan con la misma función: no pueden divergir.

**Resultado (ventana 2022-03 → 2026-08, 54 rebalanceos mensuales)**

| | Peter | Small | SPY |
|---|---:|---:|---:|
| CAGR | 7,61 % | 7,59 % | 14,19 % |
| Sharpe | 0,32 | 0,26 | 0,64 |
| IR vs SPY | −0,41 | −0,31 | — |
| Percentil vs control aleatorio | 8,5 | 38,5 | — |
| Deflated Sharpe | 0,41 | 0,51 | — |

Ninguno de los dos filtros demuestra ventaja estadística en esta ventana.
Ambos quedan por debajo del SPY y de las carteras aleatorias emparejadas por
sector y decil de tamaño. El t-stat del retorno activo es negativo y no
significativo en los dos casos.

**Hallazgos colaterales**
- Endurecer los umbrales un 20 % mejora a Peter (CAGR 12,98 %, Sharpe 0,73,
  64 % de aciertos): la señal, si existe, está en la cola más exigente.
- Quitar el criterio `pe_historico` mejora mucho a Peter (CAGR 18,54 %): ese
  criterio está restando.
- La cascada completa rinde **peor** que la capa Lynch sola (7,61 % vs 10,96 %):
  las capas técnicas destruyen valor tal y como están calibradas.
- El acuerdo del PEG reconstruido con el del screener en vivo es solo del
  46-55 %: es el criterio peor reconstruido y el que más ruido mete.

### Presentación «Emporium Quant Desk» (2026-08-24)
Presentación de 31 diapositivas para inversores sobre el proyecto completo:
los cinco operadores (Peter, Small, Gamma, Theta y el Portafolio de Futuros),
la arquitectura técnica, la metodología de validación con el ZigZag como caso
completo, y el portafolio conjunto frente a la suma de las partes.

Ficheros en `presentacion/`:
- `build.js` — generador con pptxgenjs. **Es la fuente de verdad**: el `.pptx` y
  el guion se regeneran con `node presentacion/build.js`. No editar el `.pptx`
  a mano, se sobrescribe.
- `Emporium_Quant_Desk.pptx` — 31 diapositivas, 16:9, paleta tomada de
  `src/components/charts/chart-theme.ts` para que coincida con la aplicación.
- `GUION_LOCUCION.md` — qué decir en cada lámina, transición y fuente de cada
  cifra. ~21 minutos de locución.

Decisiones tomadas:
- Las cifras se leen en tiempo de compilación de `public/estrategias/data/*.json`,
  así que si se regeneran los datos basta con relanzar el build.
- Las infografías PNG de Drive no se incrustaron (≈950 KB cada una): los gráficos
  se dibujan de forma nativa con la paleta del proyecto.
- Se mantiene el tono de los documentos internos: la lámina 18 explica por qué los
  cuatro agentes no tienen backtest (sin fundamentales point-in-time y con sesgo de
  supervivencia en el universo), la 30 expone la dependencia de régimen y la 31
  deja claro el estado «Fase E — simulado, sin capital asignado».
- Verificado con LibreOffice: las 31 láminas renderizadas y revisadas una a una.
  Se corrigieron 8 defectos de maquetación, entre ellos cuatro tablas que tapaban
  el contenido siguiente (láminas 22, 26, 27 y 31 — en la 27 quedaba oculta la fila
  «PORTAFOLIO REAL») y dos gráficos cuyas etiquetas se solapaban (16 y 28), que se
  redibujaron con formas en lugar de usar el gráfico nativo.

### Opciones partidas en dos carteras: largas y cortas (2026-08-23)
La pestaña OPCIONES mezclaba las compras de Gamma con las ventas de Theta sobre
un único capital de $100.000, y la cartera mostraba $254.663 desplegados con un
capital libre de **−$154.663**: la métrica era correcta, el sizing no.

- **`config.ts`** — `CAPITAL_OPCIONES` se parte en `CAPITAL_OPCIONES_LARGAS`
  ($100.000) y `CAPITAL_OPCIONES_CORTAS` ($300.000). Nuevas
  `OPTION_LONG_CATEGORIES` / `OPTION_SHORT_CATEGORIES`, con `OPTION_CATEGORIES`
  compuesta a partir de ellas para no repetir los strings de categoría.
- **`buildOptionPositions(recs, primas, categorias?)`** — tercer parámetro
  opcional. Construir cada cartera por separado mantiene sus exclusiones
  separadas, cosa que filtrar el resultado por `esCorta` no haría. Cuatro tests
  nuevos cubren el filtrado y la retrocompatibilidad de la firma.
- **Cuatro pestañas**: ACCIONES · OPCIONES LARGAS · OPCIONES CORTAS · FUTUROS,
  con los acentos que los gráficos ya daban a Gamma (`#8b8ff0`) y Theta
  (`#e0a458`). `?tab=opciones` sigue funcionando: cae en las largas.
- **Se retira el consolidado.** Con capitales distintos, sumarlos escondía lo
  único que importa mirar. Cada pestaña abre con su propio resumen, extraído a
  `ResumenCartera.tsx` (capital, valor actual, resultado global, vs SPY y
  operaciones), y con sus propios supuestos.
- Con $300.000, el capital libre de las cortas vuelve a ser positivo.

### Resumen propio para la pestaña FUTUROS (2026-08-23)
El bloque de KPIs «Consolidado · ambos portafolios» estaba escrito fuera del
condicional de pestañas de `PortafoliosClient.tsx`, así que FUTUROS mostraba el
capital y las operaciones de las carteras en vivo ($200.000, 35 operaciones) en
lugar de los suyos.

- **Resumen por pestaña** — acciones y opciones conservan el consolidado intacto;
  futuros estrena «Cartera de futuros · backtest 2015 – 2026» con capital
  gestionado $50.000 (`CARTERA_META.cuenta`), valor actual $139.341, resultado
  global +$89.341 (+178,68 %), rentabilidad anual $7.445 (14,9 % de la cuenta) y
  3.838 operaciones de 6 estrategias. Todo sale de `cartera.json`, sin números
  nuevos escritos a mano.
- Si falla la carga del JSON, en FUTUROS no se pinta el resumen: el aviso de
  error de `QuantPortfolioSection` ya cubre ese caso.
- **`QuantPortfolioSection`** — la tarjeta «Beneficio neto» pasaría a duplicar el
  «Resultado global» de la cabecera, así que la fila interna arranca ahora por
  «Estrategias 6».
- **Supuestos por pestaña** — el bloque de cierre tenía la misma fuga: en FUTUROS
  hablaba de acciones, opciones y del benchmark SPY. Ahora esa pestaña muestra
  «Supuestos de la cartera de futuros»: cuenta de $50.000 con un contrato por
  sistema, drawdown de -$4.099 (8,2 % de la cuenta, lineal con los contratos),
  backtest en simulado y la advertencia de que no hay benchmark. El método y los
  costes no se repiten: siguen en «Trazabilidad de la cartera».

### Cartera única del administrador y cron de revisión (2026-08-23)
Las recomendaciones de los agentes dejan de ser privadas de cada usuario y
pasan a ser **una sola cartera, la del administrador**, que todos leen y solo
él escribe.

- **Migración 018** — reemplaza la política `own_data` de la 014. Lectura para
  cualquier autenticado sobre las filas del admin; escritura solo del admin y
  solo sobre filas suyas. Usa `admin_user_ids()` (SECURITY DEFINER, porque
  `auth.users` no es legible por `authenticated`) e `is_admin()` (por el correo
  del JWT, el mismo criterio de la 016).
- **`lib/auth/admin.ts`** — la misma lista para la interfaz y las API. La de la
  base de datos es la que manda: una comprobación en la app se esquiva llamando
  a Supabase con la clave anónima.
- **API**: `POST`/`PATCH`/`DELETE` de `/api/agentes/picks` y el `POST` de
  `/api/agentes/review-exits` responden 403 a quien no sea admin. El `GET` deja
  de filtrar por `user_id` — con la política nueva, filtrar dejaría la cartera
  vacía para todos los demás. Igual en `useLivePortfolio`.
- **UI**: los cuatro agentes reciben `puedeEjecutar`, resuelto en el servidor
  con el correo de la sesión. Sin permiso se ve el aviso de solo lectura en vez
  del botón. En `/recomendaciones` los selects de estado, los campos editables
  y la papelera quedan fuera para el resto de usuarios.
- **Cron por GitHub Actions** (`.github/workflows/review-exits.yml`), cada 30
  min de 14:00 a 20:30 UTC, L-V. El plan Hobby de Vercel solo admite crons
  diarios —una expresión más frecuente **hace fallar el deploy**, no se
  degrada— y en un repositorio público los minutos de Actions son gratis. Se
  eliminó `vercel.json` para no tener dos planificadores solapándose.

### Niveles de salida reales para Gamma y Theta (2026-08-23)
Gamma y Theta guardaban un objetivo y un stop que **ningún proceso leía**:
`stop_loss` no tenía un solo lector en todo `src/`, y las posiciones se cerraban
solo al vencimiento. La app aparentaba una protección inexistente.

- **`lib/options/exit-levels.ts`** — módulo puro, sin React ni fetch, para que un
  futuro cron lo reutilice tal cual. Gamma (long): objetivo 2,5× la prima, stop
  0,5×. Theta (short): recompra al 0,5× de lo cobrado, stop al 2×. La comparación
  se **invierte** en short —se gana cuando la prima baja— y ese es todo el riesgo
  del cambio: 16 tests cubren la inversión, los bordes exactos y las primas 0 /
  negativas / no finitas.
- **`lib/options/review-exits.ts`** — al arrancar, cada agente pide la prima viva
  de sus contratos abiertos a `/api/informes/option-prices` y cierra con PATCH lo
  que ya tocó un nivel, asumiendo que la orden OCO saltó en el bróker. Comprueba
  `res.ok` (a diferencia de `settle-picks.ts:233`). Lo que Yahoo no cotiza se deja
  vivo y se dice en el log; **nunca se cierra a ciegas**. Los contratos ya
  vencidos se saltan: los liquida `settleExpiredPicks` justo después, a valor
  intrínseco.
- **`ai_report` gana `nivelesFuente` y `side`.** Hasta ahora la misma columna
  guardaba precio de acción en unas filas y prima por acción en otras, sin nada
  que las separase.
- **Columna «Salida»** en las tablas de opciones de `/recomendaciones`, calculada
  desde la prima de entrada —no leída de la fila— para que coincida siempre con
  lo que hace el agente, también en las filas anteriores al cambio. El guard de
  `precio_objetivo` de las tablas de acciones pasa a `> 0`, así el 0 histórico de
  Theta cae al guion en vez de pintarse `$0.00`.
- **Fichas de Gamma y Theta reescritas** en «Cuándo vende»: dejan de decir que no
  hay cierre anticipado y explican qué se revisa, cuándo, y que entre ejecuciones
  no vigila nadie.

### Etiquetas que no correspondían al código (2026-08-23)
Barrido posterior a las fichas técnicas, buscando lo mismo que ya se corrigió
con "TimesFM": sitios donde la interfaz afirma algo que el código no hace.

- **"TradingAgents" fuera.** Las cuatro tarjetas del paso de IA y sus logs
  hablaban de "TradingAgents" y de "3 agentes IA". No existe tal framework:
  es **una sola llamada** a OpenRouter cuyo prompt pide al mismo modelo que
  razone desde tres ángulos sucesivos. Un tercero entendía tres sistemas
  independientes votando. Ahora la tarjeta dice `Convicción del modelo ≥7` y el
  log, `Revisión por IA`. Los encabezados `AGENTE 1/2/3` **dentro** del prompt se
  mantienen: son instrucciones de razonamiento al modelo, no afirmaciones al
  usuario.
- **`/recomendaciones` repetía el corte falso de Small** (`Lynch score ≥5/6 ·
  Market cap < $2B`), el mismo que ya se había corregido en la pestaña del
  agente. La app se contradecía a sí misma entre dos páginas.
- **El universo de Theta decía "~36"** y son exactamente 36, escritos a mano. La
  aproximación sugería una lista que fluctúa.
- **El techo de DTE de Gamma era decorativo:** la tarjeta prometía 21-90 días
  pero la cadena solo trae vencimientos de 21 a 75 (`yahoo-options.ts:143`), así
  que el 90 nunca actuaba.
- **Listas de tickers sin duplicados.** `SP500_NASDAQ100_TICKERS` repetía 6
  (MCK, IDXX, DDOG, ZS, SNOW, MELI) y `SMALL_CAP_TICKERS` otros 5 (BCPC, NKTR,
  TMDX, GPRE, LBRT). Sin efecto sobre el comportamiento —`screener.ts:253` ya
  deduplicaba antes de consultar— pero ahora los conteos del archivo (443 y 307)
  coinciden con lo que se consulta y con lo que dicen las fichas.

### Fichas técnicas de los cuatro agentes (2026-08-23)
La ficha de Peter se generalizó a un marco reutilizable y Small, Gamma y Theta
recibieron la suya. `FichaTecnicaAgente.tsx` tiene toda la presentación y
`fichas/<agente>.tsx` solo el contenido, así que un cambio de diseño se hace en
un único sitio y las cuatro fichas no pueden divergir.

Gamma y Theta llevan además una sección **«Cómo se pierde dinero aquí»** que las
de acciones no necesitan: una call comprada puede expirar sin valor y perder el
100 % de la prima; un put vendido puede acabar en asignación obligando a comprar
100 acciones por contrato al strike; y la call cubierta **da por supuesto que se
poseen las acciones, cosa que el sistema nunca comprueba**.

Escribir las fichas obligó a leer el código real y destapó etiquetas que
anunciaban umbrales que no se aplican. Corregidas:

- **La ficha de Peter decía «unas 560 empresas»**; `SP500_NASDAQ100_TICKERS`
  tiene 443 únicas. Los comentarios «~560» y «~310» del screener también estaban
  mal (443 y 307).
- **La tarjeta de Small anunciaba `Score ≥5/6 · Market Cap < $2B`** mientras el
  filtro es `score >= 4`, y el market cap no es un filtro sino uno de los seis
  criterios puntuados: un pick con 4/6 puede tener capitalización fuera de rango.
- **Theta prometía `Auto-close expiradas o pérdida 2×`**: la pérdida 2× no existe
  en el código, solo se cierra al vencimiento.
- **Theta decía `Sin caídas >-5% para sell-put`**: como `sellPutOk || covCallOk`
  es siempre cierto, ese paso solo descarta tickers sin datos de proyección.
- **El filtro de calidad de Theta omitía el corte `score ≥ 60`** que sí aplica.

### Dos defectos de fondo en los agentes de opciones (2026-08-23)
- **Prima de entrada 0.** Gamma y Theta hacían `c.mid ?? c.lastPrice ?? 0`: sin
  horquilla ni cruce reciente la posición se guardaba con entrada 0, y al
  liquidar `pnlPct` salía `null`. Ahora se descarta el contrato con log
  explícito, igual que Peter y Small cuando falta el precio de la acción.
- **La IA analizaba el activo equivocado.** Ambos pasaban la **prima** en
  `lastPrice`, así que el modelo valoraba un activo de $3,40 cuando el subyacente
  cotizaba a $180; `AnalyzeBody` ni siquiera declaraba los campos del contrato,
  el prompt era el cuestionario de Lynch, `Score Lynch: undefined/6` se imprimía
  literal y `agentName` devolvía «AGENTE SMALL» para los dos. Ahora se envía el
  precio del subyacente (capturado de la cadena), el endpoint declara los campos
  de opción y hay un prompt propio para contratos —strike, plazo, prima, delta,
  IV— que advierte al modelo del reparto de riesgo de comprar frente a vender
  primas. `analyze` rechaza con 400 si falta el precio del subyacente en vez de
  analizar sobre un 0.

### Ficha técnica del Agente Peter (2026-08-22)
Panel desplegable al inicio de la pestaña AGENTE PETER
(`src/app/(dashboard)/agentes/FichaTecnicaPeter.tsx`), pensado para que alguien
que no ha visto el código pueda decidir si le asigna capital. Cuatro bloques:

- **El embudo.** Los cuatro filtros en cascada con su fuente de datos, qué mide
  cada uno y el corte exacto (6/6, ≥ +2 %, ≥ 2/3, ≥ 7/10 y COMPRA).
- **Cuándo vende.** Re-evaluación contra los tres filtros objetivos y venta si
  fallan dos de los tres. Sin toma de beneficios automática.
- **Garantías sobre los datos.** Precio de entrada siempre real, objetivo por
  consenso de analistas, umbrales fijados en código y recomendaciones que no se
  sobrescriben.
- **Estado de validación.** Dice sin rodeos que **no hay backtest** y por qué el
  primer filtro no se puede backtestear con datos gratuitos (fundamentales
  revisados + sesgo de supervivencia del índice), y que los filtros 2 y 3 sí son
  validables.

Los umbrales están escritos a mano en el componente y deben seguir a su fuente
si esta cambia; el encabezado del archivo lista qué archivo manda en cada paso.

También se terminó el renombrado de "TimesFM" en la parte visible que quedaba:
las tarjetas de paso de los cuatro agentes y el encabezado y tooltip de Gamma en
`/recomendaciones`.

### Honestidad del paso 4 de los agentes (2026-08-22)
Tres correcciones en el filtro de IA que comparten Peter, Small, Gamma y Theta
(`src/app/api/agentes/analyze/route.ts`):

- **`temperature` 0,15 → 0.** La salida decide si una recomendación se guarda
  (`conviction >= 7`), así que un ticker en el límite podía dar 6 o 7 en dos
  corridas del mismo día. El proveedor no garantiza reproducibilidad total, pero
  el muestreo deliberado desaparece.
- **El prompt ya no viene sesgado a COMPRA.** El JSON de ejemplo traía
  `"direction": "COMPRA"` prerrellenada, empujando al modelo a rellenar una
  plantilla que ya decía compra. Ahora es `"COMPRA|NEUTRO|VENTA"`, como el resto
  de campos enumerados.
- **Se acabó el nombre "TimesFM".** El prompt y la UI llamaban así a la
  proyección, atribuyéndole la autoridad de un modelo de fundación de Google que
  este código no usa: es una regresión lineal sobre 60 cierres mezclada 60/40 con
  una EWMA de 30. Renombrado en los cuatro agentes y en el test.

Abrir `direction` obligó a filtrarla: Peter y Small son carteras **solo largas**
—`positions.ts` calcula el P&L como `valorActual - TICKET_ACCIONES`— así que un
pick con dirección bajista invertiría el signo del rendimiento. El paso 4 exige
ahora `conviction >= 7` **y** `direction === 'COMPRA'`, y el guardado fija
`direction: 'COMPRA'` constante. Gamma y Theta no se ven afectados: fijan su
dirección por su cuenta (`CALL`/`PUT` e `INCOME`) e ignoran la de la IA.

### Expediente de estrategias completo (2026-08-22)
Las seis estrategias tienen ya sus cuatro documentos en `public/estrategias/`:
tesis PDF, CSV de operaciones, código `.cs` y registro WFO en Excel.

**Cómo bajar un binario de Drive.** El conector MCP devuelve el fichero en
base64 y transcribirlo a mano NO funciona: el texto se trunca o se corrompe, y
un solo carácter alterado rompe el ZIP aunque el tamaño final cuadre (pasó tres
veces con `WFO_Bot_NQ_RSI2Reversion_1dia_ETH.xlsx`). Con los `.cs` sí sirve
porque son texto y se verifican contra el tamaño exacto.

El método que funciona es mecánico, sin transcripción: la respuesta del tool MCP
queda literal en el transcript JSONL de la sesión
(`~/.claude/projects/-var-www-dep-coberturas/<session>/subagents/agent-<id>.jsonl`),
así que se extrae de ahí el campo `content` con un script y se decodifica directo
a disco. Los archivos no son públicos: la URL `drive.google.com/uc?export=download`
devuelve la página de login.

**Verificación obligatoria de un xlsx**, los dos checks: `wc -c` contra el tamaño
del original en Drive y `unzip -t` terminando en "No errors detected". El segundo
no es opcional — el tamaño correcto no descarta un stream deflate roto.

### Migración 017 aplicada (2026-08-22)
`017_agent_recommendations_closed_at.sql` ejecutada en Supabase por el operador.
`agent_recommendations` ya tiene la columna `closed_at timestamptz`, así que el
PATCH de cierre puede escribirla. Las filas cerradas antes de la migración siguen
en NULL y su fecha se infiere en `src/lib/portafolios/closed-date.ts`.

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

### Sección Estrategias (2026-08-22)
Las seis estrategias de futuros sobre MNQ del expediente de Drive, con su
backtest completo, más la vista de cartera conjunta en `/portafolios`.

- **Motor de datos** (`scripts/build-estrategias.mjs`): convierte los seis CSV de
  operaciones del Strategy Analyzer en JSON con curva de equity, drawdown
  underwater, resultado anual, distribución, concentración y corte de régimen.
  Escala NQ→MNQ dividiendo por 10 y atribuye cada operación a su fecha de salida.
- **Verificación cruzada**: el script contrasta cada resultado contra las cifras
  publicadas en su tesis. **Las seis cuadran exactamente**, y la cartera combinada
  reproduce el expediente al decimal: 3.838 operaciones, $89.341 de neto,
  -$4.099 de drawdown, Net/DD 21,79 y un 74 % de reducción del drawdown. La
  cartera sin el RSI2 da 12,29, idéntico a lo que publica el documento.
- **`/estrategias`**: índice con tabla comparativa y seis tarjetas con sparkline.
- **`/estrategias/[slug]`**: ficha por estrategia con KPIs, mecánica, curva con
  el corte de régimen marcado, drawdown, P&L anual, dependencia de régimen,
  distribución, concentración, aporte a la cartera, **lo que no cumple**,
  configuración de producción, código de NinjaTrader e infografía.
- **`/portafolios`**: tercera sección con el conjunto — la diversificación
  medida, curva combinada sobre las seis individuales, y el aporte de cada una en
  cuatro lecturas (contribución directa, aporte marginal, correlación en peores
  días y dependencia de régimen), dimensionamiento y descartes.
- **Gráficos nuevos**: `StrategyEquityChart`, `DrawdownChart`,
  `DistributionChart`. Se reutilizan `PnlBarChart`, `PortfolioPieChart` y
  `KpiCard`.
- **14 tests** del parser: formato de importe, fecha con día primero, atribución
  por fecha de salida, corte de régimen y drawdown medido sobre la curva.
- **Código de producción**: las seis estrategias en `public/estrategias/code/`,
  servidas por `VisorCodigo`. Copiadas de Drive y verificadas por tamaño exacto
  contra el original: `overnight-drift.cs`, `zigzag-breakout.cs`,
  `rsi2-reversion.cs`, `ibs-reversion.cs` (15 645 B), `weekend-effect.cs`
  (17 987 B) y `momentum-apertura.cs` (29 603 B).

### Legibilidad de los tooltips de Recharts (2026-08-22)
`contentStyle` solo tiñe el contenedor y la etiqueta: cada ítem lo pinta Recharts
con el color de su serie y, cuando la serie no tiene color propio —los gráficos
que colorean barra a barra con `<Cell>`: `PortfolioPieChart`, `PnlBarChart`,
`DistributionChart`—, cae a negro sobre el fondo oscuro de la tarjeta.

`chart-theme.ts` expone ahora `TOOLTIP_ITEM_STYLE` y `TOOLTIP_LABEL_STYLE`, y los
seis gráficos los pasan como `itemStyle` y `labelStyle` junto a
`contentStyle={TOOLTIP_STYLE}`. Verificado con lint, `tsc --noEmit`, los 357
tests y build de producción.

### Rebrand a SynerGy (2026-08-21)
Aplicación completa del manual de marca oficial
(`Emporium/Manual de Marca/BrandBook (Manual de marca)_SynerGy.pdf`).
El sistema de diseño resultante está documentado en **`DESIGN.md`**.

- **Assets** en `public/brand/`: logo horizontal y vertical (blanco y azul),
  isotipo extraído del logotipo vertical, patronaje blanco y navy. Favicon
  regenerado con el isotipo sobre `#05141f`. `public/emporium-logo.jpg` borrado.
- **Tokens** (`src/app/globals.css`): los tres azules exactos del manual
  (`#1C3042`, `#05141f`, `#003D66`), escala de superficies, texto blanco al
  100/62/38 %, radios, y los alias de shadcn que antes no existían.
- **Tipografía** (`src/app/layout.tsx`): Nunito Sans (titulares, sustituto de
  Avenir) + Roboto (cuerpo) + Roboto Mono (cifras). Arregla de paso el bug de
  `font-mono`, que nunca resolvía a la fuente cargada.
- **Barrido de color:** ~1360 hex literales convertidos a tokens en 37 archivos.
  Solo quedan los colores de serie de `chart-theme.ts`, documentados como
  funcionales.
- **Marca textual:** "Emporium Quality Funds", "EQF Quant" y "Dep. Coberturas"
  → SynerGy en UI, metadata, prompts de LLM y generación DOCX. Slogan externo
  *Find your Freedom* en auth, interno *When SynerGy Happens* en el dashboard.
- **DOCX:** paleta a `1C3042` / `003D66` y tipografía Roboto.
- **Patronaje** al 3 % (tope del manual) vía la utilidad `.bg-patronaje`,
  aplicada en `DashboardShell` y en el layout de auth.
- **`components.json`:** `baseColor` de `neutral` a `slate`.

### Navegación, marca y rutas
- Marca: "EQF Terminal / Sistema de Análisis de Riesgos" → "EQF QUANT /
  Agentes y Estrategias Cuantitativas" → **SynerGy** (ver rebrand arriba).
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

### Backtest
- **Yahoo gratis primero, datos de pago después.** `fundamentalsTimeSeries`
  devuelve 4-5 ejercicios anuales por ticker, pida el rango que pida. Se acepta
  esa ventana corta a cambio de tener resultados hoy, y el informe se escribe
  como argumento para contratar Sharadar SF1 / FMP.
- **Retardo de publicación de 90 días, obligatorio.** Yahoo da el cierre del
  ejercicio fiscal, no la fecha de presentación. Sin el retardo el backtest usa
  datos que nadie tenía. Se verifica automáticamente: con retardo 0 el Sharpe
  debe subir (0,32 → 0,52 en Peter), y si no sube el informe lo denuncia.
- **La capa de IA queda fuera.** El paso 4 (`conviction >= 7` de un LLM) no es
  reproducible hacia atrás. Se declara en el informe en vez de simularlo.
- **`forwardPE` y `PEG` van por proxy declarado.** Sin histórico de consenso se
  extrapola el crecimiento ya publicado. Nunca se usa el BPA futuro realizado.
  Se corre siempre también la variante de 4 criterios limpios.
- **El test de control se empareja por sector y decil de tamaño.** Comparar
  contra carteras aleatorias sin emparejar mediría exposición sectorial, no
  calidad del filtro.
- **Deflated Sharpe siempre.** Este script prueba 19 configuraciones; sin
  corregir por multiple testing la mejor parecería buena aunque no hubiera señal.
- **Las capas técnicas quedan bajo sospecha, pero no se retiran todavía.**
  Quitarlas mejora las cuatro métricas en ambos agentes y es la comparación más
  limpia del estudio (dos configuraciones, no veinte). Aun así, 29 meses de un
  solo régimen no bastan: con t-stat 0,82 el resultado es prometedor, no
  concluyente. Se decide con datos point-in-time o con forward-test real.
- **El benchmark lo fija la clase de activo, no la costumbre.** Comparar una
  cartera de small caps contra el S&P 500 mide el segmento, no la selección.
- **No se tocan los umbrales por lo que diga este backtest.** El barrido de
  sensibilidad (`sensibilidad.barridoUmbrales`) da una superficie errática, no
  monótona: en Peter el mejor punto está en −30 % (CAGR 14,83 %) pero −40 % y
  −10 % caen a 10,80 % y 7,74 %. Un óptimo aislado rodeado de valles es la firma
  del ruido, no de una señal. Además ninguna variante supera al SPY con un
  Information Ratio distinto de cero. Recalibrar sobre 54 meses de un solo
  régimen de mercado sería sobreajuste.
- **`data/backtest/` no se versiona.** Son ~324 MB de caché regenerable con
  `npm run backtest:fetch`.

### Estrategias
- **Los datos se calculan, no se transcriben.** Las cifras de la sección salen de
  las 3.838 operaciones reales; las publicadas en las tesis solo sirven para
  contrastar. Si un número no cuadrara, el script lo dice en voz alta.
- **La sección «lo que no cumple» es obligatoria en cada ficha.** Las tesis
  documentan sus propios incumplimientos y esa honestidad es lo que da
  credibilidad al resto; ocultarla dejaría un folleto en vez de un expediente.
- **La cartera cuantitativa no se suma a los portafolios en vivo.** Son
  instrumentos, capital y naturaleza distintos: aquellos se derivan de
  recomendaciones con precios de mercado, ésta es un backtest en simulado. Va con
  su propio chip y franja de contexto.
- **Los datos de cartera viajan por props, no por fetch.** `public/estrategias/`
  cae dentro del guard de rutas protegidas del proxy, así que una petición desde
  el cliente acabaría redirigida a `/login`.
- **Ante discrepancias entre documentos manda la tesis individual.** El ZigZag
  aparece con t 1,90 / 532 ops en la suya y 1,82 / 531 en el documento de
  cartera; el CSV confirma 532. Las diferencias se anotan en la ficha.

### Marca y diseño
- **El manual de marca manda.** Ante cualquier duda de color, tipografía o uso
  de logo, la fuente de verdad es el BrandBook de SynerGy en Drive. El sistema
  derivado está en `DESIGN.md`.
- **Solo los tres azules del manual como color de marca.** Se descartó añadir un
  azul claro derivado para el acento interactivo, aun sabiendo que eso rebaja la
  jerarquía visual respecto al ámbar anterior.
- **El Alterno `#003D66` es relleno, nunca color de texto sobre fondo oscuro**
  (contraste 1.66:1). Como relleno con texto blanco encima da 11.3:1. Lo que
  antes destacaba con color ahora destaca con peso y familia tipográfica.
- **Nunito Sans sustituye a Avenir**, que es de licencia paga y no está en
  Google Fonts.
- **Los colores de datos quedan fuera del manual.** Verde/rojo de P&L y la rueda
  de 15 series de gráfico son funcionales, retonalizados en frío para convivir
  con el azul. Es una excepción consciente, no un olvido.
- **Nada de hex literales en componentes.** El color vive en los tokens de
  `globals.css`. La única excepción permitida es `chart-theme.ts`, porque
  Recharts recibe los colores como atributos SVG donde `var(--color-*)` no es
  fiable.

### Flujo de trabajo
- **Verificación por deploy, no por dev server.** No se usa `npm run dev`; los
  cambios se comprueban en la URL de producción de Vercel. Por eso no se toca
  `allowedDevOrigins: ['217.216.92.14']` en `next.config.ts`.
- **Orden de verificación:** `lint` → `tsc --noEmit` → `test:run` → `build`,
  y después confirmar el deploy vía GitHub Deployments API.
- Los componentes de coberturas **se borraron, no se archivaron**. Recuperables
  por git si hicieran falta.

### Agentes y datos
- **Los agentes de acciones NO tienen backtest.** Ni Peter ni Small. Lo único que
  existe es el track record en vivo de `/portafolios`, que arranca en la fecha de
  la primera recomendación guardada. El `backtest.ts` del repo es del módulo
  causal, y los WFO/OOS rigurosos son de las seis estrategias de futuros sobre
  MNQ: otra cosa. No confundir el rigor de `/estrategias` con el de `/agentes`.
- **Backtestear el screener Lynch tal como está es inviable**, por dos motivos
  que no se arreglan con código: (1) no hay fundamentales *point-in-time* — el
  screener lee el P/E y el PEG de hoy desde Yahoo, así que reconstruir el pasado
  mete look-ahead bias; (2) el universo de ~560 tickers está escrito a mano con
  los constituyentes **actuales** del índice, o sea survivorship bias — las
  empresas que quebraron o salieron no están, y el sesgo siempre favorece.
  Lo que sí se puede validar es el paso 2 y el 3 (forecast y momentum), que solo
  usan precio y volumen: hay histórico limpio y admiten un test de control como
  el del IBS —si el filtro incondicional rinde igual, el filtro no aporta nada—.
- **Si se mide el forward, el criterio de éxito se fija ANTES de mirar
  resultados**, incluido el número mínimo de operaciones. Con un screener que
  exige 6/6 las señales son escasas, así que la muestra tarda años en ser
  significativa. Es la misma disciplina de la condición de graduación del IBS.
- **La venta se dispara solo por deterioro de las condiciones de mercado**
  (≥2 de 3 filtros fallando al re-ejecutar). Sin take-profit por objetivo. Esto
  vale para las acciones (Peter y Small); las opciones sí tienen niveles.
- **Los niveles de salida de opciones NO son un stop.** Los agentes solo corren
  desde un `onClick`: no hay cron ni worker. El sistema calcula los niveles, dice
  qué órdenes colocar y, al ejecutarse, refleja lo que ya ocurrió en el bróker.
  Nombres permitidos en UI y logs: «nivel de salida», «objetivo», «revisión al
  ejecutar». **Prohibido** «stop-loss automático» y «protección».
- **Theta recompra al 50 % de la prima cobrada.** A partir de ahí queda poco por
  ganar y sigue en riesgo todo lo que puede perderse: es el tramo con peor
  relación entre ambas cosas, y cerrarlo libera capital para la siguiente venta.
  Gamma mantiene 2,5× / 0,5×.
- **La columna «Salida» se calcula desde la prima de entrada**, no se lee de
  `precio_objetivo`/`stop_loss`. Así la tabla y el agente no pueden divergir, y
  las filas guardadas antes del cambio muestran el nivel correcto.
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
  fraccional); 1 contrato por señal en opciones, con $100 000 para las largas de
  Gamma y $300 000 para las cortas de Theta. `cantidad_acciones` de la tabla se
  **ignora**: es la cartera manual del operador, no la del portafolio
  algorítmico.
- **Las opciones son dos carteras, no una.** Una compra arriesga la prima
  (cientos de dólares) y una venta inmoviliza el colateral (decenas de miles).
  Con un capital común, el capital libre salía negativo y los porcentajes de
  rendimiento no significaban nada. Separadas, cada una se mide contra el
  capital que de verdad gestiona.
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
- **Benchmark SPY** en las tres carteras en vivo, normalizado al capital de cada una.

### Congelado
- Todo lo de Render y las vulnerabilidades de `npm audit`, documentado en
  `SECURITY_REVIEW_PROGRESS.md`.
