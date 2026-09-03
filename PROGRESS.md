# PROGRESS — Plataforma de Agentes y Estrategias Cuantitativas

> Notas de trabajo del producto. Lo relativo al despliegue en Render y a la
> auditoría de seguridad vive en `SECURITY_REVIEW_PROGRESS.md` (congelado).

---

## Estado actual

**Último commit:** tesis de inversión con archivos adjuntos como fuente de
verdad, rama `main`

| Check | Resultado |
|---|---|
| `npm run lint` | **0 problemas** |
| `npx tsc --noEmit` | exit 0 |
| `npm run test:run` | **894/894** (67 ficheros) |
| `npm run build` | exit 0 |
| `node scripts/build-estrategias.mjs` | las 6 estrategias y la cartera cuadran con el expediente |

### Mapa de navegación

| # | Sección | Ruta | Subtítulo |
|---|---|---|---|
| 1 | Portafolios | `/portafolios` | Portafolios Algorítmicos de Acciones, Opciones y Futuros · 4 pestañas |
| 2 | Agentes | `/agentes` | Agentes IA para Acciones y Opciones |
| 3 | Estrategias | `/estrategias` | Seis sistemas algorítmicos de futuros sobre el Nasdaq |
| 4 | Recomendaciones | `/recomendaciones` | Panel de Recomendaciones |
| 5 | Alerta temprana | `/alertas` | Escalada Rusia–OTAN, pulso Fed vs Tesoro y tasas EEUU (solo admin) |

Fuera del menú pero con ruta viva: `/dashboard`, `/perfil` y
`/fincept-terminal` (estas dos bajo Configuración).

---

## Pendiente

### Tesis de inversión

> La migración 026 **ya está aplicada**, verificada el 2026-09-02 contra la API
> real: tabla `informe_adjuntos` con sus 12 columnas, RLS activa con la política
> `FOR ALL`, y bucket `informe-adjuntos` privado con `file_size_limit`
> 10485760 y los seis MIME esperados, más sus cuatro políticas de
> `storage.objects`. «Adjuntar fuentes» ya puede subir.

- **Comprobar `pdf-parse` en producción.** Es la primera vez que se ejecuta de
  verdad: el código heredado llamaba al módulo como si fuera una función, que
  es la API de la versión 1, y la 2 exporta una clase. Está corregido y
  probado con mocks, pero un PDF real en Vercel es otra cosa. Un archivo
  ilegible degrada a cero caracteres, no tumba el lote.
- **Adjuntos huérfanos:** un lote subido cuya tesis nunca se generó deja filas
  con `informe_id NULL`. No molestan; convendría una limpieza de los que pasen
  de una semana.

### Calibración de severidad

> La migración 025 **ya está aplicada**, verificada el 2026-09-02: las cuatro
> tablas `severity_*` existen con sus columnas y con RLS activa sin políticas
> públicas, tal y como se diseñaron. `npm run calibracion:cargar` ya tiene
> dónde escribir.

> Las cuatro tablas **ya tienen datos** (2026-09-02): 27 eventos, 627
> mediciones de precio, 27 respuestas del replay y 7 puntos de curva. El
> pipeline completo funciona de extremo a extremo.

- ~~**Aplicar la migración 027**~~ — hecha por el usuario el 2026-09-02, y el
  grupo de control ya está cargado: 60 fechas y 1344 mediciones.
- ~~**El criterio de «movimiento material» estaba roto**~~ — **corregido el
  2026-09-02**: umbrales duplicados por decisión del usuario. La línea base baja
  del 85% al 30% y los tres tramos de hechos curados se separan del control
  (principal 59%, control_2014 40%, control_shocks 60%). Ver la entrada de la
  sesión.
- **La curva sigue sin poder aplicarse, pero ya solo por una razón: el tamaño de
  la muestra.** 4 de los 7 peldaños tienen menos de 5 casos (eran 5 de 7), y con
  eso la proporción solo puede valer unos pocos valores. `ajustar.mts` lo avisa.
  **El aviso de saturación ya no salta**, por primera vez desde que existe la
  curva. **Lo que hace falta sigue siendo corpus**: con 44 hechos aún no se
  cierra. Los peldaños flacos son `guerra 4/5` (n=3), `guerra 5/5` (n=1),
  `fed_tesoro 2/5` (n=4) y `fed_tesoro 4/5` (n=3).
- **Ampliar el corpus con hechos importantes da menos de lo que parece, pero
  con hechos anodinos da mucho.** La ampliación del 2026-09-03 (32 → 44) bajó los
  peldaños flacos de 5 a 4 y, sobre todo, hizo significativo el criterio entero
  (p=0,102 → p=0,028). El motivo es que el clasificador reparte los hechos
  rutinarios por los peldaños intermedios, que son justo los que estaban vacíos.
- **Ampliar el corpus da menos de lo que parece, y conviene saber por qué.** El
  2026-09-02 se pasó de 27 a 32 eventos y los peldaños flacos siguieron siendo
  6 de 8: el clasificador concentra sus respuestas en el 3 y el 5, así que
  añadir hechos intermedios no reparte la muestra como uno espera. Para llenar
  el 2 y el 4 hacen falta hechos que **el modelo** puntúe ahí, no que lo
  merezcan.
- ~~**El peldaño 3 de `guerra` no distingue nada**~~ — **corregido el
  2026-09-02** con `v5-peldano2`: los ocho casos bajan al 2 y el peldaño queda
  vacío. Ver la entrada de la sesión.
- ~~**Decidir si el corpus se re-etiqueta**~~ — **re-etiquetado el 2026-09-02**
  con `v6-corpus-reetiquetado`. Ver la entrada de la sesión.
- **El error medio ya no sirve para juzgar este cambio de prompt, y conviene no
  olvidarlo.** Cayó a 0,14, pero las ocho etiquetas que se bajaron coinciden con
  lo que el modelo respondía, así que **parte de esa mejora es tautológica**: se
  movió la vara hacia donde apuntaba el examinando. La justificación fue el
  criterio y el precio, no la respuesta del modelo, pero el número resultante no
  es evidencia independiente. **La evidencia independiente es la curva**, que se
  calcula con el precio y no con la etiqueta: `guerra` 2/5 con n=11 y lift 0%.
- **El clasificador no es determinista, y eso limita comparar versiones.** Con
  `temperature: 0.1`, la rebaja de Moody's salió 5/5 en `v5` y 4/5 en `v6` sin
  que `SISTEMA_MACRO` cambiara ni una coma. Una diferencia de un peldaño entre
  dos versiones puede ser ruido de muestreo. Para atribuir un cambio al prompt
  hacen falta o varias pasadas o diferencias grandes, no de un punto.
- **La cesta de ocho activos no ve el Nord Stream.** Sale como «no movió»
  porque su efecto fue sobre el gas europeo, que no se mide. Se queda en
  severidad 4 a propósito: el efecto existió, lo que falla es el instrumento. Si
  alguna vez se amplía la cesta, este es la prueba. **Crimea ya no está en esta
  lista**: cruzaba por el oro y el umbral del 6% lo tapaba; con el 3,6% del
  2026-09-03 el instrumento sí lo ve.
- ~~**La cesta de activos necesita revisión**~~ — **revisada el 2026-09-03**:
  con el grupo de control ya emparejado por época, **ninguna retirada aguanta el
  remuestreo** y la cesta se queda con los ocho activos.
- ~~**La cobertura asimétrica de Bitcoin**~~ — **corregida el 2026-09-03**: pasa
  de 40%/78% a 78%/78% emparejando el control por época.
- ~~**El umbral del VIX está mal puesto**~~ — **corregido el 2026-09-03**:
  baja del 40% al 25% tras barrer los valores del 5% al 60%. Al 40% era peso
  muerto (aportaba +1 punto de separación); al 25% aporta +7 y pasa a ser el
  activo más valioso de la cesta. Ver la entrada de la sesión en «Completado».
- ~~**El umbral del dólar (`DX-Y.NYB`, 3%)**~~ — **revisado el 2026-09-03 y
  confirmado en el 3%**. El diagnóstico de «inerte» era correcto y la conclusión
  que se le presuponía era falsa: el dólar es el activo que **mejor** separa de
  la cesta (AUC 0,666), pero su señal está en el centro de la distribución y no
  en la cola, que es lo único que la regla del OR sabe aprovechar. Ver la
  entrada de la sesión en «Completado».
- **La regla del OR tiene un techo, y el dólar lo enseña.** «Basta que un activo
  cruce» solo puede explotar activos cuya señal esté en el extremo. El dólar
  ordena mejor que ninguno y aporta cero. Si alguna vez se cambia la regla por
  una que cuente **cuántos** cruzan, o que puntúe magnitud en vez de contar
  cruces, el dólar es el primero que hay que volver a mirar.
- **La línea base es del 36,7%, no del 20%, y eso reabre la pregunta de los
  umbrales.** El valor anterior estaba medido contra la década equivocada. Con
  el denominador correcto la separación agregada del corpus cae de 22 a **10
  puntos**, con intervalo [−8, 28] que incluye el cero: el corpus en bloque
  apenas se distingue de un día cualquiera. Lo que sí sobrevive es el patrón por
  peldaño, que es lo que la curva usa.
- **La separación individual no es criterio para quitar un activo, y por poco me
  lleva a quitar el que no era.**
  Bajo la regla «basta que uno cruce», lo que decide es la **aportación
  marginal**: cuánto cambia el criterio completo al retirarlo. El oro separa
  poco (+9 pts) pero **nunca cruza solo**, así que quitarlo no cambia ni una
  fila. El Nasdaq separaba más (+15) y sí estropeaba el veredicto, porque sus
  cruces eran los únicos de esas fechas. Está avisado en el docstring de
  `normalidad.mts` y en la nota al pie de la ficha.
- **`BTC-USD` mete ruido en el criterio de movimiento.** Es el único activo que
  cruza el umbral en dos de los tres casos raros: Skripal (-18,7%, en pleno
  invierno cripto de 2018) y Kursk (+16,1%, con el VIX cayendo un 51%). Ninguno
  tiene que ver con el hecho geopolítico. Convendría revisar si pertenece a la
  cesta o si su umbral del 16% se queda corto para lo que se mueve solo. Los dos
  casos quedan explicados en la nota del corpus (2026-09-03) para que nadie los
  lea como reacción al hecho.
- **`guerra` ya no tiene peldaño 3 y `fed_tesoro` casi tampoco** (n=1). El motor
  publica sin corregir los peldaños que no aparecen en la curva, que es lo
  correcto, pero conviene saber que ahí no hay red.
- ~~**Revisar los umbrales**~~ — **los ocho revisados uno por uno el
  2026-09-03**. Se movieron dos: el VIX del 40% al 25% y el oro del 6% al 3,6%.
  Los seis restantes se confirmaron donde estaban, con una corrección por
  búsqueda múltiple que fija el listón honesto en 27 puntos y no en cero. Lo que
  queda no es volver a barrer, es ampliar el corpus.
- ~~**La curva ha dejado de bajar la severidad y ahora la sube**~~ — **resuelto
  el 2026-09-03** ampliando el corpus con doce hechos anodinos. El aviso de
  saturación dejó de saltar y `fed_tesoro 5/5` se corrige a la baja por primera
  vez. Ver la entrada de la sesión en «Completado».
- ~~**El prompt descarta ataques en suelo ruso, pero no siempre**~~ —
  **corregido el 2026-09-03** con `v8-dominio-suelo-ruso`. Los cuatro se
  recuperan y **cada uno acierta el peldaño curado exacto**. Ver la entrada de
  la sesión en «Completado».
- ~~**`forzarMonotonia` amplifica el ruido del peldaño más flaco**~~ —
  **corregido el 2026-09-03** sustituyéndolo por regresión isotónica ponderada
  por casos (`isotonizarProbabilidad`). `fed_tesoro` vuelve a corregir a la baja
  en los cuatro peldaños. Ver la entrada de la sesión en «Completado».
- ~~**El bloque fundido de `guerra` lo sostiene un peldaño de n=1**~~ —
  **ampliado el 2026-09-03**: `guerra 3/5` pasa de n=1 a n=3, `4/5` de n=4 a
  n=8 y `5/5` de n=1 a n=2. Ver la entrada de la sesión en «Completado».
- **`guerra 5/5` sigue con n=2 y `fed_tesoro 4/5` con n=2.** Son los dos
  peldaños que quedan por debajo del mínimo, más `guerra 3/5` con n=3. Los 5 de
  `guerra` son ruptura del marco y por definición escasean; no hay muchos más
  que añadir sin bajar el listón de lo que es un 5.
- **El clasificador no es determinista, y ahora hay cifra.** Entre `v9` y `v12`,
  con cuatro pasadas sobre el mismo corpus y cambios de prompt que no les
  afectaban, **tres eventos entraron y salieron del dominio solos**: el IPC de
  mayo de 2022, la reunión de la Fed del 12 de junio de 2024 y el corte de los
  cables del Báltico. Con `temperature: 0.1` y 52 titulares, eso es un ~6% de
  filas que cambian por muestreo. Cualquier diferencia de una fila entre dos
  versiones hay que leerla con eso delante.
- **El clasificador parte los FOMC idénticos entre el 2 y el 3 por la
  redacción.** Seis reuniones «la Fed mantiene los tipos» se reparten 2 en el
  peldaño 2 y 4 en el 3. Y las dos que cayeron en el 2 son justo las dos que
  movieron el precio —el hold hawkish de septiembre de 2023 (S&P −3,9%) y el
  giro de noviembre (S&P +4,4%)—, lo que infla ese peldaño al 80%. Es la
  evidencia más nítida hasta ahora del problema de determinismo del
  clasificador.
- ~~**Los cinco agujeros del prompt**~~ — **cerrados el 2026-09-02**, con la
  medición delante: descartados **10 → 1**, y los cinco casos recuperados con el
  peldaño correcto o cerca. Ver la entrada de la sesión en «Completado».
- ~~**Vigilar el 11-S en producción**~~ — **resuelto de rebote el 2026-09-03**.
  El modelo lo dejaba pasar estirando el criterio a un actor no estatal; con
  `v8` lo descarta, y con él la invasión de Irak. Son los dos únicos descartados
  que quedan, y los dos son `control_shocks`: shocks de otra naturaleza que
  **deben** quedar fuera del dominio Rusia-OTAN. El descarte pasó de 6 a 2 y los
  2 son los correctos.
