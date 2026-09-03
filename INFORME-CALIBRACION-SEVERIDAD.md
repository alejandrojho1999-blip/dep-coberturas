# Recalibración de la severidad del clasificador

*2026-09-02 · actualizado el 2026-09-03*

El sistema de alerta temprana llevaba desde el 31 de agosto marcando casi todo
como grave. Este informe recoge la medida del problema, lo que dice el mercado
sobre cuánto vale de verdad cada tipo de suceso, y qué se ha cambiado.

**Si solo se va a leer una sección, que sea «Cómo funciona el sistema hoy»**: es
la que describe el estado vigente. Las dos anteriores son el diagnóstico
original y se conservan como registro de por qué se hizo cada cosa.

## El problema, con números

`npm run calibracion:auditar` sobre las 23 señales registradas entre el
2026-08-31 y el 2026-09-01:

| Peldaño | Señales | Porcentaje |
| ------- | ------: | ---------: |
| 5/5     |       2 |       8,7% |
| 4/5     |      12 |      52,2% |
| 3/5     |       5 |      21,7% |
| 2/5     |       1 |       4,3% |
| 1/5     |       3 |      13,0% |

**El 60,9% de las señales estaba en 4 o 5.** Por tipo: `guerra` con media 3,71
sobre 17 señales, `fed_tesoro` con 3,25 sobre 4, `debasement` con 1,00 sobre 2.

Dos cosas explican la cifra:

1. **La escala del prompt era cualitativa.** Decía *«4: víctimas o daño en
   territorio OTAN»*, así que el modelo puntuaba gravedad humana. Los doce
   peldaños 4 son el mismo suceso —el ataque con dron al aeropuerto de Leipzig
   del 1 de septiembre— contado por doce medios distintos.
2. **No había suelo de envío.** Todo lo que el LLM marcaba como relevante salía
   por WhatsApp, incluido un artículo de opinión de Pressenza sobre escalada
   nuclear que se llevó un 5/5 siendo un texto especulativo, no un hecho.

Había además un fallo de deduplicación: el mismo ataque de Leipzig generó al
menos **nueve claves distintas** (`ataque-hibrido-alemania-…`,
`ataque-dron-leipzig-…`, `drones-rusos-atacan-aeropuerto-leipzig-…`) porque el
modelo construía el slug desde el titular. `alert_dedupe` compara claves
exactas, así que el enfriamiento no llegó a activarse ni una vez.

## Lo que dice el mercado

`npm run calibracion:medir` mide, para 27 eventos históricos verificados, el
retorno a +1, +3 y +5 sesiones desde el cierre **previo** al hecho, sobre ocho
activos. Columnas a 5 sesiones:

| Fecha      | Suceso                                        | Oro    | VIX (extremo) | S&P    |
| ---------- | --------------------------------------------- | -----: | ------------: | -----: |
| 2022-02-24 | Rusia invade Ucrania                          |  +0,6% |       +21,8%  |  +3,8% |
| 2022-09-21 | Movilización parcial y alusión nuclear         |  −2,0% |       +25,7%  |  −5,5% |
| 2022-09-26 | Sabotaje del Nord Stream                       |  +1,0% |       +16,6%  |  −2,9% |
| 2022-11-15 | Misil con dos muertos en Przewodów (Polonia)   |  −2,0% |       +10,5%  |  −0,2% |
| 2023-06-24 | Motín de Wagner y marcha sobre Moscú           |  +0,1% |        +9,4%  |  +2,3% |
| 2024-11-19 | Rusia rebaja el umbral de su doctrina nuclear  |  +0,2% |       +20,6%  |  +1,5% |
| 2025-09-10 | Drones rusos derribados sobre Polonia          |  +1,3% |        +8,9%  |  +1,4% |
| 2025-09-19 | Tres MiG-31 violan el espacio aéreo de Estonia |  +2,6% |       +13,0%  |  +0,4% |
| 2014-07-17 | Derribo del MH17, 298 muertos                  |  +0,4% |       +39,8%  |  +0,3% |
| 2022-06-10 | IPC de mayo al 8,6%                            |  −0,2% |       +34,3%  |  −8,7% |
| 2022-06-15 | La Fed sube 75 pb, la mayor desde 1994          |  +1,4% |       −15,1%  |  +0,7% |
| 2023-03-10 | Quiebra de Silicon Valley Bank                 |  +4,9% |       +36,3%  |  +1,0% |
| 2023-07-26 | Última subida del ciclo (5,25-5,50%)           |  −1,1% |        +8,4%  |  +0,1% |
| 2024-12-18 | Recorte de 25 pb con menos recortes previstos   |  −0,9% |       +78,5%  |  +0,7% |
| 2020-03-15 | Recorte de emergencia a cero                   |  −2,1% |       +47,8%  |  −9,6% |
| 2008-09-15 | Quiebra de Lehman Brothers                     | +13,2% |       +64,3%  |  +1,8% |

Tres lecciones salen de ahí, y las tres contradicen el prompt anterior:

- **Las muertes no mueven el precio.** Przewodów puso dos muertos en suelo OTAN
  —el criterio literal del peldaño 4— y dejó el S&P en −0,2%. El MH17, con 298
  muertos, dejó el S&P en +0,3%. La gravedad humana y el efecto de mercado son
  ejes distintos.
- **Lo esperado no mueve nada por grande que sea.** La mayor subida de tipos
  desde 1994 dejó el S&P en +0,7%, porque estaba descontada desde el IPC de dos
  días antes. Ese mismo IPC, que sí sorprendió, se llevó un −8,7%.
- **Lo que mueve es el cambio de régimen, no el titular.** Lehman, SVB y el
  recorte de emergencia de marzo de 2020 son los movimientos grandes del corpus.

Los tramos `control_2014` y `control_shocks` se miden aparte a propósito: el
mercado de tasas cero reaccionaba de otra manera y mezclarlos con el tramo
principal produciría anclas que no describen el régimen actual.

## Cómo funciona el sistema hoy

*Esta sección describe el estado al 2026-09-03, después de todas las
correcciones del 2026-09-02. Lo de abajo es el registro de cómo se llegó aquí.*

