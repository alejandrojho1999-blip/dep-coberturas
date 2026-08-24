# Emporium Quant Desk — guion de locución

**De la idea al capital gestionado** · Luis Riofrío · Emporium Quality Funds

31 diapositivas · duración estimada leyendo a ritmo natural: **21 minutos** (sin contar pausas ni preguntas).

Cada entrada trae lo que se dice, la transición a la siguiente lámina y la fuente de las cifras que
aparecen en pantalla, por si alguien las pregunta en el momento.

> Generado por `presentacion/build.js`. Si cambia una diapositiva, se regenera este guion con ella:
> `node presentacion/build.js`.

---

## 01 · Portada

*≈ 25 segundos*

Buenos días. Lo que voy a presentar no es una idea de inversión: es una mesa de trading que ya está construida y funcionando. Se llama Emporium Quant Desk y tiene cinco operadores digitales. En los próximos veinte minutos veréis cómo está hecha por dentro, cómo piensa cada operador y, sobre todo, qué se ha hecho para saber si funciona o no.

**Transición.** Empiezo por la idea, que cabe en una frase.

**Fuente de las cifras.** Nombre acordado con el autor; disclaimer replicado de los documentos internos de agosto de 2026.

---

## 02 · La idea en una frase

*≈ 23 segundos*

La tesis es sencilla: un operador humano se cansa, se enamora de una posición y cambia de criterio a mitad de camino. Estos cinco no. Aplican el mismo filtro el lunes y el viernes, y dejan rastro de cada decisión. Fijaos en el último dato: cero decisiones discrecionales. Es el corazón de todo lo que viene después.

**Transición.** Veamos quiénes son.

**Fuente de las cifras.** Cifras de src/lib/estrategias/cartera.json (3.838 operaciones) y del conjunto de tests Vitest del repositorio (419).

---

## 03 · Organigrama de la mesa

*≈ 29 segundos*

Tres mesas. Acciones, con Peter y Small, cien mil dólares. Opciones, con Gamma y Theta, y aquí hay una separación importante: Gamma compra opciones y le basta con cien mil, mientras que Theta vende prima y necesita colateral, por eso tiene trescientos mil. Y la mesa de futuros, cincuenta mil dólares para un portafolio de seis estrategias. No comparten bolsillo: si una mesa se equivoca, no se lleva por delante a las otras.

**Transición.** Un vistazo a qué hace exactamente cada uno.

**Fuente de las cifras.** src/lib/portafolios/config.ts (CAPITAL_ACCIONES, CAPITAL_OPCIONES_LARGAS, CAPITAL_OPCIONES_CORTAS) y MARCO_COMUN de catalogo.ts (cuenta de $50.000).

---

## 04 · La ficha de cada operador

*≈ 34 segundos*

Cuatro fichas. Peter mira 443 grandes compañías y les exige los seis criterios completos. Small mira 307 pequeñas y se conforma con cuatro de seis, porque en small caps exigir seis vacía la lista. Gamma no tiene universo propio: trabaja sobre lo que Peter y Small ya han aprobado, es decir, la mesa de opciones se apoya en el trabajo de la mesa de acciones. Y Theta es el único que no busca dirección: busca prima cara, con volatilidad por encima del treinta por ciento.

**Transición.** Antes de entrar en el detalle, conviene decir qué no hacen.

**Fuente de las cifras.** Umbrales verificados en src/lib/peter-lynch/screener.ts y en los filtros de AgenteGamma.tsx / AgenteTheta.tsx.

---

## 05 · Lo que no hacen

*≈ 30 segundos*

Igual de importante que lo que hacen. Ninguno ejecuta órdenes ni tiene credenciales del bróker: la separación es física. Ninguno decide cuánto arriesgar, eso está escrito en configuración. Y el último punto es el que más me importa: si el mercado no da un precio real de entrada, la recomendación se cae entera. Preferimos perder una oportunidad a registrar un precio inventado, porque un precio inventado contamina para siempre el histórico con el que luego mides.

**Transición.** Vamos al cómo. Primero, la arquitectura.