- ~~**Contradicción sobre la Fed de junio de 2022**~~ — **corregida el
  2026-09-02**: la decisión del 15 de junio baja de severidad 5 a 2. Ver la
  entrada de la sesión en «Completado».
- ~~**Las tres contradicciones restantes de `fed_tesoro`**~~ — **corregidas el
  2026-09-02**. El tema entero quedó coherente; ver la entrada de la sesión.
- ~~**Las dos discrepancias de `guerra`**~~ — **corregidas el 2026-09-02**. El
  corpus entero queda alineado con el prompt y con el precio; ver la entrada de
  la sesión.
- ~~**`huboMovimiento` cuenta la caída del VIX como si fuera un susto**~~ —
  **corregido el 2026-09-02**, aunque no cambió ninguna cifra. Ver la entrada de
  la sesión: el bug era real y el efecto medible sobre este corpus es cero.
- **El clasificador apenas distingue el 2 del 3 en `guerra`.** Con el corpus ya
  corregido, la severidad media que merece cada peldaño es 2,7 para el 2 y 2,9
  para el 3: dos peldaños distintos que describen lo mismo. En `fed_tesoro` la
  separación es limpia (2,0 · 3,0 · 4,0 · 4,8). Merece mirarse cuando el corpus
  de guerra crezca.
- **Medir el efecto:** volver a pasar `npm run calibracion:auditar` tras una
  semana con el prompt nuevo y comprobar si el 60,9% de peldaños 4-5 baja.


### Alerta temprana viva (Fases 1–4) — en producción desde el 2026-09-01
> El PR #13 «Alerta temprana viva: pulso público, palabras clave y curvas de
> probabilidad» quedó mergeado en `main` (`17c8c5d`, merge commit, los seis
> commits conservados). Tests en `main` tras el merge: **798/798**. El deploy
> de producción de Vercel salió en verde. La migración `024_pulso_publico.sql`
> ya estaba aplicada: el pipeline llevaba días escribiendo en esas tablas.

Lo que entró con el PR:
- **Fase 1** — ingesta del pulso público desde seis fuentes (trends, hn,
  youtube, news, wikipedia, mastodon).
- **Fase 2** — de ese ruido diario salen los doce términos que importan.
- **Fase 3** — dos curvas de probabilidad (`mercado` y `geopolitico`) que se
  reentrenan solas cada noche.
- **Fase 4** — la UI: endpoint `/api/alertas/pulso`, contrato `tipos-ui.ts`,
  `RiesgoChart.tsx` y `PulsoPublico.tsx`, montado dentro de `AlertasClient`.

**Los modelos están en calibración, y eso es lo esperado.** Al 2026-09-01 hay
**5 días** de features acumuladas de los **60** que exige `MINIMO_DIAS`, cero
predicciones y cero palabras clave con relevancia ≥ 3. La UI enseña el estado
«sin activar» con la cuenta atrás; no hay nada que arreglar hasta **~1 de
noviembre de 2026**, que es cuando el histórico alcanza el mínimo. A partir de
ahí toca comprobar que `alert_predictions` empieza a llenarse.

#### Cerrado el 2026-09-01
- ~~**Relinkear la sesión de WhatsApp de `nexus`**~~ — hecho. `nexus` y `stefy`
  quedan vinculadas y sanas. El gateway nunca se tocó por systemd, tal y como
  estaba anotado.
- ~~**Verificar la entrega de extremo a extremo**~~ — hecho: `npm run alertas --
  prueba` devuelve *«mensaje entregado al puente con la sesión de WhatsApp
  viva»* y sale con código 0.
- ~~**Dar de alta el cron**~~ — hecho: el crontab tiene las **9 entradas** de
  alertas activas.


### PARA EL LUNES 2026-08-31 — activar el archivo de cadenas
> Aplazado a propósito el 2026-08-29 (sábado). El **lunes 31 es día de mercado**,
> que es cuando se puede verificar de verdad: la guarda de calendario impide
> probar la captura en fin de semana.
>
> El código está desplegado y en producción desde el commit `f0f6797`, pero
> **no graba nada todavía** porque falta la tabla. Nada se rompe mientras tanto:
> el cron responde 500 y el job de GitHub sale en rojo, sin tocar ninguna otra
> parte de la aplicación.

**1. Migración 019 — ya aplicada.** Verificado el 2026-09-01:
`options_chain_snapshots` responde con la clave de servicio. Este punto queda
cerrado; lo que sigue sin verificar es la primera captura en día de mercado.

**2. ~~Confirmar `CRON_SECRET` y la variable `APP_URL`~~ — hecho el 2026-09-01.**
No estaban: ni `CRON_SECRET`, ni `APP_URL`, ni `CRON_USER_ID` existían en ningún
sitio, y por eso **los dos workflows fallaban en cada ejecución desde el
2026-08-26**. La suposición de que «el workflow de `review-exits` ya los usa, así
que deberían estar» era justo al revés: ese workflow llevaba semanas en rojo.
Ahora `CRON_SECRET` está en el secret de GitHub y en Vercel, `APP_URL` es una
variable del repositorio y `CRON_USER_ID` está en Vercel. El resto de este punto
queda obsoleto:
problema sin avisar.

**3. Verificar la primera captura real — sigue siendo lo único abierto.**
Al 2026-09-01 el workflow ya **no falla**: el disparo manual de las 16:27 UTC
salió en verde y los dos runs previos en rojo se explican por las variables que
faltaban, no por el código. Pero las 16:27 UTC son las **12:27 de Nueva York**,
o sea **fuera** de la ventana 16:00–19:00, así que ese run no prueba la captura:
como mucho respondió `ejecutado: false`. Queda pendiente forzarlo dentro de
ventana en un día de mercado (o esperar al cron nocturno) y contar las filas.

El camino completo —descargar, filtrar,
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
- ~~**Commitear y pushear.**~~ — hecho: el rebrand está en `73df0c5` («feat:
  rebrand completo a SynerGy según el manual de marca») y el working tree está
  limpio. La nota llevaba tiempo sin reflejar el repositorio.
- **Recorrido visual autenticado** de las 8 rutas del dashboard. Solo se
  comprobaron en navegador `/login`, `/register` y el shell del dashboard (con
  una ruta temporal ya borrada). `recomendaciones/page.tsx` concentraba 419
  sustituciones de color y es la de mayor riesgo de regresión.
- **Generar un informe DOCX real** para confirmar la paleta azul del manual
  (`1C3042` / `003D66`), la tipografía Roboto y el pie con "SynerGy".
- Posible **segunda pasada de ajuste fino** en las pantallas densas
  (`recomendaciones`, `fincept-terminal`): sin acento cálido, la jerarquía
  depende de peso y relleno y puede necesitar retoques al verla en uso.

### Ergo Quant y su backend FastAPI — **borrado el 2026-09-02**
Ver la entrada de la sesión en «Completado». El repositorio ya no tiene
Python: se puede consolidar el despliegue en Vercel sin la parte difícil.

Lo único que queda por hacer del lado de las cuentas: **dar de baja en Render el
private service `ergo-quant-api`**, que ya no lo crea ningún Blueprint pero
puede seguir vivo y facturando si se creó a mano.

### Deudas conocidas en los agentes de opciones
Detectadas al escribir las fichas técnicas. Tres de las cuatro quedaron
cerradas el 2026-09-02; la que sigue abierta es la última.

- ~~**Gamma no tiene stop ni toma de beneficios.**~~ — resuelto antes de esta
  sesión: `exit-levels.ts` declara `CATEGORIAS_CON_NIVELES` y Gamma ya **no
  escribe** `precio_objetivo` ni `stop_loss`. La decisión está razonada con el
  backtest de 21 años en el comentario del módulo. Theta sí usa niveles, y su
  revisión los lee en `/api/agentes/review-exits`. Esta nota estaba obsoleta.
- ~~**Todo covered-call se valora con `strike × 100`.**~~ — cerrado el
  2026-09-02. `AgenteTheta.tsx` persiste ahora `underlying: t.underlyingPrice`
  en el `ai_report`, que es el dato que `positions.ts` ya buscaba. Además
  `positions.ts` valida el tipo en vez de castear: las filas antiguas de Gamma
  guardaban el **ticker** en ese mismo campo, y un string colándose como número
  habría dado un colateral `NaN` en silencio. Gamma pasa a guardar el precio.
- ~~**Los rangos de delta no coinciden entre el score y los filtros.**~~ —
  cerrado el 2026-09-02 estrechando los filtros hacia el score: Theta pasa de
  0,15–0,35 a **0,20–0,35** y Gamma de 0,30–0,65 a **0,45–0,65**. Ningún
  contrato entra ya arrastrando la penalización de −10.
  ⚠️ **Esto reduce el número de candidatos**, sobre todo en Gamma, donde el
  suelo sube 15 puntos de delta. Conviene mirar en la próxima ejecución cuántos
  tickers sobreviven al paso 4; si se queda seco, la alternativa es la
  contraria (ampliar el score a los rangos anchos).
- ~~**Nadie comprueba que se posean las acciones de un covered-call.**~~ —
  cerrado el 2026-09-02. `positions.ts` expone `accionesPorTicker` y
  `coberturaDeCall`: cada call cubierta abierta lleva ahora un campo
  `cobertura` con las acciones que exige (100 por contrato), las que el
  portafolio de acciones tiene abiertas de ese ticker y el veredicto. La tabla
  de posiciones marca «⚠ descubierta» cuando no llegan.
  ⚠️ **Con el sizing actual saldrán casi todas descubiertas**: el portafolio de
  acciones invierte un ticket fijo y fraccional, así que rara vez acumula 100
  títulos de un mismo símbolo. El aviso es correcto —la call está al
  descubierto de verdad— pero conviene decidir si Theta debería exigir la
  posición en acciones antes de proponer la call, en vez de solo señalarlo.

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
- Qué hacer con `/dashboard`: sigue viva pero sin entrada de menú.
  (`/ergos-quant` ya no aplica: borrada el 2026-09-02.)
- `OPENROUTER_API_KEY` y `FRED_API_KEY` están vacías en `.env.local`. En Vercel
  sí están cargadas, pero sin ellas no se pueden probar recomendaciones ni
  agentes en local.

---

## Completado

### Sesión del 2026-09-03 — los peldaños altos de `guerra` y dos agujeros más del dominio

El pendiente que dejó la regresión isotónica: `guerra 3/5` tenía n=1 y `5/5`
n=1, así que un solo evento fijaba el bloque de dos peldaños.

**Ocho hechos añadidos, apuntados a la banda 3-5. El corpus pasa de 44 a 52.**
Amenaza nuclear con acto detrás (fuerzas de disuasión en régimen especial
2022-02-27, nucleares tácticas a Bielorrusia 2023-03-25), cambio de control
territorial (anexión de las cuatro provincias 2022-09-30, invasión de Georgia
2008-08-08), cortes de suministro con tamaño de mercado (Gazprom a Polonia y
Bulgaria 2022-04-27, cierre indefinido del Nord Stream 1 2022-09-02, embargo
europeo al crudo 2022-12-05) y un contraste (voladura de la presa de Kajovka
2023-06-06). Todas las fechas verificadas contra fuente.

**Clase nueva: `corte-suministro`**, corte o embargo deliberado de energía sin
daño físico. Tres de los ocho no encajaban en `sabotaje` y agruparlos permite
preguntar lo útil: cuánto mueve un corte de suministro, en general.

**Resultado sobre la curva:**

| Peldaño | antes | ahora |
|---|---|---|
| `guerra 3/5` | n=1 | **n=3** |
| `guerra 4/5` | n=4 | **n=8** |
| `guerra 5/5` | n=1 | **n=2** |
| peldaños flacos | 4 de 8 | **3 de 8** |

**Y con n=8, `guerra 4/5` se corrige a 2/5.** Los «4» del modelo mueven el
precio el 63% de las veces contra una línea base del 43,3%: lift del 36%, que es
un peldaño 2. Es exactamente el hallazgo para el que existe toda esta
calibración, y ahora descansa sobre ocho casos en vez de cuatro.

### Dos agujeros más del dominio, encontrados por el camino

**El primero era una contradicción interna del prompt.** El peldaño 3 se define
literalmente como «corte de suministro que un operador note en el precio de la
energía», y **ningún criterio de dominio admitía un corte de suministro**: la
escala describía un caso que el filtro rechazaba. Los tres cortes entraron
descartados. Se añadió el criterio que faltaba.

**El segundo era el filtro implícito de territorio, otra vez.** La voladura de
la presa de Kajovka encaja en «sabotaje de infraestructura crítica atribuido a
un Estado», que no lleva restricción geográfica, y se descartaba igual — como
pasó con el puente de Kerch antes de arreglar el suelo ruso. Ahora el criterio
dice «esté donde esté: en la OTAN, en Rusia o en la zona de guerra».

**Y ensanchar tuvo su propio coste, que hubo que medir dos veces.** Al
generalizar a «el dominio sigue al conflicto, no al mapa», el modelo empezó a
colar **la invasión de Irak con un 5**. Al cerrarlo con «la otra parte ha de ser
la OTAN, un país miembro o Ucrania», se dejó fuera **la guerra ruso-georgiana**.
La redacción final admite a los vecinos europeos de Rusia y nombra a Irak y al
11-S como los descartes a acertar. Quedan tres versiones del prompt (`v10`,
`v11`, `v12`) que documentan el ida y vuelta.

### Lo que hay que saber al leer estos números

**Dos de los ocho no son observaciones independientes**, y se dice en el
corpus: 2022-02-27 cae dentro de la ventana de 5 sesiones de la invasión y
2022-09-30 dentro de la del sabotaje del Nord Stream. Se incluyeron porque son
las anclas canónicas de sus peldaños, pero cuentan como muestra prestada. Por
esa misma razón se descartaron el reconocimiento del Donbás (2022-02-21) y el
misil Oreshnik (2024-11-21), que eran el mismo ciclo de noticias que un evento
ya presente.

**El criterio sigue siendo significativo** con 52 hechos: el test de permutación
da **p=0,041** (era 0,028 con 44 y 0,102 con 32).

Verde: **979/979 tests**, `tsc`, ESLint y build limpios.

### Sesión del 2026-09-03 — la curva degenerada: el problema no era la monotonía, era cómo se imponía