El pipeline tiene cinco piezas y cada una responde a una pregunta distinta:

| Paso | Comando | La pregunta que responde |
| ---- | ------- | ------------------------ |
| 1. Corpus | `calibracion:medir` + `calibracion:cargar` | ¿Qué hizo el precio tras cada hecho histórico? |
| 2. Control | `calibracion:placebo` | ¿Y qué hace en una fecha al azar, sin hecho detrás? |
| 3. Replay | `calibracion:replay -- <version>` | ¿Qué peldaño le habría dado el clasificador? |
| 4. Curva | `calibracion:ajustar -- <version>` | ¿A qué peldaño lo traduce el precio? |
| 5. Perfil | `calibracion:normalidad` | ¿De qué está hecha la línea base, activo por activo? |

**La pieza que lo cambió todo es la 2.** Sin grupo de control, «el 86% de estos
eventos movió el mercado» no se puede interpretar: puede ser mucho o puede ser
menos que el azar. Con él, lo único que cuenta es el **lift** —lo que un peldaño
añade sobre la línea base—, y no la proporción bruta. Un peldaño que mueve el
precio tanto como un martes cualquiera vale cero por grave que suene.

### El criterio de «movimiento material»

Un evento movió el precio si **algún** activo superó su umbral en las 5 sesiones
siguientes, medido sobre el **extremo** de la ventana y no sobre el cierre: lo
que importa es si hubo susto en algún momento, no si el viernes ya se había
deshecho. En el VIX solo cuenta la subida, porque un desplome es el mercado
calmándose. Los umbrales viven en `UMBRAL_MATERIAL` (`calibracion.ts`) y se
duplicaron el 2026-09-02: con los viejos, la línea base salía al 85% y el
criterio estaba saturado —si casi cualquier semana cuenta como movimiento,
«pasó algo» no distingue nada—.

### El día normal, activo por activo

`calibracion:normalidad` es lo que permite ver a qué distancia queda una sesión
corriente del umbral de un evento. Sobre 60 fechas de control **emparejadas por
época** y 32 hechos:

| Activo | Umbral | Mediana normal | p90 | Máx | Cruza sin noticia | Cruza con noticia | Separación |
| ------ | -----: | -------------: | --: | --: | ----------------: | ----------------: | ---------: |
| WTI     | 12% | 4,9% |  9,8% |  22,9% |  4/60 |  8/32 | **+18 pts** |
| VIX     | 25% | 8,8% | 31,4% | 102,9% | 10/60 | 11/32 | **+18 pts** |
| **Oro** | **3,6%** | 2,0% |  5,6% |  17,9% | 11/60 | 12/32 | **+19 pts** |
| Bitcoin | 16% | 6,2% | 18,2% |  20,8% |  7/47 |  7/25 | +13 pts |
| S&P 500 |  5% | 2,4% |  5,3% |   9,5% |  8/60 |  8/32 | +12 pts |
| Nasdaq  |  6% | 2,9% |  7,1% |  12,1% |  8/60 |  8/32 | +12 pts |
| Dólar   |  3% | 1,0% |  1,7% |   2,5% |  0/60 |  2/32 | +6 pts |
| Plata   | 10% | 3,1% |  7,8% |  23,9% |  4/60 |  4/32 | +6 pts |

«Separación» es cuánto más cruza el umbral con noticia que sin ella. Se compara
en tasa y no en cuenta porque los grupos no tienen el mismo tamaño.

Los que mejor separan son el **oro**, el **WTI** y el **VIX**, los tres desde
que se les revisó el umbral (ver abajo). El oro, que es el ancla de casi todos
los precedentes del prompt, estuvo en +6 puntos hasta el 2026-09-03 con un
umbral del 6% que era sencillamente demasiado alto.

El VIX llega a un máximo del **102,9%** en una fecha de control sin nada detrás
—el 18 de enero de 2022, con el desplome que abrió aquel año—. No es un error de
medición: es que la cola del VIX es larguísima, y por eso su umbral no se puede
elegir mirando el máximo.

### El umbral del VIX: puesto para que cruzar fuera raro, no para captar eventos

Al 40%, el VIX era **peso muerto**: la separación del criterio completo era la
misma con él que sin él, +1 punto. Solo 5 de los 32 hechos del corpus llegaban a
moverlo tanto. El umbral se había elegido para que cruzar fuera improbable —cae
en el percentil 93 del día normal, en línea con el oro y el WTI— pero sin
comprobar lo contrario: que los eventos de verdad lo cruzaran. La mediana del
VIX en un hecho curado es del **17%** y su p75 del **34%**, así que tres cuartas
partes de los eventos se quedaban cortos.

**Baja al 25% el 2026-09-03.** Captura 11 de 32 hechos en vez de 5, y su
aportación al criterio pasa de +1 a +7 puntos.

No es el valor que más separa. El barrido fino da esto:

| Umbral del VIX | Línea base | Separación |
| -------------: | ---------: | ---------: |
| 12,5% | 53% | 25 pts |
| 15%   | 52% | 23 pts |
| **17,5% – 27,5%** | **40-50%** | **16 pts, constante** |
| 30-37,5% | 37-40% | 13-16 pts |
| 40% (antes) | 37% | 10 pts |

El máximo está en el 12,5%, y se descartó por dos razones. La primera es que
sube la línea base al 53%, que es volver a la saturación que estos umbrales
corrigieron: con un día cualquiera moviéndose la mitad de las veces, «pasó algo»
deja de distinguir nada. La segunda es la forma de la curva: entre el 17,5% y el
27,5% la separación se queda clavada en 16 puntos durante **cinco pasos
seguidos**, y esa meseta es la señal de que el valor no está ajustado al ruido de
la muestra. El pico del 12,5% dura dos pasos y tiene toda la pinta de estarlo.
Se coge el centro de la meseta.

Con el 25%, el VIX cae en el percentil 83 del día normal, en línea con Bitcoin
(p85) y los índices (p87).

