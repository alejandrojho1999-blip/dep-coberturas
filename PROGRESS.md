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
| 1 | Portafolios | `/portafolios` | Portafolios Algorítmicos de Acciones y Opciones |
| 2 | Agentes | `/agentes` | Agentes IA para Acciones y Opciones |
| 3 | Estrategias | `/estrategias` | Seis sistemas algorítmicos de futuros sobre el Nasdaq |
| 4 | Recomendaciones | `/recomendaciones` | Panel de Recomendaciones |

Fuera del menú pero con ruta viva: `/dashboard`, `/ergos-quant`,
`/perfil` y `/fincept-terminal` (estas dos bajo Configuración).

---

## Pendiente

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
- Qué hacer con `/dashboard` y `/ergos-quant`: siguen vivas pero sin entrada de
  menú.
- `OPENROUTER_API_KEY` y `FRED_API_KEY` están vacías en `.env.local`. En Vercel
  sí están cargadas, pero sin ellas no se pueden probar recomendaciones ni
  agentes en local.

---

## Completado

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