Con `v8`, la curva de `fed_tesoro` publicaba un **4 diga lo que diga el modelo**
—incluido el peldaño `3/5`, cuyo lift medido era del **0%**— y la de `guerra`
mandaba a 5 todo lo que estuviera por encima de un peldaño de **n=1**.

**El diagnóstico.** La monotonía hace falta: sin ella un peldaño flaco invierte
el orden y el sistema avisa más fuerte de lo pequeño que de lo grande. El fallo
estaba en **cómo** se imponía. `forzarMonotonia` recorría de menor a mayor
arrastrando el máximo visto, y lo hacía **sobre el peldaño ya calculado**, así
que cualquier peldaño alto se volvía un **suelo** para todos los de encima sin
importar con cuántos casos se había medido.

**El arreglo: promediar en vez de arrastrar.** Se sustituye por regresión
isotónica por bloques adyacentes (*pool adjacent violators*), **ponderada por
número de casos** y aplicada a la **probabilidad**, no al peldaño. Donde dos
peldaños contiguos se contradicen se **funden en un bloque** y comparten la media
ponderada: el que tiene más casos manda, el de n=1 aporta lo que pesa.

Aplicarla sobre la probabilidad hace innecesario un segundo paso de monotonía,
porque `liftSobreBase` y `peldanoDesdeProbabilidad` son las dos crecientes: una
entrada ordenada sale ordenada. `forzarMonotonia` se retira.

**Que dos peldaños se fundan es información, no una pérdida**: dice que el
modelo no los distingue. `ajustar.mts` los marca con un asterisco y lo explica
en la salida, porque sin la marca la tabla parece una coincidencia.

**La curva vigente**, `v8` sobre 44 hechos, línea base 43,3%:

| Tema | LLM | n | P(mov) | Isotónica | Lift | → Final |
|---|---|---|---|---|---|---|
| guerra | 2/5 | 16 | 63% | 63% | 34% | 2/5 |
| guerra | 3/5 | 1 | 100% | 80% * | 65% | 4/5 |
| guerra | 4/5 | 4 | 75% | 80% * | 65% | 4/5 |
| guerra | 5/5 | 1 | 100% | 100% | 100% | 5/5 |
| fed_tesoro | 2/5 | 5 | 80% | 45% * | 4% | **1/5** |
| fed_tesoro | 3/5 | 6 | 17% | 45% * | 4% | **1/5** |
| fed_tesoro | 4/5 | 3 | 67% | 67% | 41% | **3/5** |
| fed_tesoro | 5/5 | 6 | 83% | 83% | 71% | **4/5** |

**`fed_tesoro` vuelve a corregir a la baja en los cuatro peldaños**, que es la
dirección para la que existe todo esto. El bloque fundido del 2 y el 3 sale al
45% frente a una línea base del 43,3%: indistinguible de un día cualquiera, y
por eso baja a 1.

Nueve tests nuevos para `isotonizarProbabilidad`, entre ellos el caso real de
`fed_tesoro` y la comprobación de que el peldaño con más casos manda dentro del
bloque. **979/979 tests**, `tsc` y ESLint limpios.

**Lo que esto no arregla** es el tamaño del corpus: siguen 4 de 8 peldaños con
menos de 5 casos, y `aplicarCurva` sigue sin estar cableada al motor.

### Sesión del 2026-09-03 — el dominio del prompt no terminaba donde decía

La ampliación del corpus dejó a la vista que el prompt descartaba cuatro
ataques en territorio ruso —Crimea, Kursk, el puente de Kerch, los drones del
Kremlin— y en cambio juzgaba Bélgorod, que es el mismo tipo de hecho.

**El diagnóstico tenía dos capas.** La primera: el prompt de verdad omitía el
suelo ruso, porque sus siete criterios de dominio hablaban todos de la OTAN. La
segunda, y la que explica a Bélgorod: uno de los criterios —«sabotaje de
infraestructura crítica atribuido a un Estado»— **no lleva restricción
geográfica**, así que el puente de Kerch debería haber entrado por ahí y aun así
se descartaba. El modelo estaba leyendo la cabecera («conflicto entre Rusia y la
OTAN») como un filtro implícito de territorio, y lo aplicaba unas veces sí y
otras no.

**El arreglo tiene tres partes**, todas en `SISTEMA_GUERRA`:

1. **Un criterio de dominio nuevo y acotado**: escalada mayor en territorio ruso
   atribuida a un Estado, cuando cruza una de cuatro barras —control de terreno,
   sede del poder o mando, infraestructura estratégica de tamaño nacional, o
   instalación nuclear—. El goteo diario de drones sobre refinerías queda
   explícitamente fuera, que era el riesgo de inundar el canal.
2. **La ambigüedad geográfica, dicha en voz alta**: el dominio es el *conflicto*,
   y un conflicto escala por los dos lados de la línea. Que un hecho ocurra en
   suelo ruso no lo saca del dominio.
3. **Anclas de severidad medidas, para que entrar no signifique inflar.** Kursk
   (oro +2,5%, VIX −51,0%), Kremlin (oro +1,1%, VIX +20,0%) y Bélgorod (oro
   −1,7%, VIX +23,8%) son 2. Solo el cambio de control territorial llega al 4
   (Crimea). Kerch es 3, y por la respuesta material del 10 de octubre, no por lo
   espectacular de volar un puente.

**Resultado, con `v8-dominio-suelo-ruso` sobre los 44 hechos:**

| | v7 | v8 |
|---|---|---|
| descartados | 6 | **2** |
| juzgados | 38 | **42** |
| error medio | 0,29 | **0,24** |

**Los cuatro recuperados aciertan el peldaño curado exacto**: Kursk 2/5, Crimea
4/5, Kerch 3/5, Kremlin 2/5. Cuatro de cuatro, sin desviación.

**Y los dos descartados que quedan son los correctos**: el 11-S y la invasión de
Irak, ambos `control_shocks`, shocks de otra naturaleza que deben quedar fuera
del dominio Rusia-OTAN. Esto cierra de rebote el pendiente «vigilar el 11-S en
producción», que estaba abierto porque el modelo lo colaba estirando el criterio
a un actor no estatal.

### Lo que la medición destapó de paso, y no se ha arreglado

**La curva se ha vuelto degenerada, y la culpa es de `forzarMonotonia`.** Para
`fed_tesoro` publica un 4 diga lo que diga el modelo: los cuatro peldaños salen
en 4/5, incluido el `3/5` cuyo lift medido es **0%**. El mecanismo es que el
peldaño más bajo (`2/5`, n=5, lift 65%) sube a 4 y la monotonía arrastra todo lo
que está por encima. En `guerra` ocurre lo mismo desde un peldaño de **n=1**.

**Y el motivo por el que ese peldaño bajo está inflado es el clasificador**:
seis reuniones «la Fed mantiene los tipos», que son el mismo hecho, se reparten
entre el peldaño 2 (dos casos) y el 3 (cuatro casos) según cómo esté redactado
el titular. Y las dos que cayeron en el 2 resultan ser justo las dos que
movieron el precio —el hold hawkish de septiembre de 2023 (S&P −3,9%) y el giro
de noviembre (S&P +4,4%)—, lo que deja ese peldaño en un 80% que es suerte del
reparto.

La corrección natural sería que un peldaño por debajo de un mínimo de casos no
pueda fijar el suelo de los demás, pero eso es rediseñar la curva y no es lo que
se pedía en este turno. Queda anotado como pendiente con la evidencia delante.
Sin riesgo hoy: `aplicarCurva` no está cableada al motor y `ajustar.mts` avisa.

Verde: **975/975 tests**, `tsc` y ESLint limpios.

### Sesión del 2026-09-03 — el corpus deja de estar hecho solo de hechos importantes

El pendiente que dejó el arreglo del oro: la curva había pasado a **subir** la
severidad porque el corpus solo contenía sucesos que fueron importantes. El
umbral del 6% tapaba ese sesgo por accidente; medir bien quitó la venda.

**Doce hechos anodinos añadidos. El corpus pasa de 32 a 44.**

El criterio de selección es la parte delicada. **No** se eligieron por no haber
movido el precio —eso sería hacer trampa, porque el desenlace es lo que se
mide—, sino por su **perfil antes del desenlace**: sucesos que un clasificador
puntúa alto. Cinco de `guerra` (puente de Kerch, Przewodów, drones del Kremlin,
Bélgorod, restos de dron en Rumanía) y siete de `fed_tesoro` (seis FOMC de
trámite y el IPC de julio de 2024). Todas las fechas verificadas contra fuente
—Federal Reserve, BLS, CNN, Al Jazeera, NBC, Kyiv Independent— antes de
escribirlas.

**Przewodów es el ejemplar de la colección**: dos muertos en suelo aliado,
reunión de urgencia del G7, artículo 4 sobre la mesa. Un titular de peldaño 5
que en horas resultó ser un S-300 de la defensa aérea ucraniana. El modelo le da
2/5 y el precio tampoco se enteró.

**Resultados:**
- **El aviso de saturación ha dejado de saltar**, por primera vez desde que
  existe la curva.
- **`fed_tesoro 3/5` aparece por primera vez, con n=7** (los seis FOMC y el
  IPC). Su P(mov) es del **29%**, por debajo de la línea base del 43,3%: una
  reunión rutinaria de la Fed mueve el precio **menos que un día cualquiera**.
- **Un peldaño 5 se corrige a la baja por primera vez**: `fed_tesoro 5/5` → 4/5.
- Peldaños flacos: de 5 de 7 a **4 de 7**.

**El resultado que más cuenta, y es contraintuitivo.** Todas las separaciones
individuales **bajan** (WTI +18 → +14, VIX +18 → +11, oro +19 → +9) y sin
embargo el criterio completo **mejora**: el test de permutación pasa de
**p=0,102 a p=0,028**. Con 32 hechos seleccionados el corpus no se distinguía
del ruido; con 44 honestos, sí. Un corpus sesgado infla las cifras individuales
y hunde la prueba de conjunto.

**El 3,6% del oro queda confirmado fuera de muestra.** Se eligió con los 32
viejos; medido contra los 44 —doce de los cuales no existían cuando se decidió—
sigue ganando al 6% por **+10 puntos [2, 20]**, mejorando en el 98% de los
remuestreos, con el tramo llano todavía entre el 3,4% y el 3,8%.

**Dos hallazgos laterales:**
- **El prompt descarta ataques en suelo ruso, pero no siempre.** Cuatro de los
  seis descartados lo son —Crimea, Kursk, Kerch, Kremlin— y Bélgorod, que es lo
  mismo, se juzga con un 2/5. Anotado como pendiente del prompt.
- **El error medio sube de 0,14 a 0,29, y era de esperar.** El 0,14 de `v6` era
  tautológico: las etiquetas se habían movido hacia el modelo. Los doce nuevos
  no pasaron por eso, así que 0,29 es la primera medida honesta.

Un error propio corregido de paso: los drones del Kremlin quedaron etiquetados
como `incursion-otan` un rato, y el suelo es ruso, no aliado. Pasan a `invasion`.

Verde: **975/975 tests**, `tsc` y ESLint limpios.

### Sesión del 2026-09-03 — el oro estaba midiendo con el listón de otro activo

Los seis umbrales que quedaban por revisar: oro 6%, plata 10%, Bitcoin 16%, WTI
12%, Nasdaq 6%, S&P 5%. **Solo se movió uno**, y el problema de fondo de esta
sesión fue no dejarse llevar por los otros cinco.

**El oro baja del 6% al 3,6%, y es el cambio más grande que ha tenido la tabla.**
Al 6% solo cruzaban 4 de los 32 hechos y su aportación marginal era de **−2
puntos**: la cesta separaba 16 puntos con el oro dentro y 18 sin él. No es que
no aportara, es que restaba. Al 3,6% cruzan 12, la separación sube a **32
puntos** y el oro pasa a ser **el activo que más aporta de los ocho**:

| Activo | Aportación marginal |
|---|---|
| **Oro (3,6%)** | **+14 pts** |
| VIX (25%) | +9 pts |
| Plata, Nasdaq, S&P, dólar | 0 pts |
| WTI, Bitcoin | −2 pts |

**El 3,6% es el centro de la meseta**, mismo criterio que el 25% del VIX: entre
el 3,4% y el 3,8% la separación se queda en 32 puntos durante cinco escalones de
0,1%. El pico está en el 2,9–3,3% con 33 puntos, uno más, pero allí la línea
base sube al 45–48% y se acerca a la saturación; en el 3,6% se queda en el 43%.
El remuestreo da **+15 pts [4, 28]**, con el intervalo del 90% estrictamente
positivo — más de lo que pudo enseñar el VIX.

**Entran seis hechos y solo dos fechas de control.** Crimea (+4,5%), los cables
del Báltico (+5,6%), el Balticconnector (+5,5%), el recorte de 50 pb de la Fed
(+3,8%), la doctrina nuclear rusa (+3,8%) y la incursión sobre Estonia (+3,9%).
**Crimea era el caso que el informe citaba como el fallo más incómodo del
sistema** —movió su mercado y el veredicto decía que no—. Ninguna severidad
cambia: las fija el criterio del prompt.

**Los otros cinco no se tocaron, y la razón es metodológica.** Barrer seis
activos sobre once valores son 66 pruebas sobre el mismo corpus, que es el mismo
error que se cometió al elegir estos umbrales en bloque. Se barajó la etiqueta
hecho/control 600 veces repitiendo el barrido entero: por puro azar la mejor
separación alcanzable es de 13 puntos de mediana y **27 en el percentil 95**.
Ese es el listón, no el cero.

| Activo | Mejor separación real | p-valor |
|---|---|---|
| **Oro** | **33 pts** | **0,000** |
| VIX (a posteriori) | 25 pts | 0,037 |
| Plata | 19 pts | 0,092 |
| WTI | 18 pts | 0,127 |
| Bitcoin | 18 pts | 0,128 |
| Nasdaq | 16 pts | 0,142 |
| S&P 500 | 16 pts | 0,183 |

Solo el oro pasa. El VIX, medido con la misma vara a posteriori, aguanta
(p=0,037): su cambio no fue artefacto de la búsqueda.