**Qué prueba esto y qué no.** La mejora frente al 40% sale en el 83% de los
remuestreos, pero su intervalo del 90% es [−3, 16] y toca el cero: no es prueba
estadística. Lo que sí está fuera de duda es que el 40% era peso muerto, y que
la meseta no depende del valor exacto.

**Aviso de lectura: esta columna no basta para decidir quitar un activo.** Ver
la sección siguiente, que es donde está el criterio correcto.

### El grupo de control tiene que cubrir las mismas épocas que el corpus

Es la corrección más importante de todas y se descubrió tirando del hilo de un
detalle: **Bitcoin cotizaba en el 78% de los hechos curados y solo en el 40% de
las fechas de control.** Como la regla es «basta que uno cruce», un activo solo
puede sumar cruces donde existe, así que el corpus tenía más oportunidades de
cruzar que su propio denominador y la separación salía inflada por
disponibilidad, no por señal.

La causa no era Bitcoin. El muestreo del control era uniforme desde 2001,
mientras que el corpus se concentra en los 2020:

| Década | Control (antes) | Corpus |
| ------ | --------------: | -----: |
| 2000s  | 42% |  9% |
| 2010s  | 38% | 19% |
| 2020s  | 20% | **72%** |

La mediana del control caía en **2010** y la del corpus en **2022**: se estaba
comparando un evento reciente contra un día normal de otra década, con otro
régimen de volatilidad y con activos que ni existían.

**El arreglo** (`placebo.mts`): cada evento aporta sus propias fechas de
control, tomadas de su mismo periodo —el mismo año, ensanchando la ventana solo
si el veto por cercanía ha dejado ese año sin candidatas—. Después:

| | Control | Corpus |
| --- | ---: | ---: |
| 2020s | 68% | 72% |
| Cobertura de Bitcoin | **78%** | **78%** |
| Mediana | 2022-07-12 | 2022-09-26 |

El script imprime las dos medianas al terminar, para que el emparejamiento se
compruebe y no se suponga.

**Consecuencia incómoda: la línea base sube del 20% al 36,7%.** Un día normal de
los 2020 mueve el precio mucho más a menudo que uno de los 2000, y la cifra
anterior estaba midiendo la década equivocada. Con el denominador correcto, la
separación agregada del corpus cae de 22 a **10 puntos**, con un intervalo del
90% de [−8, 28] que incluye el cero: **el corpus entero, tomado en bloque,
apenas se distingue de un día cualquiera.** Lo que sí sobrevive es el patrón por
peldaño, que es lo que la curva usa —el 2/5 se queda por debajo de la base y el
4/5 y el 5/5 muy por encima—.

### La revisión de la cesta

Como la regla es «basta que uno cruce», la separación individual **no** es el
criterio para retirar un activo: lo que decide es la **aportación marginal**, es
decir cuánto cambia el criterio completo al quitarlo.

**Ahora mismo no hay ningún activo excluido**, y merece contarse por qué, porque
el camino equivocado parecía muy convincente. El 2026-09-03 se excluyó el Nasdaq
con esta prueba: quitarlo subía la separación de 22 a 27 puntos, la mejora salía
en el 96% de los remuestreos con un intervalo que no tocaba el cero, y encima
había un motivo estructural —correlaciona 0,82 con el S&P, o sea que es el mismo
índice de renta variable contado dos veces—. Sus únicos cruces en solitario del
control eran tres, y los tres de 2002 y 2003.

Esas tres fechas eran el problema, y no por el Nasdaq: estaban en el control
porque el muestreo no estaba emparejado por época. Al arreglarlo desaparecieron,
y con ellas toda la ventaja de quitarlo: **de +5 puntos a +0, en el 0% de los
remuestreos.** El Nasdaq volvió al veredicto el mismo día.

La lección queda escrita en el docstring de `ACTIVOS_SIN_VOTO`, que es donde la
buscará quien vuelva a plantearlo: **antes de culpar a un activo, comprobar que
el denominador es comparable.** Un control que no cubre las mismas épocas que el
corpus fabrica culpables.

El mecanismo para excluir un activo sigue implementado y probado, con la lista
vacía: se sigue midiendo y enseñando todo, y la ficha tiene una columna «Vota»
para que cualquier exclusión futura se vea en vez de quedar escondida.

**Lo que se sabe hoy de cada activo** (control emparejado, VIX al 25% y oro al
3,6%): ninguna retirada mejora el criterio de forma que aguante el remuestreo.
Quitar el **oro** lo empeora en **14 puntos** —es el que más aporta desde que se
le arregló el umbral— y quitar el **VIX**, en 9. La plata, el Nasdaq, el S&P y
el dólar no cambian nada; las mejoras aparentes de quitar el WTI o Bitcoin (+2
puntos) tienen intervalos que incluyen el cero. Con 60 fechas y 32 hechos no hay
muestra para retirar nada.

### La curva vigente

> Esta era la curva de `v7`, calculada con el arrastre al máximo que se retiró
> ese mismo día. La vigente es `v8-dominio-suelo-ruso` con regresión isotónica:
> ver «La curva degenerada: el problema no era la monotonía, era cómo se
> imponía».

Con `v7-corpus-anodino`, 44 hechos, los ocho activos, el control emparejado por
época, el VIX al 25% y el oro al 3,6%, línea base del **43,3%**:

| Tema | Peldaño LLM | n | P(mov) | Lift | → Final |
| ---- | ----------- | -: | -----: | ---: | ------: |
| guerra | 2/5 | 14 |  64% |  37% | 2/5 |
| guerra | 4/5 |  3 |  67% |  41% | **3/5** |
| guerra | 5/5 |  1 | 100% | 100% | 5/5 |
| fed_tesoro | 2/5 |  4 |  75% |  56% | 3/5 |
| fed_tesoro | 3/5 |  7 |  29% |   0% | 3/5 |
| fed_tesoro | 4/5 |  3 |  67% |  41% | **3/5** |
| fed_tesoro | 5/5 |  6 |  83% |  71% | **4/5** |