**Fuente de las cifras.** src/lib/portafolios/config.ts (TICKET_ACCIONES, CONTRATOS_POR_SENAL); guarda de precio nulo en AgentePeter.tsx y AgenteGamma.tsx; «solo largos» documentado en catalogo.ts.

---

## 06 · ¿Monolito o microservicios?

*≈ 32 segundos*

Me lo preguntan siempre, así que lo contesto de frente. Esto es un monolito modular: una sola aplicación Next.js donde conviven la interfaz, las treinta y ocho rutas de API y toda la lógica. Y hay exactamente un servicio aparte, en Python, para la parte de inferencia causal, porque esa parte necesita librerías científicas que no existen en JavaScript. No son microservicios. Un equipo de una persona paga todos los costes de los microservicios y no recibe ninguno de sus beneficios.

**Transición.** Así se ve el recorrido de una petición.

**Fuente de las cifras.** render.yaml (dos servicios), next.config.ts, inventario de 38 route handlers y ausencia de server actions verificada por grep.

---

## 07 · El recorrido de una decisión

*≈ 32 segundos*

De izquierda a derecha. El navegador pide algo, un proxy comprueba que la sesión es válida, la ruta de API orquesta y el núcleo calcula. Quiero subrayar la última caja: las rutas de API no calculan nada, solo mueven datos. Todo el criterio vive en unos ochenta módulos puros, y por eso se pueden poner a prueba de forma automática. Abajo, las tres fuentes externas y los dos destinos: la base de datos y la puerta al servicio Python.

**Transición.** Y esto importa porque determina qué se puede verificar.

**Fuente de las cifras.** src/proxy.ts, inventario de route handlers, src/lib (~80 módulos), supabase/migrations (18), gateway /api/ergos-quant/[...path].

---

## 08 · Dónde corre la lógica

*≈ 30 segundos*

Este es el motivo por el que el sistema es auditable. Todo lo que decide está en funciones puras: no tocan la red ni la base de datos, así que puedo ejecutarlas miles de veces y comprobar que dan lo que deben. Cuatrocientas diecinueve pruebas cubren la valoración de opciones, los niveles de salida, la liquidación al vencimiento y las métricas de cartera. Lo que sale al mundo exterior queda en una capa fina y separada.

**Transición.** Veamos dónde vive todo esto.

**Fuente de las cifras.** Recuento de route handlers y ficheros de src/lib; 419 casos en 31 ficheros de test (Vitest).

---

## 09 · Dónde vive y quién lo despierta

*≈ 36 segundos*

Cuatro piezas. Supabase guarda los datos y controla el acceso, con seguridad a nivel de fila: si alguien esquiva la comprobación de la aplicación, la base de datos sigue diciendo que no. GitHub guarda el código y además hace de reloj. Render levanta los dos servicios. Y Vercel publica el panel. El detalle de abajo me gusta contarlo porque resume la filosofía: necesitábamos vigilar las opciones cada media hora, el plan gratuito solo daba una vez al día, y se resolvió moviendo el reloj a GitHub. Sin añadir un euro.

**Transición.** Y todo esto está construido sobre software libre.

**Fuente de las cifras.** .github/workflows/review-exits.yml, render.yaml, supabase/migrations, políticas RLS de las migraciones 016 y 018.

---

## 10 · Construido sobre software libre

*≈ 33 segundos*

Todo el material de base es abierto y gratuito: Next, React, las librerías de datos, el ecosistema científico de Python y las herramientas de calidad. Cero coste de licencias. Pero fijaos en el recuadro de abajo, porque es una decisión deliberada: el modelo de valoración de opciones no se importó de ninguna librería, está escrito a mano. Es la pieza de la que cuelgan todas las decisiones de Gamma y Theta. De eso quería tener el control y poder enseñar la prueba.

**Transición.** Ya sabemos dónde vive. Ahora, cómo piensa.

**Fuente de las cifras.** package.json y package-lock.json (versiones exactas), requirements.txt del servicio Python, src/lib/options/blackScholes.ts.

---

## 11 · El embudo común

*≈ 37 segundos*