**El efecto aguas abajo es incómodo y hay que mirarlo de frente: la curva ha
dejado de bajar la severidad y ahora la sube.** Con 24 hechos cruzando en vez de
18, la línea base sube al 43,3% y todos los lifts con ella; `guerra 2/5` pasa de
corregirse a 1/5 a corregirse a 3/5. **No es un fallo del arreglo, es un
problema que el arreglo destapa**: el umbral del 6% estaba compensando por
accidente el sesgo de selección del corpus, que solo contiene hechos que fueron
importantes. Medir bien quita la venda. La solución no es volver a subir el
umbral, son hechos anodinos en el corpus. Sin riesgo en producción:
`ajustar.mts` avisa en voz alta y `aplicarCurva` no está cableada al motor.

Seis notas del corpus se corrigieron en `eventos.ts` porque el cambio las dejó
mintiendo —las seis decían «ningún activo por encima de su umbral» o «cero
transmisión al precio»—. Actualizados también el docstring de `normalidad.mts`
(su ejemplo era justo el oro), la ficha de backtesting y el informe, con el
formato de un decimal para que el 3,6% no se lea como un 4%.

Verde: **975/975 tests**, `tsc` y ESLint limpios.

### Sesión del 2026-09-03 — el dólar se queda en el 3%, y el motivo no era el que parecía

El pendiente que dejó la revisión del VIX: el dólar estaba en el **percentil
100** del día normal —cero cruces en las 60 fechas de control, 2 de 32 hechos,
aportación marginal de 0 puntos— y parecía otro umbral mal puesto.

**El umbral está alto, pero bajarlo empeora las cosas.** Y lo que apareció al
mirarlo de cerca invierte el diagnóstico: el dólar no es un activo mudo. Sin
umbral ninguno, comparando magnitudes de hechos contra días de control, **es el
que mejor separa de toda la cesta**, con un **AUC de 0,666** [0,560, 0,769] por
delante del VIX (0,639), el S&P (0,610), el oro (0,604), la plata (0,603), el
WTI (0,597), Bitcoin (0,586) y el Nasdaq (0,583).

**Por qué no aporta nada pese a eso: su señal no vive en la cola.** La mediana
del dólar en un hecho curado es del 1,29% y en un día de control del 0,99% —la
diferencia está en el centro de la distribución—, y la regla es un OR que solo
sabe aprovechar extremos. Bajar el umbral arrastra al control con él:

| Umbral | Curados que añade | Controles que añade | Neto |
|---|---|---|---|
| 3,00% (actual) | 0/32 | 0/60 | 0 pts |
| 2,00% | 0/32 | 3/60 | −5 pts |
| 1,50% | 2/32 | 6/60 | −4 pts |
| 1,25% | 7/32 | 10/60 | +5 pts |
| 1,00% | 9/32 | 17/60 | −0 pts |

**El único punto positivo, el 1,25%, falla por los dos mismos criterios con los
que se había elegido el 25% del VIX horas antes:** satura la línea base, que
sube al **57%** (peor que el 53% que descartó al VIX en el 12,5%), y no tiene
meseta —el barrido fino en pasos del 0,05% entre el 1,05% y el 1,25% da 23, 20,
20, 25 y 18 puntos, una sierra—, con intervalo del 90% en **[−9, 20]**.

**Decisión: se queda en el 3%.** Un umbral que no hace nada es mejor que uno que
mete ruido. Queda documentado en `UMBRAL_MATERIAL` y en el informe para que el
próximo que vea el percentil 100 no repita el barrido.

**Lo que deja abierto no es un umbral, es la regla.** El dólar es el caso que
enseña el techo del OR: el activo con más información de la cesta es el que esta
regla peor aprovecha. Anotado como pendiente para cuando se plantee contar
cuántos activos cruzan en vez de si cruza alguno.

Sin cambios de código: solo `UMBRAL_MATERIAL` documentado, el informe y estas
notas. Verde: **975/975 tests**, `tsc` y ESLint limpios.

### Sesión del 2026-09-03 — el VIX baja del 40% al 25% y deja de ser peso muerto

El pendiente que abrió la sesión anterior: con el control ya emparejado por
época, el VIX llegaba a **+102,9%** en una fecha sin nada detrás, más del doble
de su umbral. La sospecha era que el 40% estuviera mal puesto.

**Lo estaba, y por el lado contrario al que parecía.** El barrido del 5% al 60%
sobre los 32 hechos y las 60 fechas de control mostró que al 40% solo cruzaban
**5 de 32** eventos curados: la mediana del VIX en un hecho del corpus es del
**17%** y su p75 del **34%**, así que tres cuartas partes se quedaban cortas. El
umbral estaba elegido para que cruzar fuera raro, sin comprobar que los eventos
de verdad cruzaran. Su aportación marginal al criterio completo era de **+1
punto**: quitarlo de la cesta no cambiaba nada.

| Umbral VIX | Separación | Línea base | Cruza (curados) |
|---|---|---|---|
| 12,5% | 25 pts | 53% | 20/32 |
| 17,5–27,5% | 16 pts (meseta) | 40% | 11–14/32 |
| **25%** | **16 pts** | **40%** | **11/32** |
| 40% | 11 pts | 36,7% | 5/32 |

**Se eligió el 25%, no el pico del 12,5%, y las dos razones importan.** La
primera es que el 12,5% sube la línea base al **53%**: con un día cualquiera
moviéndose la mitad de las veces se vuelve a la saturación que estos umbrales
corrigieron. La segunda es la forma de la curva: entre el 17,5% y el 27,5% la
separación se queda clavada en 16 puntos durante **cinco pasos seguidos**, y esa
meseta es señal de que el valor no está pegado al ruido de la muestra; el pico
del 12,5% dura dos pasos y tiene toda la pinta de estarlo. Se cogió el centro de
la meseta. Comprobación cruzada: al 25% el VIX cae en el **percentil 83** del día
normal, en línea con Bitcoin (p85) y los índices (p87), mientras que al 40%
estaba fuera de escala respecto al resto de la cesta.

**Honestidad sobre lo que esto prueba.** La mejora frente al 40% sale en el 83%
de los remuestreos, con intervalo del 90% en **[−3, 16]**, que toca el cero. Lo
que sí está fuera de duda es que el 40% no aportaba nada.

**Efectos aguas abajo, todos verificados:**
- La línea base sube del 36,7% al **40%** y la curva v6 se recalculó con ella.
- El leave-one-out cambia de dueño: el VIX pasa a ser **el activo más valioso**
  de la cesta (+7 pts) y el dólar queda confirmado como inerte (percentil 100,
  0 cruces en 60 fechas de control).
- Los eventos curados que activan `huboMovimiento()` pasan de 15 a **18**. El
  **MH17** entra: su VIX de +39,8% caía dos décimas por debajo del umbral viejo
  y era el caso señalado en el corpus como «el evento a mirar si se revisan los
  umbrales». Ya cruza. **Su severidad sigue siendo 2**, porque la fija el
  criterio del prompt —respuesta material— y aquí no la hubo.
- **Tres notas del corpus quedaron mintiendo** al cambiar el umbral y se
  corrigieron en `eventos.ts`: MH17 y **Estlink 2** decían que no cruzaban, y
  **Kursk** y **Skripal** no explicaban que su único cruce es Bitcoin por su
  cuenta (+16,1% con el VIX cayendo un 51%; −18,7% en el invierno cripto de
  2018). El corpus vuelve a ser autoexplicativo.

Verde: **975/975 tests**, `tsc` y ESLint limpios. `UMBRAL_MATERIAL`,
`INFORME-CALIBRACION-SEVERIDAD.md` y la ficha de backtesting documentan el
porqué del 25% para quien lo vuelva a tocar.

### Sesión del 2026-09-03 — el grupo de control comparaba con la década equivocada

El encargo era arreglar la asimetría de Bitcoin: cotizaba en el 78% de los
hechos curados y solo en el 40% de las fechas de control, y como la regla es
«basta que uno cruce», un activo solo puede sumar cruces donde existe. El corpus
tenía más oportunidades que su propio denominador.

**Bitcoin era el síntoma.** La causa es que el control se muestreaba
uniformemente desde 2001 mientras el corpus se concentra en los 2020:

| Década | Control (antes) | Corpus |
| ------ | --------------: | -----: |
| 2000s  | 42% |  9% |
| 2010s  | 38% | 19% |
| 2020s  | 20% | **72%** |

Mediana del control en **2010**, mediana del corpus en **2022**. Doce años. Se
estaba comparando un evento reciente contra un día normal de otra década, con
otro régimen de volatilidad y con activos que ni existían.

**El arreglo** (`placebo.mts`): cada evento aporta sus propias fechas de
control, del mismo periodo, ensanchando la ventana solo si el veto por cercanía
dejó ese año sin candidatas. Después: Bitcoin **78% contra 78%**, décadas
10/22/68 contra 9/19/72, medianas a dos meses una de otra. El script imprime las
dos medianas al terminar para que el emparejamiento se compruebe.

**Y entonces se cayó la decisión del turno anterior.** La exclusión del Nasdaq
se apoyaba en que sus únicos cruces en solitario del control eran tres, y los
tres de 2002 y 2003. Esas fechas estaban ahí por el muestreo mal emparejado. Al
corregirlo desaparecieron y con ellas toda la ventaja: **de +5 puntos a +0, en
el 0% de los remuestreos.** El Nasdaq volvió al veredicto el mismo día, y la
lección quedó escrita en el docstring de `ACTIVOS_SIN_VOTO`, que es donde la
buscará quien vuelva a plantearlo: antes de culpar a un activo, comprobar que el
denominador es comparable.

**Lo que esto cuesta, dicho sin adornos.** La línea base sube del 20% al
**36,7%**: un día normal de los 2020 mueve el precio mucho más a menudo que uno
de los 2000, y la cifra anterior medía la década equivocada. Con el denominador
correcto la separación agregada del corpus cae de 22 a **10 puntos**, con un
intervalo del 90% de [−8, 28] que incluye el cero. El corpus entero, en bloque,
apenas se distingue de un día cualquiera.

**Lo que sobrevive, que es lo que importa:** el patrón por peldaño, que es lo
que la curva usa de verdad. Los peldaños finales salen **idénticos** a los de
antes —`guerra` 2/5 sigue traduciéndose a 1/5, el 4/5 a 3/5 y el 5/5 a 5/5—. La
corrección del denominador cambia los lifts pero no las conclusiones.

Apareció además un aviso nuevo: con el control emparejado, el **VIX llega a
+102,9%** en una fecha sin nada detrás, más del doble de su umbral del 40%.

El mecanismo de exclusión se conserva implementado y probado con la lista vacía,
y la ficha mantiene la columna «Vota» para que cualquier exclusión futura se vea
en vez de quedar escondida.

Verde: 975/975 tests, `tsc`, `eslint` y `build` limpios.

### Sesión del 2026-09-03 — la cesta pierde el Nasdaq, y el criterio para quitarlo no era el que parecía

La sesión anterior dejó señalados el oro y el VIX como «los que peor
distinguen» (+9 puntos cada uno). **Era la métrica equivocada.** Bajo la regla
«basta que uno cruce», la separación individual no dice si un activo estorba:
lo que decide es la **aportación marginal**, o sea cuánto cambia el criterio
completo al retirarlo. Medidas las dos cosas, el cuadro se da la vuelta:

| Quitar | Δ separación | Sale positivo en… | IC 90% |
| ------ | -----------: | ----------------: | ------ |
| **Nasdaq** | **+5 pts** | **96%** de remuestreos | [2, 10] |
| VIX | +4 pts | 80% | [−4, 10] |
| Oro | 0 pts | 0% | [0, 0] |

**El oro no era el problema: nunca cruza solo.** Quitarlo no cambia ni una fila,
en el 100% de los remuestreos. El que sí degradaba el veredicto era el Nasdaq.

**Se retiró el Nasdaq**, y la razón estructural pesa más que la estadística:
correlaciona **0,82** con el S&P en el control, así que no es un activo distinto
sino el mismo índice de renta variable contado dos veces. Es el más volátil de
los dos (mediana 2,7% contra 2,1%) con un umbral casi igual (6% contra 5%), de
modo que cruza cuando el S&P no llega. Sus tres cruces en solitario del control
son de **2002 y 2003** —la resaca de las puntocom, Nasdaq entre 6,5% y 8,1%
mientras el S&P no pasaba del 3,7%—: ruido de una época, no reacción a nada.

**Lo que no se hizo, y por qué:**

- **El VIX se queda.** Retirarlo daría +4 puntos, pero solo aparece en el 80% de
  los remuestreos y su intervalo incluye el cero. Con 60 fechas de control no
  hay muestra para justificarlo.
- **No se persiguió el óptimo.** La búsqueda exhaustiva sobre las 255 cestas da
  un máximo de 34 puntos con `{plata, bitcoin, WTI, dólar}`, pero elegir el
  argmax de 255 sobre 60+32 observaciones es sobreajuste de manual, y esa cesta
  excluiría el oro, el VIX y el S&P: absurdo para una mesa de coberturas.

**Cómo quedó implementado.** `ACTIVOS_SIN_VOTO` en `calibracion.ts`, con el
razonamiento completo en el docstring. El activo **se sigue midiendo y
enseñando** —el dato ayuda a leer un evento— pero no vota: `UMBRAL_MATERIAL` y
`TICKERS_MEDIDOS` no se tocan. La ficha lo enseña con una columna «Vota» y la
fila atenuada, para que la exclusión se vea en vez de quedar escondida.

**Efecto:** la línea base baja del 25% al **20%** y la curva no se mueve
—`guerra` 2/5 sigue traduciéndose a 1/5—, que es justo lo buscado: denominador
más limpio sin tocar el veredicto.

**Hallazgo nuevo, anotado y sin resolver:** la cobertura de Bitcoin es
asimétrica —78% de los hechos curados contra 40% del control, porque no cotiza
antes de 2014—. Como solo puede sumar cruces donde existe, infla la separación
por disponibilidad y no por señal.

Verde: 976/976 tests (3 nuevos sobre la exclusión), `tsc`, `eslint` y `build`
limpios.

### Sesión del 2026-09-03 — el backtesting describe el día normal, y la cesta sale señalada

La línea base decía que el 25% de las fechas al azar mueven el precio, pero no
**cuánto** ni **cuál**. Faltaba la distribución de la que sale ese 25%, que es
lo que permite ver cuándo una sesión corriente se está acercando al umbral de un
evento en vez de solo saber si lo cruzó.