**El aviso de saturación ha dejado de saltar.** Es la primera vez desde que
existe la curva. Entre el arreglo del oro y la ampliación del corpus hubo un
turno en el que la curva subía la severidad en casi todos los peldaños; con los
doce hechos anodinos dentro, vuelve a corregir a la baja donde debe y a dejar
quieto lo demás.

**La fila que más dice es `fed_tesoro 3/5`**, que no existía antes y ahora tiene
n=7: son los seis FOMC de trámite y el IPC en línea. Su P(mov) es del **29%**,
por debajo de la línea base del 43,3%. Es decir, **una reunión rutinaria de la
Fed mueve el precio menos que un día cualquiera**. El lift sale a 0 y el peldaño
se queda en 3/5 en vez de subir.

Y por primera vez **un peldaño 5 se corrige a la baja**: `fed_tesoro 5/5` pasa a
4/5, con n=6.

Sigue sin poder aplicarse en producción: 4 de los 7 peldaños tienen menos de 5
casos, y `aplicarCurva` no está cableada al motor.

La curva se fuerza monótona: un peldaño más alto del LLM nunca puede acabar
dando uno final más bajo. Los peldaños que no aparecen se publican sin corregir,
que es lo correcto cuando no hay dato para juzgarlos.

**`guerra` ya no tiene ningún evento en el peldaño 3.** Los ocho que estaban ahí
—drones sobre Polonia, MiG-31 sobre Estonia, MH17, Su-24 de Turquía,
Balticconnector, Estlink 2, Przewodów y la doctrina nuclear de 2024— bajaron al
2 el 2026-09-02, y como grupo mueven el precio **menos** que una fecha al azar.

### La ficha de `/alertas/backtesting`

Enseña lo mismo que estos comandos, leyendo de `severity_events` y
`severity_event_moves` con la clave de servicio (las tablas llevan RLS sin
políticas: son de trabajo interno y no pertenecen a ningún usuario). Cinco
paneles: el corpus en cifras, la línea base, el día normal activo por activo,
qué mueve cada familia de suceso, y el detalle por tramo.

## Lo que se ha cambiado

**1. Los dos prompts se reescribieron con anclas medidas**
(`src/lib/alertas/clasificador.ts`). Cada peldaño lleva ahora precedentes reales
con su retorno del oro, del VIX y del S&P, y la instrucción es explícita:
*«severidad = efecto esperado en el precio, no gravedad humana»*. Se añadieron
reglas duras: un análisis nunca pasa de 2 aunque describa una guerra nuclear;
las víctimas civiles por sí solas no suben el peldaño; un hecho ya conocido
contado por otro medio conserva la severidad del hecho.

El 2026-09-02 se corrigió además el peldaño 3 de `guerra`, que agrupaba hechos
que no mueven el precio. Ahora exige **respuesta material con tamaño de
mercado** —intervención armada, corte de suministro que se note en el precio de
la energía, cierre de una ruta de uso general—, y se dice explícito que invocar
el artículo 4 no sube el peldaño y que un enlace bilateral (un cable, un
interconector) no llega aunque el corte sea real y dure meses.

**2. Las claves de evento pasan a un vocabulario cerrado.** El prompt ya no deja
al modelo inventar el slug: la forma es
`<tipo-de-hecho>-<lugar>-<AAAA-MM-DD>` con una lista fija de tipos
(`ataque-dron`, `incursion`, `sabotaje`, `fomc-decision`, `dato-ipc`…). El
ataque de Leipzig produce `ataque-dron-leipzig-2026-09-01` diga lo que diga el
titular, que es lo que hace funcionar el enfriamiento.

**3. Hay suelo de envío** (`src/lib/alertas/dedupe.ts`). La constante
`SEVERIDAD_MINIMA_POR_DEFECTO` vale 3 y se puede mover con
`ALERTAS_SEVERIDAD_MINIMA`. Por debajo del suelo `decidirEnvio` devuelve el
motivo `bajo-umbral`, y manda sobre todo lo demás: un hecho menor no suena
aunque sea nuevo y aunque quede cupo en la hora.

**4. Lo que no suena se sigue registrando** (`src/lib/alertas/motor.ts`). El
despacho silencioso guarda la fila en `alert_signals` con `aceptado_at` nulo y
`canal_detalle` diciendo por qué no salió. Sin ese registro no habría forma de
juzgar después si el suelo está bien puesto: solo se vería lo que pasó el
filtro.

**5. Hay grupo de control** (`scripts/calibracion/placebo.mts`, migración 027).
Sesenta fechas de sesión al azar con semilla fija, excluyendo las que caen a
menos de diez días de un evento del corpus: una fecha pegada a la invasión de
Ucrania no es un día corriente, mide la misma sacudida. Sin esto la curva subía
la severidad en vez de bajarla, que es lo contrario de lo que se buscaba.

## Herramientas

| Comando                          | Qué hace                                                          |
| -------------------------------- | ----------------------------------------------------------------- |
| `npm run calibracion:auditar`    | Distribución de severidades y titulares altos. Solo lee.           |
| `npm run calibracion:claves`     | Agrupa las claves de evento para ver duplicados del mismo hecho.   |
| `npm run calibracion:medir`      | Descarga históricos y mide el movimiento tras cada evento.         |
| `npm run calibracion:cargar`     | Sube corpus y mediciones a Supabase.                               |
| `npm run calibracion:placebo`    | Muestrea el grupo de control y lo carga. Borra el anterior.        |
| `npm run calibracion:replay`     | Reejecuta el clasificador sobre el corpus. Cuesta llamadas al LLM. |
| `npm run calibracion:comparar`   | Enfrenta dos versiones del prompt evento a evento.                 |
| `npm run calibracion:ajustar`    | Calcula y guarda la curva de traducción. Solo escribe la curva.    |
| `npm run calibracion:normalidad` | Perfil del día normal, activo por activo. Solo lee.                |

Dos gotchas que cuestan tiempo si no se saben:

- **`medir.mts` cachea los históricos** en `scratchpad/calibracion/precios/`
  porque Yahoo devuelve 429 con facilidad.