Los cuatro agentes comparten este esqueleto de seis pasos. Empiezan por revisar lo que ya tienen abierto, antes de mirar nada nuevo. Después aplican su filtro propio, una proyección a treinta días, un chequeo de momentum, una confirmación con lenguaje y, si sobrevive, el alta registrada. La regla clave está en el subtítulo: cada paso descarta y ningún paso rescata. Y en la columna de la derecha, algo que conviene decir en voz alta: la mayoría de las ejecuciones no producen ninguna recomendación. Eso no es un fallo, es el filtro funcionando.

**Transición.** Veámoslo aplicado, empezando por Peter.

**Fuente de las cifras.** Estructura común de run() en AgentePeter.tsx, AgenteSmall.tsx, AgenteGamma.tsx y AgenteTheta.tsx.

---

## 12 · Agente Peter

*≈ 42 segundos*

Peter recorre 443 grandes compañías y les exige los seis criterios completos. Los umbrales están a la vista, y en la columna de la derecha he puesto qué evita cada uno, que es lo que de verdad importa: el PEG evita el crecimiento caro disfrazado de calidad, la deuda neta evita empresas que solo existen mientras haya crédito barato. Pero cumplir fundamentales no basta: además exige que la proyección a treinta días sea de al menos un dos por ciento y que dos de tres señales de momentum acompañen. Y la venta es igual de automática: si fallan dos de las tres condiciones, cierra.

**Transición.** Small es el mismo motor, con la vara a otra altura.

**Fuente de las cifras.** src/lib/peter-lynch/screener.ts (LARGE_CAP_OPTIONS), AgentePeter.tsx (corte 6/6, failCount ≥ 2), /api/agentes/forecast y /momentum.

---

## 13 · Agente Small

*≈ 42 segundos*

Small es el mismo motor con la vara a otra altura, y quiero ser explícito en por qué. Una empresa pequeña rara vez es barata, poco endeudada y de alto crecimiento a la vez; con el listón de Peter, el filtro devuelve cero candidatos casi siempre. Así que se baja: PEG uno y medio en lugar de dos, cuatro criterios de seis en lugar de seis. Eso tiene un coste, más falsos positivos, y se compensa por el otro lado: el momentum, la proyección y la convicción mínima son idénticos, y el ticket es el mismo. Relajamos el filtro, nunca el tamaño de la apuesta.

**Transición.** Pasamos a la mesa de opciones.

**Fuente de las cifras.** src/lib/peter-lynch/screener.ts (SMALL_CAP_OPTIONS), AgenteSmall.tsx (corte ≥ 4/6), src/lib/agentes/types.ts.

---

## 14 · Agente Gamma

*≈ 41 segundos*

Gamma es el más interesante en cuanto a diseño, porque no tiene universo propio: trabaja sobre lo que Peter y Small ya han aprobado. La mesa de opciones se apoya en el trabajo de la mesa de acciones. Después decide dirección, y fijaos en la zona muerta: si la proyección está entre menos tres y más dos por ciento, no hace nada. Sin convicción no se paga prima. Luego elige el contrato con una delta de entre treinta y sesenta y cinco: ni lotería barata ni una acción disfrazada. Y el objetivo y el stop se fijan al abrir, no se negocian después.

**Transición.** Theta juega al otro lado de la mesa.

**Fuente de las cifras.** AgenteGamma.tsx (universo desde picks vivos, umbrales de dirección y filtro de calidad), src/lib/options/{analyzer,yahoo-options,exit-levels}.ts.

---

## 15 · Agente Theta

*≈ 40 segundos*

Theta está al otro lado de la mesa: no apuesta por una dirección, vende prima y deja que el tiempo trabaje. Su riesgo es asimétrico, cobra poco muchas veces y puede perder mucho una vez, y por eso su listón es más alto: puntuación sesenta frente a los cincuenta de Gamma. Exige volatilidad por encima del treinta por ciento, porque vender prima barata es asumir riesgo sin cobrarlo. Y tiene un filtro de seguridad que no pretende acertar la dirección: solo se niega a vender una put si se anticipa una caída fuerte. Es una red, no una predicción.

**Transición.** Detrás de esos filtros hay un motor de puntuación. Merece un minuto.