`perfilNormalidad()` lo mide activo por activo: mediana, p90 y máximo del día
normal, cruces sin noticia detrás, y a cuántas medianas de distancia queda el
umbral. Se extrajo `magnitudComparable()` a `calibracion.ts` para que la regla
del VIX —donde solo cuenta la subida— viva en un sitio y no diverja entre el
veredicto y el perfil.

**La columna que decide es «separación»**: cuánto más cruza el umbral con
noticia que sin ella. Se compara en tasa y no en cuenta, porque los grupos no
tienen el mismo tamaño —60 fechas de control frente a 32 hechos— y restar cruces
a secas haría parecer ruidoso al que más fechas tiene. El primer borrador tenía
ese error y el aviso salía mal.

**Lo que enseña la tabla es incómodo y va contra el propio prompt:**

| Activo | Umbral | Mediana normal | Máx normal | Separación |
| ------ | -----: | -------------: | ---------: | ---------: |
| S&P 500 |  5% | 2,1% | 11,6% | **+22 pts** |
| WTI     | 12% | 4,7% | 31,4% | **+20 pts** |
| Oro     |  6% | 2,1% |  6,8% | +9 pts |
| VIX     | 40% | 9,9% | 50,8% | +9 pts |

El oro y el VIX, que son los dos activos que el prompt cita en **todos** sus
precedentes, son los que peor distinguen. El VIX sube un 50,8% en una fecha sin
nada detrás, por encima de su propio umbral. El mejor separador es el S&P 500,
que no aparece en ningún ancla. Y ningún activo tiene el umbral a más de ×4 de
su mediana: la cesta está calibrada apretada, lo que explica que un puñado de
fechas al azar crucen igual.

También se reescribió `INFORME-CALIBRACION-SEVERIDAD.md`, que seguía describiendo
la migración 025 como pendiente y la curva como vacía —es decir, mentía sobre el
estado del sistema—. La sección nueva «Cómo funciona el sistema hoy» documenta el
pipeline de cinco pasos, el criterio de movimiento material, la curva vigente,
lo que la cesta no ve y los dos gotchas que cuestan tiempo (la caché de precios
y que editar `eventos.ts` no basta sin volver a medir).

Nuevo comando `npm run calibracion:normalidad` y panel nuevo en
`/alertas/backtesting`. Verde: 973/973 tests (12 nuevos), `tsc`, `eslint` y
`build` limpios.

### Sesión del 2026-09-02 — el corpus se re-etiqueta y el criterio de medición enseña dos grietas

Ocho hechos de `guerra` bajan de 3 a 2 en `eventos.ts`, con la nota de cada uno
explicando por qué: Przewodów, la doctrina nuclear de 2024, los drones sobre
Polonia, los MiG-31 sobre Estonia, el MH17, el Su-24 de Turquía, el
Balticconnector y el Estlink 2.

**Cómo se hizo, que aquí importa más que el resultado.** Re-etiquetar copiando
las respuestas del modelo habría destruido la única métrica independiente que
queda: el error medio pasaría a medir el modelo contra sí mismo. Así que se
aplicó el criterio y el precio evento por evento, y sobre **todo** el tema
`guerra`, no solo sobre los ocho que el modelo había bajado.

Revisar también los que no cambiaban fue lo que dio valor a la pasada, porque
aparecieron cinco casos incoherentes y ninguno era del corpus:

- **Tres `sev=2` que sí «movieron», los tres por un solo activo y ninguno
  atribuible al hecho.** Przewodów cruza por el crudo a -12,6%, que es el signo
  contrario al que un misil en Polonia predice. Skripal cruza por bitcoin a
  -18,7% en pleno invierno cripto de 2018. Kursk cruza por bitcoin a +16,1%
  mientras el VIX **caía** un 51%. `BTC-USD` produce dos de los tres.
- **Dos `sev=4` que no movieron porque la cesta no puede verlos.** Nord Stream y
  Crimea tuvieron su efecto en el gas europeo y el trigo, que no están entre los
  ocho activos medidos. Se quedan en 4 a propósito: el efecto existió y lo que
  falla es el instrumento.

También se afinó el prompt: el peldaño 3 pedía «corte real de suministro» y el 4
tenía al Nord Stream, que también lo es, así que el Balticconnector no quedaba
decidido por el criterio. Ahora el 3 exige que la interrupción tenga **tamaño de
mercado**, y se dice explícitamente que un enlace bilateral no llega aunque el
corte sea real y dure meses.

**El resultado.** El error medio cae de 0,57 a 0,14 con `v6-corpus-reetiquetado`,
pero esa cifra **no es evidencia independiente** y así queda anotado en
«Pendiente»: las ocho etiquetas se movieron hacia donde el modelo apuntaba. Lo
que sí es evidencia es la curva, que se calcula con el precio: `guerra` 2/5 con
n=11, P(mov) 18% contra una línea base del 25%, lift 0% y final **1/5**.

De propina apareció que el clasificador no es determinista: la rebaja de Moody's
salió 5/5 en `v5` y 4/5 en `v6` sin tocar `SISTEMA_MACRO`. Una diferencia de un
peldaño entre versiones puede ser ruido.

Suite completa en verde: 961/961, `tsc` y `eslint` limpios.

### Sesión del 2026-09-02 — el peldaño 3 de `guerra` se vacía y deja de mentir

El peldaño 3 era el más poblado del tema y el que peor separaba: 8 casos, 13%
de movimiento contra una línea base del 25%. Antes de tocar nada se miró caso
por caso, y lo que apareció descartó la hipótesis fácil. **El modelo no estaba
fallando**: en 7 de los 8 coincidía con la severidad que el analista había
puesto en el corpus. El que estaba mal definido era el peldaño.

El prompt decía «3 · Incidente militar directo con la OTAN» y citaba como
precedentes drones sobre Polonia (VIX +8,9%) y MiG-31 sobre Estonia
(VIX +13,0%) — es decir, se apoyaba en casos que no mueven nada para definir un
peldaño intermedio. Modelo y analista aplicaban bien una regla equivocada.

**El cambio.** El 3 pasa a exigir respuesta material —intervención armada,
corte real de suministro, cierre de espacio aéreo o de una ruta—, y los
incidentes aislados bajan al 2 con las ocho mediciones escritas en el propio
prompt. Se añade explícito que **invocar el artículo 4 no sube el peldaño**: los
tres casos del corpus que lo invocan están en el 2. Y se separa Nord Stream (4)
de los sabotajes bálticos (2) por el único criterio que los distingue de verdad,
que es el volumen cortado, no la audacia del acto.

**El resultado, medido con `v5-peldano2` sobre el mismo corpus.** Los ocho casos
bajaron a 2 y el peldaño 3 de `guerra` quedó vacío. El 2 pasa a 11 casos con
**lift 0%** (18% de movimiento contra el 25% de la línea base) y la curva los
baja a **1/5**. En la práctica: el sistema deja de emitir un aviso de severidad
3 por una violación de espacio aéreo que históricamente no mueve el precio, que
es el problema que se venía persiguiendo desde la auditoría del 60,9%.

**Lo que no se ha hecho, a propósito.** El error medio contra el corpus subió de
0,29 a 0,46, y no es una regresión: el corpus sigue etiquetado con el criterio
viejo. Re-etiquetarlo es cambiar la vara de medir, así que queda como decisión
abierta en «Pendiente» en vez de resolverse de tapadillo.

Sigue en pie el aviso de muestra pequeña: 5 de los 7 peldaños tienen menos de 5
casos. Suite completa en verde: 961/961, `tsc` y `eslint` limpios.

### Sesión del 2026-09-02 — el corpus crece a 32, con dos errores propios de por medio

Se añadieron eventos en la banda intermedia. Todas las fechas se comprobaron
contra fuente (NATO, CNN, CNBC, NPR, Wikipedia) **antes** de escribirlas: una
fecha mal puesta corrompe la medición entera y es el error más fácil de cometer
aquí.

**Primer error, de criterio.** Los ocho primeros eventos de guerra —el Moskvá,
el puente de Kerch, Nova Kajovka, Prigozhin, Navalni, el Crocus City Hall y los
ingresos de Finlandia y Suecia en la OTAN— salieron **todos** como `no
relevante` en el replay, y el clasificador tenía razón: son sucesos
Rusia-Ucrania o internos rusos, y el prompt define su dominio como el conflicto
**Rusia-OTAN**. Se eligieron por gravedad intermedia sin comprobar que cayeran
dentro del dominio que el clasificador vigila, así que nunca habrían llegado a
la curva. Retirados de `eventos.ts` y de la base.

En su lugar entran tres que sí tocan a la Alianza: el gasoducto
**Balticconnector** (08-10-2023), los **cables del Báltico** entre Finlandia y
Alemania y entre Suecia y Lituania (18-11-2024), y el **Estlink 2** con el
apresamiento del petrolero de la flota en la sombra (25-12-2024). Los tres son
sabotaje de infraestructura de países OTAN, que es un criterio explícito del
prompt. Y las tres rebajas del AAA —S&P 2011, Fitch 2023, Moody's 2025— dan
ahora una serie con la que ver si la repetición agota el efecto.

**Segundo error, un bug propio del día anterior.** `placebo.mts` acumulaba
muestreos: el upsert va por `(fecha, titulo)` y las fechas viejas no colisionan
con las nuevas, así que al recalcular el control se sumaban. La línea base
llegó a calcularse sobre **119 fechas** mezclando dos muestreos con distinto
veto. Ahora borra el control anterior antes de escribir.

**El resultado, sin adornos: 32 eventos y los peldaños flacos siguen siendo 6 de
8.** Subió la muestra donde ya había algo —`guerra` 3/5 pasa de 7 a 8 casos y
4/5 de 3 a 4— pero no se llenó ninguno de los huecos. El motivo está en
«Pendiente»: el clasificador concentra sus respuestas en el 3 y el 5, así que
añadir hechos intermedios no reparte la muestra como uno espera.

Lo que sí apareció es un dato con muestra suficiente para creérselo: **el
peldaño 3 de `guerra`, con 8 casos, mueve el precio el 13% de las veces, por
debajo de la línea base del 25%.** Es el peldaño más poblado del tema y el que
peor separa.

Suite completa en verde: 961/961, `tsc` y `eslint` limpios.

### Sesión del 2026-09-02 — los umbrales se duplican y la curva por fin baja

Aplicada la decisión: los ocho umbrales de `UMBRAL_MATERIAL` pasan al doble. El
efecto es exactamente el que se buscaba.

| | antes | después |
|---|---|---|
| línea base (fechas al azar) | 85% | **30%** |
| tramo principal | 82% | 59% |
| separación | **−3 pts** | **+29 pts** |

Los tres tramos de hechos curados quedan por encima del control: principal 59%,
control_2014 40%, control_shocks 60%, frente al 30% de las fechas al azar. El
aviso de saturación de `ajustar.mts` ya no salta.

**Y por primera vez la curva baja la severidad en vez de subirla**, que era el
objetivo desde el principio —el clasificador repartía 4 y 5 al 60,9% de las
señales—:

```
  guerra      2/5 → 1/5      fed_tesoro  2/5 → 2/5
              3/5 → 1/5                  3/5 → 2/5
              4/5 → 3/5                  4/5 → 2/5
              5/5 → 5/5                  5/5 → 5/5
```

**Los tests dejan de llevar umbrales literales.** Ocho fallaron al duplicar los
valores, y con razón: comprobaban la cifra en vez de la regla. Ahora se
expresan en múltiplos del umbral (`veces('GC=F', 1.4)`), así que sobreviven a la
próxima recalibración, que la habrá.

**Sigue sin poder aplicarse, pero ya solo por una razón:** 6 de los 8 peldaños
tienen menos de cinco casos. Lo que falta ahora es corpus, no método.

Suite completa en verde: 961/961, `tsc` y `eslint` limpios.

### Sesión del 2026-09-02 — la línea base sale del 85% y tumba el criterio

Aplicada la migración 027 por el usuario, el grupo de control se cargó sin
incidencias: 60 fechas al azar, 1344 mediciones. Y el resultado invalida el
criterio con el que se venía midiendo todo.

**En un día cualquiera, algún activo supera su umbral el 85% de las veces.** Los
eventos del tramo principal lo hacen el 82%. Es decir: con el criterio actual,
las invasiones, los sabotajes y las decisiones de la Fed mueven el mercado
**menos** que una fecha elegida al azar. La separación es de −3 puntos.

Eso explica hacia atrás por qué la curva salía subiendo la severidad: no era
solo el sesgo del corpus, era que el criterio estaba saturado desde el principio
y nadie tenía con qué verlo.

**La causa no es ningún activo suelto.** El que más se dispara en fechas al azar
es el Nasdaq, con un 50%, y el que menos Bitcoin, con un 12%. El problema es la
regla «basta que **uno** de los ocho supere su umbral»: con ocho activos y una
ventana de cinco sesiones, la probabilidad de que ninguno se mueva es pequeña.
Es una prueba múltiple sin corrección.

Medidos los candidatos sobre el corpus y el control, la tabla está en
«Pendiente». La recomendación es duplicar los umbrales manteniendo «basta uno»
(30% contra 59%, +29 puntos), pero **la decisión es del dueño del sistema**: se
eligió tras probar siete criterios sobre los mismos datos y parte de esa ventaja
es sobreajuste.

`ajustar.mts` gana dos avisos que saltan solos: uno cuando la línea base pasa
del 70% —el criterio está saturado— y otro cuando algún peldaño tiene menos de
cinco casos. Ahora mismo saltan los dos: 6 de 8 peldaños están por debajo de
cinco, así que la curva describe el sorteo más que el fenómeno.

Suite completa en verde: 961/961, `tsc` y `eslint` limpios.

### Sesión del 2026-09-02 — la calibración consigue su denominador

El corpus solo tenía la mitad de la tabla: 27 eventos elegidos **por haber sido
importantes**, así que casi todos movieron el precio y la curva acababa subiendo
la severidad en vez de bajarla. Faltaba la pregunta que convierte cualquier
porcentaje en información: **¿y en un día cualquiera, cuántas veces se mueve el
precio?** Si la respuesta es el 80%, un peldaño que acierta el 86% no distingue
casi nada.