- **Editar `eventos.ts` no basta.** `cargar.mts` sube la severidad del JSON que
  dejó `medir.mts`, así que hay que volver a medir antes de cargar o se sube la
  etiqueta vieja sin que nada falle.

## El corpus deja de estar hecho solo de hechos importantes

El arreglo del oro destapó un sesgo que llevaba ahí desde el principio: **el
corpus solo contenía sucesos que fueron importantes**. Con un listón alto eso no
se notaba, pero al medir bien el movimiento salió a la luz — casi todos los
hechos movían el precio, y la curva pasó a *subir* la severidad en vez de
bajarla.

**Se añadieron doce hechos anodinos el 2026-09-03.** El corpus pasa de 32 a
**44**.

El criterio de selección es lo importante, y es fácil de hacer mal. **No** se
eligieron por no haber movido el precio: eso sería hacer trampa, porque el
desenlace es justo lo que se mide. Se eligieron por su **perfil antes del
desenlace** — sucesos que un clasificador puntúa alto: muertos en suelo OTAN,
drones sobre el Kremlin, decisiones programadas del FOMC. Lo que hicieran
después lo dijo la medición.

| Fecha | Hecho | El modelo da |
| ----- | ----- | -----------: |
| 2022-10-08 | Explosión en el puente de Kerch | descartado |
| 2022-11-15 | Misil en Przewodów, dos muertos en Polonia | 2/5 |
| 2023-05-03 | Drones sobre el Kremlin | descartado |
| 2023-05-22 | Incursión armada en Bélgorod | 2/5 |
| 2023-09-06 | Restos de dron ruso en Rumanía | 2/5 |
| 2023-09-20 | La Fed mantiene tipos | 2/5 |
| 2023-11-01 | La Fed mantiene tipos | 2/5 |
| 2024-01-31 | La Fed mantiene y descarta marzo | 3/5 |
| 2024-03-20 | La Fed mantiene, tres recortes en el dot plot | 3/5 |
| 2024-05-01 | La Fed mantiene y ralentiza el balance | 3/5 |
| 2024-06-12 | La Fed mantiene, mismo día que el IPC | 3/5 |
| 2024-08-14 | IPC de julio al 2,9%, mínimo de tres años | 3/5 |

**Przewodów es el ejemplar de la colección.** Dos muertos en suelo aliado,
reunión de urgencia del G7, el artículo 4 sobre la mesa: un titular de peldaño
5. En horas se supo que era un S-300 de la defensa aérea ucraniana. El modelo le
da 2/5 y el precio tampoco se enteró.

### Lo que cambia al medirlo

**Todas las separaciones bajan, y eso es la señal de que el corpus era el
problema**, no el instrumento:

| Activo | Separación con 32 | con 44 |
| ------ | ----------------: | -----: |
| WTI | +18 pts | +14 pts |
| VIX | +18 pts | +11 pts |
| Oro | +19 pts | +9 pts |
| Nasdaq | +12 pts | +7 pts |
| S&P 500 | +12 pts | +5 pts |

**Y sin embargo el criterio completo mejora.** Con el test de permutación —
barajar la etiqueta hecho/control y ver qué separación sale por azar— el
criterio pasa de **p=0,102 a p=0,028**. Con 32 hechos seleccionados no se
distinguía del ruido; con 44 honestos, sí. Es el resultado que más cuenta de
toda la ampliación: **un corpus sesgado infla las cifras individuales y hunde la
prueba de conjunto.**

### El 3,6% del oro, confirmado fuera de muestra

El umbral se eligió con los 32 hechos viejos. Medido contra el corpus de 44,
donde doce hechos no existían cuando se tomó la decisión, sigue ganando al 6%
por **+10 puntos [2, 20]**, mejorando en el **98%** de los remuestreos, y el
tramo llano sigue entre el 3,4% y el 3,8%. No era un artefacto.

### Un hallazgo lateral que se arregló el mismo día: el suelo ruso

De los seis hechos que el prompt sacaba de su dominio, cuatro eran ataques **en
territorio ruso**: Crimea, Kursk, el puente de Kerch y los drones del Kremlin. Y
sin embargo **Bélgorod, que es exactamente lo mismo, se juzgaba con un 2/5**.
Ver «El dominio no terminaba donde el prompt decía».

### El error medio sube de 0,14 a 0,29, y era de esperar

`v6` daba 0,14 porque las etiquetas del corpus se habían movido hacia donde
apuntaba el modelo: era una cifra tautológica, y este informe ya lo advertía.
Los doce hechos nuevos no pasaron por ese proceso, así que **0,29 es la primera
medida honesta** de la distancia entre el modelo y el analista.

## El dominio no terminaba donde el prompt decía

El corpus ampliado dejó a la vista que el clasificador descartaba cuatro ataques
en territorio ruso y en cambio juzgaba Bélgorod, que es el mismo tipo de hecho.

**El diagnóstico tenía dos capas.** La primera es que el prompt de verdad
omitía el suelo ruso: sus siete criterios de dominio hablaban todos de la OTAN.
La segunda explica a Bélgorod y es la interesante — uno de esos criterios,
«sabotaje de infraestructura crítica atribuido a un Estado», **no lleva
restricción geográfica**. El puente de Kerch encajaba en él literalmente y aun
así se descartaba. El modelo estaba leyendo la cabecera del prompt («conflicto
entre Rusia y la OTAN») como un filtro implícito de territorio, y lo aplicaba
unas veces sí y otras no.

**El arreglo, en `SISTEMA_GUERRA`:**

1. **Un criterio de dominio nuevo y acotado.** Escalada mayor en territorio ruso
   atribuida a un Estado o a fuerzas respaldadas por uno, cuando cruza una de
   cuatro barras: control de terreno, sede del poder o mando militar,
   infraestructura estratégica de tamaño nacional, o instalación nuclear. El
   goteo diario de drones sobre refinerías rusas queda explícitamente fuera —era
   el riesgo real de esta ampliación: inundar el canal con el ruido de fondo de
   la guerra.
