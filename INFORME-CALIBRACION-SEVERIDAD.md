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
corriente del umbral de un evento. Sobre 60 fechas de control y 32 hechos:

| Activo | Umbral | Mediana normal | p90 | Máx | Cruza sin noticia | Cruza con noticia | Separación |
| ------ | -----: | -------------: | --: | --: | ----------------: | ----------------: | ---------: |
| S&P 500 |  5% | 2,1% |  4,1% | 11,6% | 2/60 | 8/32 | **+22 pts** |
| WTI     | 12% | 4,7% |  9,8% | 31,4% | 3/60 | 8/32 | **+20 pts** |
| Bitcoin | 16% | 7,0% | 16,1% | 20,9% | 3/24 | 7/25 | +16 pts |
| Nasdaq  |  6% | 2,7% |  5,9% |  9,3% | 6/60 | 8/32 | +15 pts |
| Plata   | 10% | 3,2% |  6,8% |  9,6% | 0/60 | 4/32 | +13 pts |
| Oro     |  6% | 2,1% |  4,0% |  6,8% | 2/60 | 4/32 | +9 pts |
| VIX     | 40% | 9,9% | 26,0% | 50,8% | 4/60 | 5/32 | +9 pts |
| Dólar   |  3% | 1,2% |  1,9% |  3,1% | 1/60 | 2/32 | +5 pts |

«Separación» es cuánto más cruza el umbral con noticia que sin ella. Se compara
en tasa y no en cuenta porque los grupos no tienen el mismo tamaño.

**Lo que enseña esta tabla es incómodo: el oro y el VIX son los que peor
distinguen** (+9 pts cada uno), y son justo los dos que el prompt cita en todos
sus precedentes. El VIX llega a subir un 50,8% en una fecha sin nada detrás,
por encima de su propio umbral del 40%. El que mejor separa es el S&P 500, que
no aparece en ningún ancla del prompt.

La columna «umbral/mediana» dice lo raro que es que un activo salte por
casualidad: entre ×2,2 (Nasdaq) y ×4,0 (VIX). Ninguno llega a ×5, lo que
significa que **la cesta entera está calibrada apretada** y que un puñado de
fechas al azar cruzan igual.

### Lo que la cesta no ve

Dos de los eventos más grandes del corpus salen como «no movió»: el sabotaje
del Nord Stream y la anexión de Crimea. Su efecto fue sobre el gas europeo y el
trigo, que no están entre los ocho activos medidos. Se quedan en severidad 4 a
propósito: el efecto existió y lo que falla es el instrumento.

En sentido contrario, `BTC-USD` cruza su umbral en dos casos donde no tiene
nada que ver con el hecho: Skripal (−18,7%, invierno cripto de 2018) y Kursk
(+16,1%, con el VIX cayendo un 51%).

### La curva vigente

Con `v6-corpus-reetiquetado`, línea base del 25%:

| Tema | Peldaño LLM | n | P(mov) | Lift | → Final |
| ---- | ----------- | -: | -----: | ---: | ------: |
| guerra | 2/5 | 11 |  18% |   0% | **1/5** |
| guerra | 4/5 |  3 |  67% |  56% | 3/5 |
| guerra | 5/5 |  1 | 100% | 100% | 5/5 |
| fed_tesoro | 2/5 | 3 |  67% |  56% | 3/5 |
| fed_tesoro | 3/5 | 1 |   0% |   0% | 3/5 |
| fed_tesoro | 4/5 | 4 |  25% |   0% | 3/5 |
| fed_tesoro | 5/5 | 5 | 100% | 100% | 5/5 |

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

## Pendiente

- **El corpus sigue siendo pequeño.** Cinco de los siete peldaños de la curva
  tienen menos de 5 casos, y con esa muestra la proporción solo puede valer unos
  pocos valores: describe el sorteo más que el fenómeno. `ajustar.mts` lo avisa
  solo. Ampliar da menos de lo que parece: el clasificador concentra sus
  respuestas en el 2 y el 5, así que para llenar los huecos hacen falta hechos
  que **el modelo** puntúe ahí, no que lo merezcan.
- **Revisar la cesta de activos.** El oro y el VIX apenas separan (+9 pts), y
  son los que el prompt usa como ancla en todos sus precedentes. Bitcoin cruza
  su umbral por motivos suyos. Y ni el gas europeo ni el trigo están, que es por
  lo que Nord Stream y Crimea salen como «no movió».
- **Revisar los umbrales.** Se eligieron comparando siete criterios sobre los
  mismos 60 días de control y 27 eventos, así que parte de su ventaja es
  sobreajuste; tres de los siete quedaron empatados dentro del ruido. El caso a
  mirar es el MH17: su VIX llegó al +39,8% contra un umbral del 40%.
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