**Decisión de método, y es la parte que importa.** La tarea pedía curar 30-50
titulares anodinos a mano. No se hizo así por dos razones: cada titular
inventado trae una fecha sin verificar —el error que más daño hace en este
corpus, según su propia cabecera— y, sobre todo, **quien escribe esa lista
decide qué es anodino**, que es el mismo sesgo del curador que se quería
eliminar. En su lugar hay un grupo de control por muestreo aleatorio: fechas de
sesión reales, sin hecho detrás, medidas exactamente igual. Un muestreo no
opina.

Lo que se añadió:
- **Migración 027** — permite el tramo `placebo` en `severity_events`. Va en la
  misma tabla y no en una aparte porque las mediciones ya cuelgan de
  `severity_events.id`: un control medido por otro camino dejaría de ser
  comparable, que es su única razón de existir.
- **`scripts/calibracion/placebo.mts`** — muestrea con semilla fija (el control
  no puede cambiar entre ejecuciones o no se pueden comparar dos ajustes),
  excluye las sesiones a menos de diez días de un evento del corpus, y arranca
  en la primera fecha del corpus para no comparar regímenes distintos.
- **`liftSobreBase`** en `calibracion.ts` — reescala la probabilidad al tramo
  que queda por encima de la línea base. `ajustar.mts` decide el peldaño final
  con esta cifra y no con la proporción bruta; sin control se cae al
  comportamiento viejo y lo avisa en pantalla.
- **La ficha de backtesting** aparta el placebo de todo lo que promedia —su
  severidad 1 no significa «leve» sino «no hay nada que puntuar»— y enseña la
  línea base, o avisa en ámbar de que no la hay.

**Sigue bloqueado en la migración 027**, que solo puede aplicar el dueño del
proyecto de Supabase. Comprobado contra la base que la constraint actual rechaza
el tramo `placebo`.

Suite completa en verde: 961/961, `tsc` y `eslint` limpios.

### Sesión del 2026-09-02 — el backtesting de eventos deja de vivir solo en la base

Los datos existían desde esta misma sesión —27 eventos y 627 mediciones en
`severity_events` y `severity_event_moves`— pero solo se podían mirar con una
consulta SQL. Ahora hay pantalla: **`/alertas/backtesting`**, con su botón junto
a «Ficha técnica» y «Actualizar».

Qué enseña:
- **Cifras de cabecera**, y las dos que valen van en ámbar: «graves sin efecto»
  y «leves con efecto». Cada una es un caso donde la etiqueta del analista y el
  mercado no coinciden, que es justo lo que el corpus existe para encontrar.
- **Qué mueve cada familia de suceso**, ordenada por número de casos. La
  pregunta útil no es cuánto movió este dron sino cuánto mueve un dron en
  general; con el orden por casos se ve de un vistazo qué familias tienen
  respaldo y cuáles son una anécdota.
- **Los eventos, separados por tramo.** No van mezclados por fecha a propósito:
  el mercado de tasas cero reaccionaba a la geopolítica de otra manera y los
  tramos no son comparables entre sí.
- **Los umbrales** con los que se juzga cada activo, incluida la asimetría del
  VIX.
- **«Qué NO se puede concluir de esta tabla»**, que es la sección que impide que
  la pantalla mienta: el sesgo de selección del corpus, que correlación no es
  causa, y que los tramos no se comparan.

**Decisiones que conviene recordar:**
- La página lee con `createAdminClient`. Las tablas `severity_*` llevan RLS
  activada **sin ninguna política**, porque son tablas de trabajo interno que no
  pertenecen a ningún usuario: sin service key no devuelven ni una fila. El
  guard de admin de la página es lo que sostiene esa decisión.
- `force-dynamic`: el corpus solo cambia cuando alguien ejecuta los scripts a
  mano, pero cuando cambia hay que verlo. Sin esto, corregir una severidad y
  recargar seguiría enseñando la vieja.
- Un fallo de lectura se distingue de «no hay eventos». Son estados distintos y
  el segundo se arregla cargando el corpus, no mirando el log.
- Del VIX se enseña el extremo y no el retorno: es un índice de miedo y lo que
  dice algo es el pico de la ventana, no dónde acabó la semana.

`src/lib/alertas/backtesting.ts` con la agregación (19 tests) y
`FichaBacktesting.tsx` con la pantalla (10 tests). Uno de ellos comprueba que
una medición ausente salga como raya y nunca como 0,0%.

Suite completa en verde: 950/950, `tsc`, `eslint` y `build` limpios.

### Sesión del 2026-09-02 — el VIX deja de contar sus caídas como sustos

`huboMovimiento` medía el extremo en valor absoluto para todos los activos. Para
el oro o el S&P es lo correcto —da igual la dirección, la posición cubierta se
comporta distinto igual—, pero el VIX es un índice de miedo: que suba un 30% es
un susto y que baje un 30% es el mercado calmándose. Ahora el `^VIX` solo cuenta
al alza; el resto sigue en valor absoluto.

**El efecto medible sobre este corpus es cero, y conviene decirlo.** Al
proponerlo escribí que P(movimiento) salía inflada y que eso alimentaba el sesgo
de la curva. Comprobado después: **no cambia ni un veredicto**. Hay tres eventos
con el VIX cayendo un 20% o más —Kursk (−51%), la primera subida de 2022 (−24%)
y Skripal (−32%)— y en los tres había otros activos que sí superaban su umbral,
así que el evento se contaba como movido de todas formas. La curva sale idéntica
antes y después.

Se deja arreglado igualmente porque el fallo es real y esperaba a un caso que no
ha llegado: un evento en el que **solo** el VIX se mueva, y a la baja, se habría
contado como que el mercado reaccionó cuando lo que hizo fue relajarse. Con el
corpus creciendo, ese caso aparecerá.

Suite completa en verde: 919/919 más 2 tests nuevos, `tsc` y `eslint` limpios.

### Sesión del 2026-09-02 — el corpus entero queda alineado con el precio

Las dos discrepancias que quedaban, las de `guerra`, corregidas con el mismo
criterio que las cuatro de la Fed:

| evento | antes | ahora | medición a 5 sesiones |
|---|---|---|---|
| Drones sobre Polonia (10-09-2025) | 4 | **3** | oro +1,3%, VIX +8,9%, ningún activo movió |
| Motín de Wagner (24-06-2023) | 3 | **2** | oro +0,1%, VIX +9,4%, ningún activo movió |

El 4 de Polonia estaba puesto por ser la primera vez que la OTAN disparaba
contra material ruso sobre su territorio. Es importancia histórica, no efecto de
precio, y es el mismo razonamiento corregido cuatro veces en `fed_tesoro`. Queda
a la altura de la violación de Estonia de nueve días después, que es su misma
clase y sí movió dos activos.

**Error medio del clasificador: 0,31 → 0,23.** Acumulado desde el inicio de la
sesión, 0,50 → 0,23.

Con esto los seis eventos mal etiquetados están corregidos y el corpus, el
prompt y la medición dicen lo mismo en los dos temas.

**Dos cosas que salieron a la luz al hacerlo y que NO he tocado**, anotadas en
«Pendiente»: `huboMovimiento` cuenta la caída del VIX como si fuera un susto, y
el clasificador apenas distingue el peldaño 2 del 3 en `guerra` (2,7 contra 2,9).

Suite completa en verde: 919/919, `tsc` y `eslint` limpios.

### Sesión del 2026-09-02 — el tramo de la Fed queda coherente de arriba abajo

Las tres contradicciones que quedaban en `fed_tesoro`, corregidas con la
medición delante. Las tres eran el mismo defecto: severidad puesta por lo que el
hecho significaba y no por lo que hizo el precio.

| evento | antes | ahora | medición a 5 sesiones |
|---|---|---|---|
| IPC de mayo 2022 (10-06) | 4 | **5** | S&P −8,7%, VIX +34,3% |
| Primera subida desde 2018 (16-03-2022) | 4 | **2** | S&P +5,7%, VIX −23,9% |
| Última subida del ciclo (26-07-2023) | 3 | **2** | ningún activo movió |

Dos de las notas viejas ya se contradecían solas: la de 2023 decía
«completamente descontada» —que es la definición literal del peldaño 2— y
llevaba un 3; la del IPC decía «mueve más que la reunión» y le daba la misma
severidad que a la reunión.

**El resultado se puede leer en una columna.** La severidad media que merece
cada peldaño del clasificador, en `fed_tesoro`, es ahora:

```
  llm 2/5  →  merece 2.0
  llm 3/5  →  merece 3.0
  llm 4/5  →  merece 4.0
  llm 5/5  →  merece 4.8
```

El modelo y el corpus corregido dicen casi lo mismo, y los dos coinciden con lo
que hizo el precio. Eso es la señal de que las correcciones iban en la dirección
buena y no de que se hayan movido las etiquetas hasta que cuadrasen.

**Error medio del clasificador sobre el corpus: 0,46 → 0,31.** El de la versión
vieja del prompt baja también, de 0,41 a 0,18, porque los eventos que sí juzgaba
son justo los que ahora están mejor etiquetados.

La curva sigue subiendo la severidad y sigue sin poder aplicarse: eso lo arregla
el corpus con eventos anodinos, no las etiquetas de los que ya están.

Suite completa en verde: 919/919, `tsc` y `eslint` limpios.

### Sesión del 2026-09-02 — la Fed de junio de 2022 deja de valer un 5

El corpus le daba **severidad 5** a la subida de 75 pb del 15 de junio de 2022 y
solo un **4** al IPC del 8,6% del 10 de junio. La medición dice lo contrario, y
sin ambigüedad:

| evento | S&P a 5 sesiones | VIX (extremo) | corpus |
|---|---|---|---|
| IPC del 8,6% (10-06) | **−8,7%** | **+34,3%** | 4 |
| Decisión de 75 pb (15-06) | +0,7% | **−15,1%** | 5 → **2** |

El día que el mercado se desplomó fue el del IPC. Cuando llegó la decisión, la
repreciación ya había ocurrido: el S&P apenas se movió y el VIX **bajó** un 15%.
El 5 estaba puesto por lo que el hecho significaba —la mayor subida desde 1994—
y no por lo que hizo el precio, que es justo el error que todo este trabajo
existe para corregir. Ahora vale 2, «movimiento completamente descontado», con
la nota explicando la corrección y su fecha para que nadie la revierta por
intuición.

Efecto medido: el error medio del clasificador sobre el corpus baja de 0,50 a
**0,46**. El modelo puntuaba ese evento con un 3, más cerca del 2 real que del 5
que decía el corpus.

**Una trampa del pipeline que costó un rato y ya está documentada.** Editar
`eventos.ts` no basta: `cargar.mts` sube la severidad que hay en
`movimientos.json`, donde `medir.mts` deja una copia del corpus. Sin volver a
pasar `calibracion:medir` se recarga la severidad vieja y **nada falla** —el
upsert responde bien y el script dice «Cargados 27 eventos»—. Avisado en la
cabecera de `cargar.mts`. La segunda pasada es rápida: los precios quedan
cacheados en disco.

Suite completa en verde: 919/919, `tsc` y `eslint` limpios.

### Sesión del 2026-09-02 — el clasificador deja de descartar lo que sí importa

El replay dejó a la vista que el prompt tiraba a la basura 10 de 27 eventos del
corpus. Cinco eran agujeros de verdad. Arreglados y medidos:

| | antes | después |
|---|---|---|
| descartados | 10 | **1** |
| juzgados | 17 | 26 |
| con severidad ≥ 4 | 10 de 17 (59%) | 12 de 26 (**46%**) |

Los cinco casos, recuperados: Zaporiyia (da 4, merece 4), MH17 (3 y 3), Skripal
(2 y 2), la rebaja del AAA de 2011 (da 5, merece 4) y la subida de 75 pb de la
Fed (da 3, merece 5). De propina volvieron Wagner, Kursk, Crimea y el 11-S.

**Las dos causas eran distintas y solo una era obvia:**

1. **El modelo usaba las reglas de severidad para decidir la relevancia.** La
   regla dura macro dice que la subida de 75 pb «estaba descontada», y el modelo
   lo leyó como permiso para descartarla. Igual con MH17 y Skripal, que el propio
   prompt cita como precedentes medidos y aun así el filtro rechazaba. Los dos
   prompts llevan ahora un párrafo que separa las dos decisiones: un hecho del
   dominio que no vaya a mover el precio es `relevante: true` con severidad 1 o 2,
   nunca `relevante: false`.
2. **Criterios que no cubrían el hecho.** Skripal era un ataque químico y el
   criterio hablaba de espacio aéreo y marítimo; Zaporiyia era riesgo nuclear
   civil y el criterio solo contemplaba armas nucleares; y el tema se llama
   `fed_tesoro` pero no tenía ni un criterio sobre la deuda del Tesoro, que es la
   mitad del nombre. Los tres cubiertos.

De paso se corrigió una incoherencia: el prompt listaba el MH17 como severidad 2
«sin transmisión al precio» cuando la medición da un VIX +39,8% en el pico de la
ventana, y el corpus le pone 3.

**Herramientas nuevas**, porque «se ve mejor» no es una medición:
- `scripts/calibracion/comparar.mts` enfrenta dos versiones del replay y saca
  descartados, juzgados, peldaños altos y error medio, con la lista de eventos
  recuperados y perdidos.
- `resumirReplay` en `src/lib/alertas/calibracion.ts`, con 6 tests.

**Una cifra que conviene leer bien:** el error medio sube de 0,41 a 0,50. No es
un empeoramiento, es que el conjunto cambió: antes se medía sobre 17 eventos
fáciles y ahora sobre 26, incluidos los nueve que el prompt evitaba juzgar. Un
error medio calculado sobre lo que no se descarta premia al que descarta más.

Suite completa en verde: 919/919, `tsc` y `eslint` limpios.

### Sesión del 2026-09-02 — la calibración de severidad deja de ser una tabla vacía

El pipeline de calibración estaba escrito desde el 2026-09-02 de madrugada pero
nunca se había ejecutado: las cuatro tablas `severity_*` estaban a cero. Ahora
tienen 27 eventos, 627 mediciones, 27 respuestas del clasificador y 7 puntos de
curva.

Lo que se añadió para poder cerrarlo:
- **`scripts/calibracion/replay.mts`** — reejecuta el prompt de hoy sobre los
  titulares del corpus. Cada tanda se etiqueta con `prompt_version`, así que dos
  revisiones del prompt se pueden comparar sin borrar la anterior.