2. **La ambigüedad geográfica, dicha en voz alta.** El dominio es el *conflicto*,
   y un conflicto escala por los dos lados de la línea. Que un hecho ocurra en
   suelo ruso no lo saca del dominio; lo que decide es si cambia la probabilidad
   de una respuesta militar.
3. **Anclas de severidad medidas, para que entrar no signifique inflar.** Kursk
   (oro +2,5%, VIX −51,0%), los drones del Kremlin (oro +1,1%, VIX +20,0%) y
   Bélgorod (oro −1,7%, VIX +23,8%) son **2**: tomar una ciudad rusa un día o
   hacer estallar drones sobre el Kremlin da titulares de peldaño 5 y precios de
   peldaño 2. Solo el cambio de control territorial llega al **4** (Crimea).
   Kerch es un **3**, y por la campaña de misiles del 10 de octubre que fue su
   respuesta material, no porque volar un puente sea espectacular.

### El resultado

| | `v7` | `v8-dominio-suelo-ruso` |
| --- | ---: | ---: |
| descartados | 6 | **2** |
| juzgados | 38 | **42** |
| error medio | 0,29 | **0,24** |

**Los cuatro recuperados aciertan el peldaño curado exacto**: Kursk 2/5, Crimea
4/5, Kerch 3/5, Kremlin 2/5. Cuatro de cuatro.

**Y los dos descartes que quedan son los correctos:** el 11-S y la invasión de
Irak, ambos del tramo `control_shocks`, que son shocks de otra naturaleza y
deben quedar fuera de un dominio Rusia-OTAN. Esto cierra de rebote un pendiente
antiguo —«vigilar el 11-S en producción»—, que estaba abierto porque el modelo
lo colaba estirando el criterio a un actor no estatal.

## La curva degenerada: el problema no era la monotonía, era cómo se imponía

Con `v8`, la curva de `fed_tesoro` publicaba un **4 diga lo que diga el modelo**
—incluido el peldaño `3/5`, cuyo lift medido era del **0%**— y la de `guerra`
mandaba a 5 todo lo que estuviera por encima de un peldaño de **n=1**.

**El mecanismo era `forzarMonotonia`.** La monotonía en sí hace falta: sin ella
un peldaño flaco invierte el orden y el sistema avisa más fuerte de lo pequeño
que de lo grande. El problema era **cómo** se imponía. Se recorría de menor a
mayor arrastrando el máximo visto, sobre el peldaño ya calculado, así que
cualquier peldaño alto se convertía en un **suelo** para todos los de encima sin
importar con cuántos casos se había medido.

Y el peldaño que disparaba el arrastre estaba inflado por el clasificador: las
seis reuniones «la Fed mantiene los tipos» son el mismo hecho y se repartían
entre el peldaño 2 (dos casos) y el 3 (cuatro casos) según la redacción del
titular. Las dos que cayeron en el 2 resultaron ser **justo las dos que movieron
el precio** —el hold hawkish del 20 de septiembre de 2023 (S&P −3,9%) y el giro
dovish del 1 de noviembre (S&P +4,4%)—, lo que dejó ese peldaño en un 80% que
era suerte del reparto.

### El arreglo: promediar en vez de arrastrar

Se sustituye por **regresión isotónica por bloques adyacentes** (*pool adjacent
violators*), **ponderada por número de casos** y aplicada a la probabilidad en
vez de al peldaño. Donde dos peldaños contiguos se contradicen, en lugar de
imponer el mayor se **funden en un bloque** y comparten la media ponderada: el
peldaño con más casos manda y el de n=1 aporta lo que pesa.

Aplicarla sobre la probabilidad hace innecesario un segundo paso de monotonía,
porque `liftSobreBase` y `peldanoDesdeProbabilidad` son las dos crecientes: una
entrada ordenada sale ordenada.

**Que dos peldaños se fundan es información, no una pérdida.** Dice que el
modelo no los distingue, y en `fed_tesoro` el 2 y el 3 son literalmente la misma
reunión de la Fed contada con otras palabras. La salida de `ajustar.mts` los
marca con un asterisco por eso.

### La curva vigente

`v8-dominio-suelo-ruso`, 44 hechos, línea base del **43,3%**:

| Tema | LLM | n | P(mov) | Isotónica | Lift | → Final |
| ---- | --- | -: | -----: | --------: | ---: | ------: |
| guerra | 2/5 | 16 |  63% |  63% |  34% | 2/5 |
| guerra | 3/5 |  1 | 100% | 80% \* |  65% | 4/5 |
| guerra | 4/5 |  4 |  75% | 80% \* |  65% | 4/5 |
| guerra | 5/5 |  1 | 100% | 100% | 100% | 5/5 |
| fed_tesoro | 2/5 |  5 |  80% | 45% \* |   4% | **1/5** |
| fed_tesoro | 3/5 |  6 |  17% | 45% \* |   4% | **1/5** |
| fed_tesoro | 4/5 |  3 |  67% |  67% |  41% | **3/5** |
| fed_tesoro | 5/5 |  6 |  83% |  83% |  71% | **4/5** |

\* peldaños fundidos.

**`fed_tesoro` vuelve a corregir a la baja en los cuatro peldaños**, que es la
dirección para la que existe todo esto. El bloque fundido del 2 y el 3 sale al
45% frente a una línea base del 43,3%: indistinguible de un día cualquiera, y
por eso baja a 1. El 4 baja a 3 y el 5 a 4.

En `guerra` el bloque fundido del 3 y el 4 lo sostiene un peldaño de **n=1**, que
aporta una quinta parte del peso. Es mucho mejor que antes —cuando ese mismo
n=1 mandaba a 5 los tres peldaños de encima— pero sigue siendo poca muestra.

**Lo que no arregla esto es el tamaño del corpus.** Siguen 4 de 8 peldaños con
menos de 5 casos y `aplicarCurva` sigue sin estar cableada al motor.

## El oro estaba midiendo con el listón de otro activo

El umbral del oro era del **6%**, y a ese listón solo cruzaban **4 de los 32
hechos** del corpus. La aportación marginal salía en **−2 puntos**: la cesta
separaba 16 puntos con el oro dentro y 18 sin él. El oro no es que no aportara,
es que **restaba**.

