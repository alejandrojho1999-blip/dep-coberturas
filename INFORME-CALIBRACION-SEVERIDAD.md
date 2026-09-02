# Recalibración de la severidad del clasificador

*2026-09-02*

El sistema de alerta temprana llevaba desde el 31 de agosto marcando casi todo
como grave. Este informe recoge la medida del problema, lo que dice el mercado
sobre cuánto vale de verdad cada tipo de suceso, y qué se ha cambiado.

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

## Lo que se ha cambiado

**1. Los dos prompts se reescribieron con anclas medidas**
(`src/lib/alertas/clasificador.ts`). Cada peldaño lleva ahora precedentes reales
con su retorno del oro, del VIX y del S&P, y la instrucción es explícita:
*«severidad = efecto esperado en el precio, no gravedad humana»*. Se añadieron
reglas duras: un análisis nunca pasa de 2 aunque describa una guerra nuclear;
las víctimas civiles por sí solas no suben el peldaño; un hecho ya conocido
contado por otro medio conserva la severidad del hecho.

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

## Herramientas nuevas

| Comando                       | Qué hace                                                        |
| ----------------------------- | --------------------------------------------------------------- |
| `npm run calibracion:auditar` | Distribución de severidades y titulares altos. Solo lee.          |
| `npm run calibracion:claves`  | Agrupa las claves de evento para ver duplicados del mismo hecho.  |
| `npm run calibracion:medir`   | Descarga históricos y mide el movimiento tras cada evento.        |
| `npm run calibracion:cargar`  | Sube corpus y mediciones a Supabase. Requiere la migración 025.   |

`medir.mts` cachea los históricos en `scratchpad/calibracion/precios/` porque
Yahoo devuelve 429 con facilidad; sin la caché cada reejecución vuelve a pedirlo
todo.

## Pendiente

- **Aplicar la migración `025_calibracion_severidad.sql`.** Crea
  `severity_events`, `severity_event_moves`, `severity_calibration` y
  `severity_llm_replay`. El MCP de Supabase conectado no tiene este proyecto, así
  que hay que aplicarla a mano desde el panel. Hasta entonces
  `npm run calibracion:cargar` falla, y falla diciendo exactamente eso.
- **La curva numérica de calibración.** `severity_calibration` está creada pero
  vacía: traducir `severidad_llm → P(movimiento material) → severidad_final`
  necesita antes reejecutar el prompt nuevo sobre el corpus y guardar el
  resultado en `severity_llm_replay`. Con 27 eventos la curva sería ruido; el
  corpus tiene que crecer primero.
- **Medir el efecto del cambio.** La comparación honesta es volver a pasar
  `calibracion:auditar` dentro de una semana de funcionamiento con el prompt
  nuevo y ver si el porcentaje de peldaños 4-5 baja del 60,9%.
- **GDELT sigue inalcanzable desde el VPS** (HTTP 000), así que el corpus se
  amplía a mano con verificación por búsqueda, no por descarga masiva.