- **`clasificarTitular` acepta un `ahora` inyectable.** El prompt descarta por
  diseño todo lo anterior a 48 horas; sin esto, el replay sobre eventos de 2001
  habría dado `relevante: false` 27 veces y no habría medido nada. En
  producción el parámetro no se pasa y el comportamiento es idéntico.
- **`src/lib/alertas/calibracion.ts`** — umbrales por activo, el criterio de
  «movimiento material», los cortes de probabilidad y la monotonía. Vive en
  `src/lib/` y no en el script porque el motor necesitará las mismas reglas al
  aplicar la curva: separadas, el umbral con el que se ajusta y el umbral con el
  que se publica podrían divergir sin que nadie se enterase. 19 tests.
- **`scripts/calibracion/ajustar.mts`** — construye la curva y avisa en pantalla
  cuando sale sesgada, que es exactamente lo que pasó.

**El resultado honesto: la curva no sirve todavía, y saber por qué es el
hallazgo.** Ver el detalle en «Pendiente». En resumen: el corpus solo tiene
eventos que fueron importantes, así que todos movieron el precio y la curva
acaba subiendo la severidad en vez de bajarla. La infraestructura está bien; lo
que falta es curar 30-50 eventos anodinos.

Suite completa en verde: 913/913, `tsc` y `eslint` limpios.

### Sesión del 2026-09-02 — el enlace del WhatsApp deja de ocupar media pantalla

Los avisos salían con la URL de Google News entera, de más de 350 caracteres, y
con el dominio del acortador delante haciendo de segundo enlace clicable a una
portada que no interesa a nadie.

La causa no estaba en el formato sino en el acortador: **is.gd lleva días
respondiendo `200` con el cuerpo «Error, database insert failed»**. El código ya
comprobaba la forma de la respuesta, así que no enviaba basura —caía a la URL
limpia, que es justo la larga—. El fallo era silencioso por diseño.

- `enlace.ts` prueba ahora **una cadena de acortadores**: TinyURL primero,
  verificado el 2026-09-02 contra la URL real que había salido esa mañana (354
  caracteres → 28), e is.gd como respaldo por si el que cae es el otro.
- `lineaEnlace` deja **solo el enlace**. El dominio se quitó porque con el alias
  ya no era el del medio sino el del acortador, así que no decía quién lo cuenta
  —eso está en la línea de la fuente, justo encima— y sí añadía un segundo
  enlace clicable inútil.
- La ficha técnica de `/alertas/ficha` describe la cadena nueva.

Suite completa en verde: 894/894, `tsc` y `eslint` limpios.

### Sesión del 2026-09-02 — inflación, ficha técnica y tesis de inversión

Tres peticiones del usuario, ninguna empezada. Se hicieron las tres.

**1. La inflación en el panel de alerta temprana.** El IPC ya se descargaba de
FRED pero se pintaba como nivel del índice (~323), que nadie lee como
inflación. Cada serie declara ahora su `lectura` —`'nivel'` o `'var12m'`— y el
IPC se publica como porcentaje interanual, al lado de la tasa real. Se añade
`CPILFESL`, el subyacente, que es el que mira la Fed. La traducción serie →
métrica sale a `metricaDesde`, función pura: es lo que hace testeable la lógica
sin simular FRED ni Yahoo, que es por lo que `medirDebasement` nunca tuvo
pruebas.

**2. Ficha técnica en `/alertas/ficha`.** Ruta propia con guard de
administrador, enlazada desde la cabecera del registro. Documenta los ocho
ciclos con el porqué de cada cadencia, las fuentes de datos, cómo se decide la
severidad, cómo llega el aviso, las curvas de probabilidad y una sección de
límites conocidos. El dato de arquitectura que no estaba en ninguna pantalla:
el motor corre en el **cron del propio servidor**, no en Vercel ni en Actions,
porque el puente hacia WhatsApp solo escucha en `127.0.0.1`.

**3. Tesis de inversión con adjuntos.** El informe DOCX pasa a ser tesis cuando
el usuario aporta Excel, Word o PDF. Lo delicado no era leer los archivos sino
no fiarse del modelo:

- `src/lib/documentos/extraer.ts` — extractor compartido, sacado de
  `api/causal/analyze-docs` (una ruta sin callers). **Tenía un fallo latente:**
  llamaba a `pdf-parse` como función, que es la API de la versión 1; la 2
  exporta la clase `PDFParse`. Habría lanzado «pdfParse is not a function» con
  el primer PDF. Corregido, y de paso a `await import()` en vez de `require`.
- `src/lib/informes/adjuntos.ts` — reparto de 16 000 caracteres entre los
  archivos, redistribuyendo lo que sobra de los cortos.
- `src/lib/informes/trazabilidad.ts` — **la pieza que sostiene el diseño.** El
  prompt obliga al modelo a decir de qué archivo sale cada cifra, pero la
  garantía no puede ser que lo prometa: el servidor busca cada valor en el
  texto extraído del archivo citado, normalizando formatos (`1.234,50` y
  `$1,234.50` son el mismo número). Lo que no aparece no se imprime, y una
  valoración propia sin ninguna cifra verificada se retira entera.
- Precedencia en tres niveles: los precios siempre de Yahoo (un adjunto está
  desactualizado por definición), los fundamentales del adjunto, y el resto de
  Yahoo. El pisado de precios que ya existía se conserva intacto.
- `ReportContent` se extiende **solo con campos opcionales**: las filas
  antiguas de `content_json` siguen regenerándose sin ramas especiales.
  `buildSystemPrompt(false)` devuelve el literal de siempre byte a byte, con un
  test que lo congela.
- **Fallo de marca corregido:** `docx.ts` cargaba `public/emporium-logo.jpg`,
  borrado en el rebrand, y el `catch` mudo lo escondía. Todos los informes
  salían sin logotipo. Ahora usa `public/brand/logo-hrz-azul.png` con el alto
  correcto para su ratio (1920×616), y avisa si falla.

| Check | Resultado |
|---|---|
| `npm run lint` | 0 problemas |
| `npx tsc --noEmit` | exit 0 |
| `npm run test:run` | **894/894** (67 ficheros) |
| `npm run build` | exit 0 |

Las migraciones 025 y 026 se aplicaron y verificaron el 2026-09-02.

### Sesión del 2026-09-02 (cierre) — la cobertura de las calls deja de ser una convención

Última deuda abierta de los agentes de opciones. El sistema llamaba «cubierta»
a toda call vendida sin mirar nunca si había acciones detrás, y una call
descubierta tiene pérdida ilimitada: no es un matiz contable.

- **`accionesPorTicker(stocks)`** en `positions.ts` suma las acciones abiertas
  por símbolo del portafolio de acciones. Es la única cartera de títulos que
  conoce la aplicación, así que es la única fuente posible de la respuesta.
- **`coberturaDeCall(...)`** devuelve `{ necesarias, enCartera, cubierta }` solo
  para las calls cubiertas **abiertas**. En una cerrada devuelve `null` a
  propósito: las acciones de hoy no dicen nada de las de entonces.
- **`buildOptionPositions`** acepta un cuarto argumento opcional con ese mapa.
  Sin él, la lectura por defecto es la prudente: descubierta.
- **`PortafoliosClient`** deriva el mapa del portafolio de acciones y lo pasa a
  las dos carteras de opciones; **`PositionsTable`** pinta «⚠ descubierta» con
  el detalle en el `title`.
- **6 tests nuevos** en `positions.test.ts` (descubierta, cubierta, sin mapa,
  put asegurado, call cerrada, suma de `accionesPorTicker`).

| Check | Resultado |
|---|---|
| `npm run lint` | 0 problemas |
| `npx tsc --noEmit` | exit 0 |
| `npm run test:run` | **825/825** (60 ficheros) |
| `npm run build` | exit 0 |

Se avisa en vez de excluir la posición: la call existe y su riesgo es justo lo
que hay que ver en la tabla. Queda por decidir si Theta debe además exigir las
acciones antes de proponer la call.

### Sesión del 2026-09-02 — borrado de Ergo Quant y su backend FastAPI

Congelado desde el 2026-08-23 y fuera de la navegación desde entonces. Borrado
por decisión del usuario. Lo que se fue:

- `src/app/(dashboard)/ergos-quant/` — 5 componentes.
- `src/app/api/ergos-quant/[...path]/route.ts` — el proxy con `X-API-Key`.
- `ergo-quant-api/` — el backend FastAPI, 23 ficheros Python, 240 KB.
- En `render.yaml`, el servicio `pserv` entero y las dos variables
  `ERGO_QUANT_API_URL` / `ERGO_QUANT_API_KEY` que colgaban de él.
- La rama `/ergos-quant` de `isProtectedRoute` en `proxy.ts`.
- `scripts/render-start-single.sh`, que existía solo para arrancar Next y
  FastAPI dentro de un mismo servicio de Render.
- `.python-version` y `runtime.txt` de la raíz: **no queda un solo `.py` en el
  repositorio** fuera del backend borrado, así que declaraban una versión de
  Python que ya nadie usa.
- `.vercelignore`, cuyas dos únicas líneas eran `ergo-quant-api/` y
  `ergo-quant-temp/` (esta última ni siquiera existía).

`DEPLOY_RENDER.md` estaba estructurado entero alrededor de los dos servicios
—modo Blueprint, modo manual, `CORS_ORIGINS`, el pin de Python 3.11 por
`dowhy`/`econml`— y se reescribió: el despliegue es ahora una sola aplicación
Node. La versión anterior queda en el historial de git.

Un detalle de la verificación: tras borrar las carpetas, `tsc` fallaba con dos
`TS2307` que **no venían del código** sino de `.next/types/validator.ts`, que
seguía validando las rutas viejas. Se arregla con `npx next typegen`.

| Check | Resultado |
|---|---|
| `npx tsc --noEmit` | exit 0 (tras `next typegen`) |
| `npm run lint` | 0 problemas |
| `npm run test:run` | **819/819** (60 ficheros) |
| `npm run build` | exit 0, sin rutas `ergos-quant` |

**No se tocaron** tres documentos que mencionan Ergo Quant a propósito:
`SECURITY_AUDIT_RENDER.md` y `SECURITY_REVIEW_PROGRESS.md` son registros
históricos —y el segundo está marcado como congelado—, así que reescribirlos
falsearía lo que se auditó aquel día. `presentacion/build.js` y los dos
`GUION_LOCUCION.md` contienen la narración de una presentación ya grabada que
cita el gateway `/api/ergos-quant/[...path]` como ejemplo de arquitectura;
cambiarla obliga a reconstruir la presentación y a rehacer la locución.

### Sesión del 2026-09-02 (tarde) — deuda de los agentes de opciones

Tres de las cuatro deudas anotadas al escribir las fichas técnicas. La primera
resultó estar **ya resuelta**: la nota sobre los niveles de Gamma llevaba tiempo
sin reflejar el código.

**El colateral de las calls cubiertas estaba mal medido.** `positions.ts` leía
el precio del subyacente de `ai_report.underlying`, pero Theta nunca escribía
ese campo, así que el fallback `subyacenteEntrada ?? strike` valoraba toda call
cubierta con el strike. El dato estaba a mano —`t.underlyingPrice`, el mismo que
ya se le pasaba a la IA— y ahora se persiste.

**Un bug de tipos que nadie había anotado:** `AgenteGamma.tsx` guardaba
`underlying: t.ticker`, un string, en el campo que `positions.ts` casteaba con
`as number`. Hoy no reventaba porque Gamma es largo y su capital sale de la
prima, pero el cast era falso. Gamma pasa a guardar el precio y `positions.ts`
valida el tipo con `typeof === 'number' && > 0` en vez de castear a ciegas, así
que las filas históricas con el ticker caen limpiamente al strike.

**Rangos de delta alineados hacia el score** (decisión del usuario: estrechar
los filtros, no ampliar el score). Theta 0,15→**0,20** de suelo, Gamma
0,30→**0,45**. Actualizadas también las etiquetas de los pasos y los mensajes de
fallo, que enseñaban los rangos viejos.

Dos tests nuevos en `positions.test.ts`: una call cubierta con `underlying`
numérico debe valorarse con el precio de la acción (23 140, no 25 000), y un
`underlying` string debe ignorarse en vez de propagarse.

| Check | Resultado |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | 0 problemas |
| `npm run test:run` | **819/819** (60 ficheros) |
| `npm run build` | exit 0 |

Lo que **no** se tocó: que nadie verifica la posesión de las acciones en un
covered-call. Sigue abierto.

### Sesión del 2026-09-02 — recalibración de la severidad del clasificador

El clasificador marcaba como grave casi todo: **60,9% de las señales en peldaños
4 o 5**, con doce avisos del mismo ataque de Leipzig y un artículo de opinión
puntuado 5/5. Se midió el problema, se contrastó contra lo que hizo de verdad el
mercado en 27 eventos históricos, y se corrigió el prompt con esas cifras.

- **Prompts reescritos con anclas medidas** (`src/lib/alertas/clasificador.ts`).
  Cada peldaño lleva precedentes reales con su retorno del oro, VIX y S&P. La
  regla es explícita: severidad = efecto esperado en el precio, no gravedad
  humana. Przewodów puso dos muertos en suelo OTAN y dejó el S&P en −0,2%.
- **Claves de evento con vocabulario cerrado.** El slug ya no se improvisa desde
  el titular: `<tipo-de-hecho>-<lugar>-<AAAA-MM-DD>` con lista fija de tipos. Es
  lo que hace que el enfriamiento de `alert_dedupe` llegue a activarse.
- **Suelo de envío** (`src/lib/alertas/dedupe.ts`): `SEVERIDAD_MINIMA_POR_DEFECTO`
  = 3, ajustable con `ALERTAS_SEVERIDAD_MINIMA`. Manda sobre el resto de reglas.
- **Despacho silencioso** (`src/lib/alertas/motor.ts`): lo que no suena se guarda
  igual en `alert_signals`, con `aceptado_at` nulo y el motivo en `canal_detalle`.
- **Cuatro comandos nuevos**: `calibracion:auditar`, `calibracion:claves`,
  `calibracion:medir`, `calibracion:cargar`.
- **Migración `025_calibracion_severidad.sql`** con `severity_events`,
  `severity_event_moves`, `severity_calibration` y `severity_llm_replay`.