**Baja al 3,6% el 2026-09-03.** Cruzan 12 de 32, la separación del criterio sube
de 16 a **32 puntos** y el oro pasa a ser **el activo que más aporta de toda la
cesta**:

| Activo | Aportación marginal |
| ------ | ------------------: |
| **Oro (3,6%)** | **+14 pts** |
| VIX (25%) | +9 pts |
| Plata, Nasdaq, S&P, dólar | 0 pts |
| WTI, Bitcoin | −2 pts |

**Por qué el 3,6% y no el pico.** El barrido fino en pasos del 0,1% da su máximo
en el 2,9–3,3% con 33 puntos, un solo punto más que el 3,6%. Pero ahí la línea
base sube al 45–48%, acercándose a la saturación que estos umbrales existen para
evitar; en el 3,6% se queda en el 43%. Y el tramo entre el **3,4% y el 3,8%** da
32 puntos en cinco escalones seguidos: es la meseta más larga del barrido, que es
la señal de que el valor no está pegado al ruido de la muestra. Se coge su
centro, el mismo criterio con el que se eligió el 25% del VIX.

El remuestreo da **+15 puntos [4, 28]** frente al 6%, con el intervalo del 90%
**estrictamente positivo** — más de lo que pudo enseñar el VIX, cuyo intervalo
tocaba el cero.

**Lo que entra son seis hechos y solo dos fechas de control:**

| Fecha | Oro | Sev | Hecho |
| ----- | --: | --: | ----- |
| 2014-03-18 | +4,5% | 4 | Rusia se anexiona Crimea |
| 2024-11-18 | +5,6% | 2 | Cortados dos cables submarinos en el Báltico |
| 2023-10-08 | +5,5% | 2 | Balticconnector dañado |
| 2025-09-19 | +3,9% | 2 | Tres MiG-31 sobre Estonia; artículo 4 |
| 2024-11-19 | +3,8% | 2 | Rusia rebaja su doctrina nuclear |
| 2024-09-18 | +3,8% | 4 | Primer recorte del ciclo: la Fed baja 50 pb |

**Crimea es la comprobación que más tranquiliza**: era el caso que este mismo
informe citaba como el fallo más incómodo del sistema —movió su mercado y el
veredicto decía que no—. Ya cruza. Ninguna severidad cambia: las fija el
criterio del prompt, que pide respuesta material, no el veredicto de precio.

## Los otros cinco: por qué no se tocó ninguno

Buscar el mejor umbral de seis activos sobre una rejilla de once valores son
**66 pruebas sobre el mismo corpus de 32 hechos**. Eso encuentra mejoras aunque
no haya nada que encontrar, y es exactamente el error que ya se cometió una vez
al elegir estos umbrales en bloque.

Para medir cuánto regala la búsqueda se **barajó la etiqueta hecho/control** 600
veces y se repitió el barrido entero sobre cada barajada. Bajo la hipótesis nula
—hechos y días normales intercambiables— la mejor separación alcanzable es de
**13 puntos de mediana y 27 en el percentil 95**. Ese, y no el cero, es el listón.

| Activo | Mejor separación real | p-valor |
| ------ | --------------------: | ------: |
| **Oro** | **33 pts** | **0,000** |
| VIX (medido a posteriori) | 25 pts | 0,037 |
| Plata | 19 pts | 0,092 |
| WTI | 18 pts | 0,127 |
| Bitcoin | 18 pts | 0,128 |
| Nasdaq | 16 pts | 0,142 |
| S&P 500 | 16 pts | 0,183 |

Solo el oro pasa el listón con holgura. Los cinco restantes se quedan dentro del
ruido: sus mejores candidatos son indistinguibles de lo que produce barajar las
etiquetas. **Se quedan como están.**

Dos comprobaciones que conviene tener a mano:

- **El VIX, medido con la misma vara a posteriori, aguanta** (p=0,037). El
  cambio del 25% no fue un artefacto de la búsqueda.
- **El criterio actual sin barrer nada da 16 puntos con p=0,102.** Es decir: el
  corpus en bloque apenas se distingue de un día cualquiera, que es lo que ya
  decía el apartado del denominador. Lo que sostiene la curva es el patrón por
  peldaño, no la separación agregada.

Quien vuelva a barrer estos umbrales: hágalo con esta corrección puesta. Sin
ella, cualquiera de los cinco parecerá mejorable.

## El dólar y el límite de la regla del OR

El perfil del día normal dejó al dólar señalado: **percentil 100**, cero cruces
en las 60 fechas de control, solo 2 de los 32 hechos, y una aportación marginal
de **0 puntos** al criterio completo. La lectura obvia era que el umbral del 3%
estaba demasiado alto, igual que el del VIX.

**El umbral está alto, pero bajarlo empeora las cosas, y la razón enseña algo
sobre la regla más que sobre el dólar.**

Lo primero que apareció al mirarlo de cerca es que el dólar no es un activo
mudo. Ordenando los 32 hechos contra las 60 fechas de control —sin umbral
ninguno, solo comparando magnitudes— **es el que mejor separa de toda la
cesta**:

| Activo | AUC | Cobertura |
| ------ | --: | --------- |
| **Dólar** | **0,666** | 32/32 y 60/60 |
| VIX | 0,639 | 32/32 y 60/60 |
| S&P 500 | 0,610 | 32/32 y 60/60 |
| Oro | 0,604 | 32/32 y 60/60 |
| Plata | 0,603 | 32/32 y 60/60 |
| WTI | 0,597 | 32/32 y 60/60 |
| Bitcoin | 0,586 | 25/32 y 47/60 |
| Nasdaq | 0,583 | 32/32 y 60/60 |

El AUC es la probabilidad de que un hecho del corpus mueva el activo más que una
fecha de control cogida al azar. 0,50 sería indistinguible; el dólar da **0,666,
con intervalo del 90% en [0,560, 0,769]**, que no toca el 0,50.