**Fuente de las cifras.** AgenteTheta.tsx (36 subyacentes, filtros IV/DTE/delta/score, umbrales de seguridad), src/lib/options/exit-levels.ts.

---

## 16 · Cómo se puntúa una opción

*≈ 47 segundos*

Aquí está el motor que hay detrás de Gamma y Theta. Todo contrato parte de cincuenta puntos y se mueve según seis factores. En rojo, lo que resta: elegir el tipo equivocado son cuarenta y cinco puntos, la falta de liquidez veintiocho. En azul, lo que suma. Y las dos tarjetas de la derecha son las importantes. La primera: el sistema compara la prima que pide el mercado con la que dice su propio modelo, y penaliza comprar caro o vender barato. La segunda es un veto: si de un contrato no se puede salir, su puntuación queda limitada a cuarenta por bueno que sea todo lo demás. Un contrato ilíquido no es una oportunidad, es una trampa.

**Transición.** Y una vez abierta la posición, ¿quién la vigila?

**Fuente de las cifras.** src/lib/options/strategy-scoring.ts (base 50 y todos los deltas), src/lib/options/pricing.ts (umbrales 0,88 y 1,15).

---

## 17 · Qué pasa después de recomendar

*≈ 41 segundos*

Cuatro momentos. Alta, con precio real y sin duplicar posiciones. Vigilancia cada treinta minutos durante la sesión, cotizando por el punto medio de la horquilla, no por el último cruce, que puede ser de hace horas. Salida por objetivo o stop. Y liquidación al vencimiento contra el cierre real del subyacente. Ese último punto lo destaco porque una versión anterior daba por bueno un más o menos cien por cien fijo, y esa cifra falsa se habría propagado a todas las estadísticas de la cartera. Se detectó y se corrigió. Este tipo de errores son los que separan un prototipo de una mesa.

**Transición.** Y ahora la pregunta que me haríais vosotros.

**Fuente de las cifras.** src/lib/options/{review-exits,exit-review-core,settle-picks,quote-contracts}.ts; dedup en /api/agentes/picks; cron cada 30 min en GitHub Actions.

---

## 18 · Por qué no hay backtest en los agentes

*≈ 44 segundos*

Aquí viene la parte incómoda, y prefiero decirla yo antes de que me la preguntéis. Estos cuatro agentes no tienen backtest. Y no es una tarea pendiente, es una decisión. Dos razones. La primera: la fuente devuelve los fundamentales de hoy, no los de 2019. Simular el filtro sobre 2019 con datos de hoy es elegir empresas sabiendo ya cómo acabó la historia. La segunda: la lista de valores son los que están en el índice hoy; los que quebraron no aparecen. Un backtest así no daría un resultado dudoso, daría un resultado espectacular y falso. Y una cifra falsa con la que decidir es peor que no tener cifra.

**Transición.** Entonces, ¿sobre qué se apoya la confianza?

**Fuente de las cifras.** PROGRESS.md, sección «Los agentes de acciones NO tienen backtest», y los avisos en las fichas de los cuatro agentes en la propia aplicación.

---

## 19 · Por qué confiarles dinero

*≈ 47 segundos*

Si no hay backtest, ¿sobre qué se apoya la confianza? Sobre seis cosas. El criterio está escrito antes de ver resultados y no se retoca después para que el número quede bonito. No hay discrecionalidad: mismo dato, misma decisión, en calma o en pánico. El precio de entrada siempre es real. Cada decisión deja rastro. El riesgo está acotado por diseño, con capital separado y ticket fijo. Y la salida es automática, por deterioro objetivo, no por aguantar a que se recupere. La frase de abajo es la propuesta entera: no os digo que esto gana un tanto por ciento. Os digo aquí está el criterio, aquí está el registro y aquí está lo que todavía no sabemos.

**Transición.** Cambio de mesa. Los futuros sí se pueden medir, y se han medido.

**Fuente de las cifras.** Síntesis de las reglas verificadas en el código de los cuatro agentes y en src/lib/portafolios/config.ts.

---

## 20 · Las cinco fases

*≈ 52 segundos*