- Informe completo en `INFORME-CALIBRACION-SEVERIDAD.md`.
- Suite: **817 tests verdes en 60 ficheros**, lint y typecheck limpios.

### Sesión del 2026-09-01 (noche) — cierre de la alerta temprana viva

Sesión retomada tras varias desconexiones. El objetivo era averiguar qué había
quedado a medias y cerrarlo.

**Lo que se hizo:**

1. **Auditoría del estado real.** Buena parte de lo que el cuaderno daba por
   bloqueante ya estaba resuelto: la sesión de WhatsApp de `nexus` relinkeada,
   la entrega de extremo a extremo confirmada con `alertas prueba` (exit 0), y
   el crontab con sus nueve entradas activas. El cuaderno mentía, no el sistema.
2. **PR #13 mergeado en `main`** (`17c8c5d`, merge commit, los seis commits
   conservados). Trae las cuatro fases de la alerta temprana viva: ingesta del
   pulso, extracción de términos, curvas de probabilidad y la UI. Tests en
   `main` tras el merge: **798/798**. Deploy de producción de Vercel en verde.
   La migración `024_pulso_publico.sql` ya estaba aplicada.
3. **Enlaces cortos en los mensajes de WhatsApp** (`src/lib/alertas/enlace.ts`).
   Ver la entrada siguiente.

**Lo que queda abierto, y por qué no dependía de esta sesión:**

- La **captura de cadenas de opciones** sigue sin probarse dentro de la ventana
  de Nueva York. El único disparo reciente cayó a las 12:27 ET, fuera de franja.
- Las **curvas de probabilidad** tienen 5 días de features de los 60 que exige
  `MINIMO_DIAS`. Es calibración normal: la UI enseña «sin activar» con cuenta
  atrás hasta ~1 de noviembre. No hay nada que arreglar.
- La **cartera única** sigue inactiva a propósito (migración 018 sin aplicar).

### Los enlaces de las noticias dejan de ocupar media pantalla (2026-09-01)

Los titulares llegan por el RSS de Google News y su enlace es una cadena opaca
de varios cientos de caracteres. En el móvil empujaba hacia abajo los niveles de
la orden, que es lo único que hay que leer con prisa, y encima no decía de qué
medio venía la noticia.

`src/lib/alertas/enlace.ts` lo resuelve en dos tiempos, y **el segundo puede
fallar sin consecuencias**:

1. `limpiarUrl` quita los parámetros de campaña (`utm_*`, `oc`, `hl`, `gl`,
   `ceid`, `fbclid`…), el ancla y la barra final. Es local y siempre funciona.
2. `acortarUrl` pide un alias a **is.gd** (sin clave, timeout de 4 s). Si el
   servicio tarda, responde mal o devuelve un texto que no es un enlace suyo,
   se usa la URL limpia y el mensaje sale igual. Un aviso de escalada militar no
   se pierde porque un acortador esté de mantenimiento.

Los enlaces que ya son cortos (≤ 70 caracteres) **no** se mandan a is.gd: no
tiene sentido pagar una llamada de red para no ganar nada.

El formato del mensaje también cambia: el titular va en negrita, el enlace en su
propia línea precedido del medio (`🔗 reuters.com · https://is.gd/aB3xY9`), y los
niveles bajo un encabezado `*Niveles*` en vez de sueltos.

`mensajes.ts` sigue siendo **puro y síncrono**: recibe el enlace ya acortado por
parámetro. El `await` vive en `motor.ts`, que es donde ya se hacía red. Así los
tests del formato no necesitan tocar la red.

### Los crons programados vuelven a correr (2026-09-01)

Los dos workflows de GitHub —«Revisión de niveles de salida» y «Archivo diario
de cadenas de opciones»— fallaban en **cada** ejecución desde el 2026-08-26. La
causa no era la migración 019, que ya estaba aplicada, sino que faltaban tres
variables de configuración:

- `CRON_SECRET` — no existía en ninguna parte (GitHub, Vercel ni `.env.local`,
  donde la línea estaba presente pero vacía). El endpoint responde 503 cuando
  falta, porque `cron-auth.ts` falla cerrado a propósito.
- `APP_URL` — variable del repositorio en GitHub, sin definir. El job abortaba
  en 4 segundos sin llegar a llamar a nada.
- `CRON_USER_ID` — la cuenta sobre la que operan las tareas. Es el UID de
  `lriofrio915@gmail.com`, el admin según `admin_user_ids()` de la migración 018.

El coste no fue solo tener los jobs en rojo: **ocho posiciones de OPTIONS_THETA
llevaban seis días con el objetivo tocado sin cerrarse.** Al relanzar el
workflow se cerraron las ocho de golpe (siete por objetivo, entre +60 % y +94 %;
una por stop, LCID a -132,6 %), y quedaron persistidas con `precio_venta` y
`closed_at`.

**Lección para la próxima:** que un workflow exista y esté «activo» no dice nada
sobre si funciona. Conviene mirar `gh run list` antes de dar por buena una tarea
programada — el historial estaba a la vista y nadie lo miró en seis días.

**Sigue sin verificarse** la captura real de cadenas: el endpoint solo archiva
entre las 16:00 y las 19:00 de Nueva York, y la ejecución de prueba respondió
`fuera-de-ventana` correctamente. `options_chain_snapshots` continúa con 0 filas.


### El registro de alertas distingue aceptación de entrega (2026-09-01)

PR #12, rama `fix/registro-entrega-honesto`, mergeado en `main` con rebase el
2026-09-01 (`416b214`, `1d9a73e`). La migración 023 está aplicada y verificada:
`enviado_at` ya no existe, `aceptado_at`, `canal_estado` y `canal_detalle` sí,
y ninguna fila quedó con `canal_estado` nulo.

El puente de Nexus responde `202 queued` en cuanto recibe la petición y hace el
envío a WhatsApp después. Con la sesión caída sigue devolviendo 202 y el fallo
solo sale en su log medio minuto más tarde, así que `enviado_at` se rellenaba
con mensajes que nunca llegaron al teléfono. Pasó el 2026-08-31: dos alertas
figuraban como enviadas con la cuenta `nexus` desvinculada.

- `src/lib/alertas/canal.ts` consulta el estado de la sesión en OpenClaw justo
  antes de cada envío: `vivo` / `caido` / `desconocido` más una línea de
  detalle auditable. 8 tests para los casos límite (CLI ausente, timeout,
  salida inesperada).
- `ResultadoEnvio.ok` pasa a `aceptado` y acarrea `canal` y `canalDetalle`. Un
  202 con el canal caído devuelve error explícito en vez de silencio.
- La contabilidad de `enviados` en `motor.ts` exige canal vivo; el resto cuenta
  como omitido.
- Migración 023: `enviado_at` → `aceptado_at`, más `canal_estado` y
  `canal_detalle`. Las filas anteriores quedan como `'desconocido'`.
- Panel: chip de entrega con los cuatro estados y el KPI «Envíos fallidos»
  renombrado a «No entregados» con tooltip.

Lint 0, `tsc --noEmit` 0, 730/730 tests.

### Aprobación, cobro de comisión y track record de las rechazadas (2026-08-31)

La tabla **RECOMENDACIONES DE {usuario}** (`informes_history`) no registraba la
decisión del CEO ni si la comisión llegó a cobrarse, y las recomendaciones
rechazadas desaparecían del análisis.

**Flujo que ahora refleja el sistema:** el usuario genera el informe, escribe
`P.Compra` y la fila queda **En revisión**; cuando el CEO se pronuncia de
palabra, el usuario la pasa a Aprobada, Rechazada o En observación.

- Migración `020_informes_history_aprobacion_comision.sql`: `aprobacion` (con
  `CHECK`, por defecto `'Revision'`), `aprobacion_at`, `comision_cobrada`,
  `comision_cobrada_at`, `comision_cobrada_monto`.
- Columna **Aprobación** (`select` estilo badge, junto a Estado) y columna
  **Cobro** a la derecha de Comisión (botón Pendiente ⇄ Cobrada).
- El chip «Comisión total» de la cabecera se parte en **Comisión cobrada** y
  **Comisión pendiente**; «Neto empresa» no cambia de fórmula.
- Panel plegable **CARTERA RECHAZADA**: aciertos, rendimiento medio, mejor,
  peor, G/P hipotético y el detalle fila a fila. Mide desde `precio_compra`
  contra el precio de mercado actual, en abierto desde la fecha del rechazo.

**Decisiones tomadas:**
- `aprobacion` es una columna nueva, **no** se reutiliza `estado`: ahí `Vender`
  cierra la posición y fija `precio_venta`, así que rechazar una recomendación
  habría cerrado operaciones.
- `comision_cobrada_monto` congela el importe el día del cobro. `comisionPct`
  es un input volátil y bajarlo del 20% al 15% no puede reescribir lo ya
  cobrado.
- Solo se toca la tabla del usuario. `agent_recommendations` queda intacta.
- Las rechazadas sin `precio_compra` quedan fuera del panel: no hay base contra
  la que medirlas.

**Verificado:** lint 0, `tsc --noEmit` 0, 622/622 tests, build de producción OK.

**Migraciones aplicadas en Supabase el 2026-08-31** y verificadas contra la base
de datos: la **018** (cartera de agentes compartida) y la **019** (tabla
`options_chain_snapshots`), que arrastraban pendientes desde el 23 y el 29 de
agosto, más la **020** de esta sesión.

**Hallazgo al verificar → migración 021.** `public.admin_user_ids()` respondía
200 con el uuid de la cuenta de administrador a quien llamara con la clave
anónima. El `REVOKE ALL ... FROM public` de la 018 no bastaba: Supabase concede
`EXECUTE` de forma nominal a `anon` y `authenticated` sobre cada función nueva
del esquema `public`, y revocar del pseudo-rol PUBLIC no toca esas concesiones.
`021_revoke_admin_functions_from_anon.sql` revoca de `anon` en las dos
funciones; ya devuelven `permission denied`. No era escalable a acceso —RLS
compara contra `auth.uid()` de un JWT firmado—, pero era un identificador
interno expuesto sin necesidad.

**Pendiente:** probar el flujo en el navegador con una cuenta real.

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
1. ~~Aplicar la migración 019 en Supabase.~~ Aplicada; verificado el 2026-09-01.
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

### Alerta temprana (2026-08-31)
- **El motor corre como cron del VPS, no en la aplicación.** El puente de Nexus
  hacia WhatsApp escucha solo en `127.0.0.1:9091`, y la app se despliega fuera
  del servidor. Publicar ese puente en internet sería exponer un disparador de
  mensajes a quien encontrase el token. Además GitHub Actions no baja de cinco
  minutos de resolución y una escalada bélica se cotiza en segundos.
- **No se tocó el puente.** Se usa la ruta que ya exponía (`/webhook/liberty-trading`);
  lo que identifica a este proyecto en su log es el campo `event`. Cero cambios
  fuera del repositorio.
- **El nivel de la orden es medio ATR(14), no un porcentaje fijo.** Medio ATR
  del oro son unos 38 dólares y el de bitcoin más de mil: un porcentaje único
  trataría por igual a activos que respiran distinto. Se implementó el ATR de
  Wilder en `src/lib/alertas/atr.ts` porque no existía en el repositorio.
- **La probabilidad de subida se calcula, no se copia.** CME FedWatch no tiene
  API pública y su página es JS pesado con términos de uso restrictivos. Se
  descompone el contrato ZQ del mes de la reunión con su misma metodología
  (`100 − P` es la tasa media del mes; se despeja la posterior a la reunión).
  Contratos verificados en Yahoo: `ZQU26.CBT`, `ZQV26.CBT`, `ZQZ26.CBT`.
- **Sin nivel antes que con un nivel inventado.** Si falta historia para el ATR
  o el contrato no cotiza, el mensaje sale diciendo qué activo se quedó sin
  nivel, y la foto macro se marca como aproximada. Una cifra inventada en una
  orden stop cuesta dinero real.
- **La OTAN retiró sus feeds RSS** (todas las rutas conocidas dan 404, verificado
  el 2026-08-31) y Reuters cerró los suyos. La cobertura bélica se apoya en
  consultas dirigidas de Google News; la macro sí tiene fuente primaria con feed
  vivo: comunicados, política monetaria y discursos de la Reserva Federal, y el
  IPC del BLS.
- **Dedupe por suceso, no por titular.** El LLM asigna una clave del hecho
  (`dron-ruso-derribado-polonia-2026-08-31`), así veinte medios contando lo mismo
  generan un solo mensaje. Enfriamiento de 45 minutos y tope de 6 mensajes por
  hora, ambos rotos por una **escalada de severidad**: si el incidente empeora,
  el aviso sale igual.
- **Todo mensaje queda registrado con su resultado de envío.** Un aviso que nadie
  puede auditar después no vale nada: cuando el oro se mueva un 2% hay que poder
  responder qué se avisó, a qué hora y con qué precio de referencia.
- **El agrupamiento de sucesos está verificado con titulares reales.**
  `scripts/alertas/run.sh claves` clasifica lo que hay publicado en ese momento
  y enseña qué clave asigna a cada titular. En la prueba del 2026-08-31, dos
  medios distintos contando la interceptación del avión espía ruso sobre el
  Báltico produjeron la misma clave, que es justo lo que evita el duplicado.
- **`/alertas` es solo lectura y solo admin**, protegida por RLS (`is_admin()`)
  además de por la guarda de la API: un cliente puede hablar con Supabase sin
  pasar por la aplicación.


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

### Alertas
- **«Aceptado» y «entregado» no son lo mismo.** El puente de Nexus es asíncrono
  y su 202 solo dice que recibió la petición. El registro nombra lo que de
  verdad sabe (`aceptado_at`) y guarda aparte el estado del canal, que es lo
  más cerca que se puede estar de saber si llegará.
- **Con el canal caído se envía igual**: el puente encola y OpenClaw reintenta
  al volver. Lo que cambia es que la fila lo dice, en vez de contarlo como un
  envío bueno.
- **Las filas anteriores a la migración 023 quedan como `desconocido`**, no como
  `vivo`. Marcarlas de otro modo repetiría la misma mentira que se está
  corrigiendo.

### Congelado
- Todo lo de Render y las vulnerabilidades de `npm audit`, documentado en
  `SECURITY_REVIEW_PROGRESS.md`.