**Entonces, ¿por qué no aporta nada?** Porque su señal no está en la cola. La
mediana del dólar en un hecho curado es del **1,29%** y en un día de control del
**0,99%**: la diferencia está en el centro de la distribución. Y la regla es un
OR —basta que un activo cruce—, que solo sabe aprovechar activos cuya señal esté
en el extremo. Bajar el umbral hasta donde el dólar tiene algo que decir arrastra
al control con él:

| Umbral | Curados que añade | Controles que añade | Neto |
| -----: | ----------------: | ------------------: | ---: |
| 3,00% (actual) | 0/32 | 0/60 | 0 pts |
| 2,00% | 0/32 | 3/60 | −5 pts |
| 1,50% | 2/32 | 6/60 | −4 pts |
| 1,25% | 7/32 | 10/60 | +5 pts |
| 1,00% | 9/32 | 17/60 | −0 pts |

«Añade» son las filas que el dólar activa y que ningún otro activo de la cesta
activaba ya. En todos los niveles menos uno, el dólar mete más días normales que
hechos.

**El único punto positivo, el 1,25%, no aguanta el examen** —y falla justo por
los dos criterios con los que se eligió el umbral del VIX horas antes:

- **Satura la línea base.** Al 1,25% sube al **57%**, peor que el 53% que
  descartó al VIX en el 12,5%. Con un día cualquiera moviéndose más de la mitad
  de las veces, «pasó algo» deja de distinguir.
- **No hay meseta.** El barrido fino en pasos del 0,05% entre el 1,05% y el
  1,25% da 23, 20, 20, 25 y 18 puntos: una sierra, no un tramo estable. Su
  intervalo del 90% es **[−9, 20]** y contiene el cero holgadamente.

**Decisión: el dólar se queda en el 3%.** Es un umbral que no hace nada, pero
todas las alternativas hacen daño, y un umbral inofensivo es mejor que uno que
mete ruido. Se documenta en `UMBRAL_MATERIAL` para que el próximo que vea el
percentil 100 no repita el barrido.

**Lo que sí queda apuntado** es que el dólar es el caso que enseña el techo de
la regla del OR: es el activo con más información de la cesta y el que esta
regla peor aprovecha. Si algún día se sustituye por algo que cuente **cuántos**
activos cruzan, o que puntúe la magnitud en vez de contar cruces, el dólar es el
primero que hay que volver a mirar.

## Pendiente

- **El corpus sigue siendo pequeño.** Cinco de los siete peldaños de la curva
  tienen menos de 5 casos, y con esa muestra la proporción solo puede valer unos
  pocos valores: describe el sorteo más que el fenómeno. `ajustar.mts` lo avisa
  solo. Ampliar da menos de lo que parece: el clasificador concentra sus
  respuestas en el 2 y el 5, así que para llenar los huecos hacen falta hechos
  que **el modelo** puntúe ahí, no que lo merezcan.
- ~~**La cobertura asimétrica de Bitcoin**~~ — **corregida el 2026-09-03**
  emparejando el control por época: pasa de 40%/78% a 78%/78%.
- ~~**Revisar la cesta de activos**~~ — **revisada el 2026-09-03**: con el
  control ya emparejado, **ninguna retirada aguanta el remuestreo** y la cesta
  se queda con los ocho. Queda abierto:
  - ~~**El umbral del VIX**~~ — **corregido el 2026-09-03**: del 40% al 25%. Se
    comprobó de paso que `extremo` mide mejor que `retorno` en todo el barrido,
    así que la forma de medir no era el problema.
  - ~~**El umbral del dólar**~~ — **revisado el 2026-09-03 y confirmado en el
    3%**, por un motivo que no era el que parecía. Ver la sección «El dólar y el
    límite de la regla del OR».
  - ~~**Los seis umbrales restantes**~~ — **revisados el 2026-09-03**. Solo se
    movió el **oro**, del 6% al 3,6%. La plata, Bitcoin, el WTI, el Nasdaq y el
    S&P se quedan como estaban: sus mejores candidatos caen dentro de lo que la
    propia búsqueda regala por azar. Ver «Los otros cinco: por qué no se tocó
    ninguno».
  - **Falta el gas europeo**, que es por lo que Nord Stream sale como «no movió»
    pese a haber movido su mercado.
- ~~**Revisar los umbrales**~~ — **los ocho revisados uno por uno el
  2026-09-03**. Se eligieron en bloque comparando siete criterios sobre los
  mismos 60 días de control y 27 eventos, y esa era su debilidad. Ahora cada uno
  tiene su barrido y su prueba de significación. Lo que queda no es revisarlos
  otra vez, es **ampliar el corpus**: con 32 hechos, el listón que impone la
  corrección por búsqueda múltiple deja fuera casi cualquier ajuste.
- **El error medio ya no sirve para juzgar un cambio de prompt.** Cayó a 0,14
  con `v6`, pero las etiquetas del corpus se movieron hacia donde apuntaba el
  modelo, así que parte de esa mejora es tautológica. La evidencia independiente
  es la curva, que se calcula con el precio y no con la etiqueta.
- **El clasificador no es determinista.** Con `temperature: 0.1`, la rebaja de
  Moody's salió 5/5 en `v5` y 4/5 en `v6` sin que `SISTEMA_MACRO` cambiara. Una
  diferencia de un peldaño entre versiones puede ser ruido de muestreo.
- **Medir el efecto en producción.** La comparación honesta es volver a pasar
  `calibracion:auditar` tras una semana con el prompt nuevo y ver si el
  porcentaje de peldaños 4-5 baja del 60,9%.
- **Vigilar el 11-S en producción.** El criterio de relevancia dice «ataque
  atribuido a un Estado contra ciudadanos o territorio de la OTAN, ocurra donde
  ocurra», y el modelo lo estiró para dejar pasar un atentado de un actor **no**
  estatal. Para el corpus está bien; en producción abre la puerta a que
  cualquier atentado entre en un canal pensado para Rusia-OTAN.
- **GDELT sigue inalcanzable desde el VPS** (HTTP 000), así que el corpus se
  amplía a mano con verificación por búsqueda, no por descarga masiva.