Cambiamos de mesa. En futuros sí hay histórico limpio de precios, así que aquí sí se puede medir de verdad, y se mide con este protocolo de cinco fases. La A pregunta si el parámetro central es la mejor elección o solo una elección. La B mueve los parámetros alrededor: si el vecino de al lado se derrumba, el resultado era un accidente. La C ejecuta sobre historia que nunca se usó. La D parte la historia en bloques para ver si depende de una sola época. Y la E la pone a operar en tiempo real sin dinero. Pero la regla de verdad está abajo: el listón se escribe antes de mirar el resultado. Si se fija después, aquello deja de ser una prueba y pasa a ser una justificación.

**Transición.** Conviene precisar tres términos que se confunden.

**Fuente de las cifras.** Cabeceras de las seis estrategias en public/estrategias/code/*.cs; MARCO_COMUN de catalogo.ts.

---

## 21 · Tres términos que se confunden

*≈ 49 segundos*

Tres definiciones rápidas. Dentro de muestra es el tramo donde se eligen los parámetros; ahí todo se ve bien porque es donde se ha buscado, y ningún resultado de esa fase demuestra nada. Fuera de muestra es el tramo apartado y no tocado: ese es el único juez. Y el walk-forward repite el ciclo deslizando una ventana. Abajo a la izquierda, un comentario literal del código: cuarta vez que el candidato del dentro-de-muestra muere en el fuera-de-muestra. Cuatro veces. Y a la derecha, algo igual de importante: hay un caso donde el walk-forward no era aplicable, se dijo por escrito y se usó otro método. Aplicar una técnica que no encaja y presentar su resultado sería el error más caro de todos.

**Transición.** Antes del caso completo, el cementerio.

**Fuente de las cifras.** Comentarios de cabecera de weekend-effect.cs y overnight-drift.cs.

---

## 22 · El cementerio

*≈ 49 segundos*

Esta lámina es, para mí, la más importante de la metodología. Un proceso sin descartes no es un proceso, es una colección de aciertos contados a posteriori. Aquí están seis ideas que no entraron, con sus cifras. Las cuatro primeras fallaron igual y dejan la misma lección: la descorrelación sin ventaja no vale nada. Un activo distinto no genera ventaja por ser distinto. Pero mirad la fila del oro, porque es la peligrosa: factor de beneficio uno coma setenta y tres, curva que sube, aprobaba el resumen. Lo que lo tumbó fue abrir la distribución: tres operaciones eran el ochenta y cinco por ciento del beneficio. El factor de beneficio no distingue una ventaja repetible de una racha afortunada. La concentración sí.

**Transición.** Y ahora el caso completo, de principio a fin.

**Fuente de las cifras.** src/lib/estrategias/cartera.ts, bloque DESCARTADOS y LECCION_DESCARTES; documento Portafolio_6_Bots_MNQ, apartados 9 y 9.1.

---

## 23 · Caso completo: ZigZag

*≈ 43 segundos*

Voy a recorrer una estrategia entera, de principio a fin. Y elijo el ZigZag a propósito, porque es la más débil de las seis. Si el método aguanta con la peor, aguanta con todas. Qué hace: rompe zonas de soporte y resistencia, pero con dos condiciones que la separan de una ruptura corriente. La primera, la vela que rompe debe tener cuerpo: si es una mecha larga con cuerpo pequeño, el mercado está rechazando la ruptura, no confirmándola. La segunda, el camino hasta el objetivo tiene que estar despejado; si hay otra zona en medio, no se toma la operación. Abajo, la configuración exacta con la que corre.

**Transición.** Este es el recorrido de validación que hizo.

**Fuente de las cifras.** catalogo.ts, ficha zigzag-breakout; tesis del 15 de agosto de 2026 y cabecera de zigzag-breakout.cs.

---

## 24 · El recorrido de validación del ZigZag

*≈ 44 segundos*

Fase por fase, con resultados literales del registro. La A: la franja de nueve y media a diez y media gana entre veintiséis ventanas evaluadas; alargarla hasta las once y media hunde el factor de beneficio a uno coma cero cuarenta y nueve. La B: nueve corridas moviendo parámetros, y el peor vecino sigue dando uno coma treinta y ocho. La C: fuera de muestra, uno coma treinta y cinco. La D: cinco de seis bloques por encima de uno. Y la E está en curso. A la derecha, trece variantes probadas y descartadas, todas anotadas con su cifra. Es tan importante lo que se descartó como lo que quedó.

**Transición.** Y aun con todo esto, el veredicto individual es un suspenso.

**Fuente de las cifras.** Bloque «FASE A…E» de la cabecera de zigzag-breakout.cs y sus trece descartes documentados.

---

## 25 · El veredicto individual del ZigZag

*≈ 43 segundos*

Aquí es donde se mide la honestidad de un proyecto: no en las láminas de resultados buenos. Su t de Student es uno coma noventa, por debajo de dos, lo que significa que no puedo afirmar que su ventaja exista. Probabilidad de azar del catorce por ciento: uno de cada siete resultados así saldría por suerte. Y diez operaciones de quinientas treinta y dos producen el ochenta y nueve por ciento del beneficio. El gráfico enseña tres años en negativo, incluido el actual. Y la tarjeta de la derecha cierra el asunto: harían falta veintidós años más de operativa para poder validarla en solitario. Nunca va a pasar.

**Transición.** Entonces, ¿por qué sigue en la cartera? Aquí viene la parte que más me costó aprender.

**Fuente de las cifras.** zigzag-breakout.json (t-stat 1,90, PF 1,24, concentración top-10 = 89,1 %, serie anual) y la tesis individual del 15 de agosto.

---

## 26 · El error de método

*≈ 51 segundos*

Esta lámina es la que más me costó escribir. Saqué el ZigZag de la cartera y estuvo fuera veinticuatro horas. Lo saqué aplicándole el listón de estrategia individual a una decisión de portafolio, y esa no es la pregunta correcta. Mirad la tabla: en el periodo dos mil quince a dos mil veinte, sin el ZigZag la cartera hace novecientos de ratio beneficio-caída; con él, dos coma setenta. Aportó siete mil setecientos cinco dólares cuando las otras cuatro juntas aportaron tres mil cuatrocientos noventa. Y encima la objeción estaba mal aplicada: lo saqué por tener el beneficio concentrado, y al medir lo mismo en las demás, todas estaban igual o peor. La lección está a la derecha, y es teoría de carteras elemental que yo dejé de aplicar.

**Transición.** Eso nos lleva a lo que hace un portafolio que no hace ninguna estrategia sola.

**Fuente de las cifras.** Tesis del ZigZag, apartados 2 y 3; hoja «Aporte al portafolio» del registro de validación.

---

## 27 · El conjunto frente a la suma de las partes

*≈ 44 segundos*

Aquí está el argumento central del portafolio. Seis estrategias, un contrato cada una. Individualmente, ninguna es espectacular: la mejor tiene un ratio beneficio-caída de nueve, la peor de dos y medio. Pero fijaos en las dos últimas filas de la tabla. Si las seis sufriesen a la vez, la caída sería de casi dieciséis mil dólares. La caída real medida es de cuatro mil noventa y nueve. Un setenta y cuatro por ciento menos. Y la solidez estadística del conjunto, cuatro coma noventa y dos, supera a la del mejor bot individual, que se queda en tres coma sesenta y cinco. El conjunto es más sólido que cualquiera de sus partes.

**Transición.** Y ahora el porqué, que es más interesante que el cuánto.

**Fuente de las cifras.** public/estrategias/data/cartera.json, bloques resumen y componentes.

---

## 28 · Lo que de verdad protege

*≈ 47 segundos*

Esta es la lámina más importante de todo el bloque, y la idea es sutil. Cuando alguien enseña una matriz de correlaciones, enseña la media. Y la media miente, porque una cartera puede tener correlaciones bajas de media y dispararse a uno justo en el pánico, que es exactamente cuando duele. Lo que hay aquí es otra cosa: la correlación restringida al diez por ciento de peores días del portafolio. Y mirad cómo cruzan todas las líneas hacia abajo. El ZigZag correlaciona más cero coma cincuenta y ocho con el Momentum de media, y menos cero coma cuarenta y ocho cuando la cartera sufre. Gana cuando los demás pierden. Eso es lo que amortigua una caída de verdad.

**Transición.** Con esa lente, cada estrategia tiene un papel distinto.

**Fuente de las cifras.** src/lib/estrategias/cartera.ts, bloque CORRELACIONES; hoja «Correlación» del registro del portafolio.

---

## 29 · Cada estrategia tiene un papel

*≈ 43 segundos*

Y aquí está la clasificación, que es lo que convierte seis bots en una cartera. Arriba a la izquierda, los motores: Overnight y RSI2, casi la mitad del beneficio, pero también los más dependientes del régimen actual. A la derecha, los satélites de crecimiento: aportan menos pero con caídas contenidas, el Momentum tiene la menor de las seis. Abajo a la izquierda, la cobertura de cola, que es el ZigZag: entra por descorrelación, no por rentabilidad, y por eso nunca operará más de un contrato. Y el amortiguador de régimen, el IBS, diseñado explícitamente para no solaparse con nadie. La frase de abajo cierra: ninguna es prescindible.

**Transición.** Pero hay un riesgo que comparten cinco de las seis, y no lo voy a esconder.

**Fuente de las cifras.** cartera.ts (APORTE_MARGINAL, DEPENDENCIA_REGIMEN) y cartera.json (componentes).

---

## 30 · El riesgo que sí tiene esta cartera

*≈ 53 segundos*

No lo voy a esconder, porque es el riesgo estructural. Cinco de las seis estrategias son estadísticamente nulas antes de julio de dos mil veinte y fuertes después. Miradlo en la curva: los cinco primeros años y medio son prácticamente planos. Once mil quinientos dólares con una caída de cuatro mil. Y a partir de ahí, setenta y siete mil. El mismo código, sin tocar una línea. Eso significa que las seis están apostando, en el fondo, a que el mercado siga pareciéndose al de los últimos cinco años. Ahora, lo tranquilizador dentro de lo incómodo: la peor caída de todo el registro pertenece al régimen antiguo. El peor caso que hemos medido ya es el escenario de que desaparezca el factor común. No sería una catástrofe; serían varios años ganando poco.

**Transición.** Con eso sobre la mesa, así es como se dimensiona.

**Fuente de las cifras.** cartera.json (bloque regimen y serie equity) y apartado 4 del documento del portafolio.

---

## 31 · Cierre

*≈ 62 segundos*

Cierro con el dimensionamiento y con dónde estamos de verdad. La recomendación es la más conservadora de las cuatro: un contrato por bot, caída esperada del ocho coma dos por ciento de la cuenta. Y planificar con siete mil setecientos catorce dólares al año, que es la media de los once años y medio e incluye ambos regímenes, no con los doce mil setecientos del régimen actual. Hay que estar preparado para dos mil cien durante varios años seguidos. Tres reglas de gobierno: encender las seis a la vez, no pausar por intuición y tener un umbral de revisión escrito. Y a la derecha, el estado real, sin adornos: Fase E, simulado, sin capital asignado. Todo lo que habéis visto es simulación histórica. Y por eso lo que os pido hoy no es capital: es que acordemos ahora el criterio con el que decidiremos, dentro de unos meses, si esto ha cumplido lo que prometía. Gracias.

**Transición.** — fin de la presentación —

**Fuente de las cifras.** cartera.ts (DIMENSIONAMIENTO, ESCENARIOS_ANUALES, REGLAS_OPERATIVAS) y MARCO_COMUN (estado «Fase E — simulado, sin capital asignado»).

---

## Tres cosas que no se pueden omitir

1. **Lámina 18** — los cuatro agentes no tienen backtest, y por qué construirlo sería engañoso.
2. **Lámina 30** — cinco de las seis estrategias dependen del régimen posterior a julio de 2020.
3. **Lámina 31** — Fase E: simulado, sin capital asignado. Todo lo mostrado es simulación histórica.

Si el tiempo aprieta, se recorta del bloque de arquitectura (láminas 7 a 10), nunca de estas tres.
