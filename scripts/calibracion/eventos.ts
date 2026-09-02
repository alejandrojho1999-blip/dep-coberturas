/**
 * Corpus de eventos con fecha, para medir qué movió de verdad el precio.
 *
 * Esta lista es el patrón oro de la recalibración. Cada entrada lleva la
 * severidad que un analista bien calibrado **debería** haber puesto, y el
 * script de medición la contrasta con lo que el mercado hizo después. Donde las
 * dos cosas no cuadran, manda el mercado y la etiqueta se corrige.
 *
 * Reglas para añadir un evento:
 *
 *  1. `fecha` es el día en que el hecho se conoció, no el día en que ocurrió si
 *     se supo más tarde. El precio reacciona a la noticia, no al suceso.
 *  2. La severidad se asigna por **efecto esperado en el precio**, nunca por
 *     gravedad humana. Una masacre lejana con cero efecto en el oro es un 1.
 *  3. `verificado` marca si la fecha se comprobó contra una fuente. Una fecha
 *     mal puesta corrompe la medición entera y es el error más fácil aquí.
 *
 * Los tres tramos existen porque no son comparables entre sí: el mercado de
 * tasas cero reaccionaba a la geopolítica de otra manera. Solo `principal`
 * produce anclas para el prompt; los otros dos son el control que dice si esas
 * anclas son un accidente del régimen actual o algo más estable.
 */

export type Tramo = 'principal' | 'control_2014' | 'control_shocks'
export type TemaEvento = 'guerra' | 'fed_tesoro'

export interface EventoHistorico {
  /** Día en que el hecho se conoció, en ISO corto. */
  fecha: string
  tramo: Tramo
  tema: TemaEvento
  titulo: string
  /** Severidad que merecía por efecto de precio, no por gravedad humana. */
  severidad: 1 | 2 | 3 | 4 | 5
  /** Clase de hecho, para agrupar y medir por familia. */
  clase: ClaseEvento
  /** Por qué esa severidad, en una frase. */
  nota: string
  verificado: boolean
}

/**
 * Familias de suceso.
 *
 * Agrupar por clase es lo que permite responder la pregunta útil: no "cuánto
 * movió este dron" sino "cuánto mueve un dron, en general".
 */
export type ClaseEvento =
  | 'invasion'              // ataque abierto entre Estados
  | 'incursion-otan'        // violación de espacio aéreo o territorio OTAN
  | 'victimas-otan'         // daño o muertes en suelo OTAN
  | 'articulo-4'            // consultas formales de la Alianza
  | 'sabotaje'              // infraestructura crítica
  | 'amenaza-nuclear'       // retórica o ejercicio nuclear
  | 'declaracion'           // dicho, no hecho
  | 'inestabilidad-interna' // motín, purga, crisis de mando
  | 'fomc-decision'         // decisión de tasas
  | 'dato-macro'            // IPC, empleo
  | 'crisis-institucional'  // independencia del banco central

export const EVENTOS: readonly EventoHistorico[] = [
  // ── Tramo principal · guerra (2022-02 → 2026-05) ──────────────────────────
  {
    fecha: '2022-02-24', tramo: 'principal', tema: 'guerra', clase: 'invasion',
    titulo: 'Rusia invade Ucrania',
    severidad: 5, verificado: true,
    nota: 'Ataque abierto en Europa. Es el techo de la escala: nada posterior lo iguala.',
  },
  {
    fecha: '2022-03-04', tramo: 'principal', tema: 'guerra', clase: 'incursion-otan',
    titulo: 'Incendio en la central nuclear de Zaporiyia durante combates',
    severidad: 4, verificado: true,
    nota: 'Riesgo nuclear civil con cobertura mundial en tiempo real.',
  },
  {
    fecha: '2022-09-26', tramo: 'principal', tema: 'guerra', clase: 'sabotaje',
    titulo: 'Sabotaje de los gasoductos Nord Stream 1 y 2 en el Báltico',
    severidad: 4, verificado: true,
    nota: 'Infraestructura crítica destruida en aguas europeas; efecto directo en gas y energía.',
  },
  {
    fecha: '2022-09-21', tramo: 'principal', tema: 'guerra', clase: 'amenaza-nuclear',
    titulo: 'Putin anuncia movilización parcial y alude al arsenal nuclear',
    severidad: 4, verificado: true,
    nota: 'Amenaza nuclear explícita del jefe de Estado, no de un portavoz.',
  },
  {
    fecha: '2022-11-15', tramo: 'principal', tema: 'guerra', clase: 'victimas-otan',
    titulo: 'Misil cae en Przewodów (Polonia) y mata a dos personas; Polonia invoca el artículo 4',
    severidad: 3, verificado: true,
    nota: 'Muertes en suelo OTAN, pero se aclaró en horas que era un S-300 ucraniano. El susto duró una sesión.',
  },
  {
    fecha: '2023-06-24', tramo: 'principal', tema: 'guerra', clase: 'inestabilidad-interna',
    titulo: 'Motín del grupo Wagner y marcha sobre Moscú',
    severidad: 2, verificado: true,
    nota: 'Baja de 3 a 2 el 2026-09-02: inestabilidad en una potencia nuclear, resuelta en 36 '
      + 'horas y en fin de semana, con oro +0,1% y VIX +9,4% a cinco sesiones. Ningún activo '
      + 'vigilado superó su umbral. Es el ejemplo de suceso grave sin transmisión al precio, y '
      + 'el prompt ya lo usaba como tal en el peldaño 2.',
  },
  {
    fecha: '2024-08-06', tramo: 'principal', tema: 'guerra', clase: 'invasion',
    titulo: 'Ucrania lanza la incursión terrestre en Kursk',
    severidad: 2, verificado: true,
    nota: 'Escalada real, pero dentro del patrón conocido de la guerra. El mercado apenas se enteró.',
  },
  {
    fecha: '2024-11-19', tramo: 'principal', tema: 'guerra', clase: 'amenaza-nuclear',
    titulo: 'Rusia rebaja el umbral de su doctrina nuclear tras autorizar EEUU los ATACMS de largo alcance',
    severidad: 3, verificado: true,
    nota: 'Cambio de doctrina, no de despliegue. Movió, pero se deshizo en dos sesiones.',
  },
  {
    fecha: '2025-09-10', tramo: 'principal', tema: 'guerra', clase: 'incursion-otan',
    titulo: 'Cazas de la OTAN derriban drones rusos sobre Polonia; Polonia invoca el artículo 4',
    severidad: 3, verificado: true,
    nota: 'Llevaba un 4 por ser la primera vez que la OTAN dispara contra material ruso sobre '
      + 'su territorio, que es importancia histórica y no efecto de precio: corregido el '
      + '2026-09-02. Oro +1,3% y VIX +8,9% a cinco sesiones, sin un solo activo por encima de '
      + 'su umbral. Queda a la altura de la violación de Estonia de nueve días después, que es '
      + 'su misma clase y sí movió dos activos.',
  },
  {
    fecha: '2025-09-19', tramo: 'principal', tema: 'guerra', clase: 'incursion-otan',
    titulo: 'Tres MiG-31 rusos violan el espacio aéreo de Estonia doce minutos; Estonia invoca el artículo 4',
    severidad: 3, verificado: true,
    nota: 'Violación deliberada y sin víctimas ni daño. Segunda del mes: el mercado ya la descuenta.',
  },

  // ── Tramo principal · Fed y Tesoro ────────────────────────────────────────
  {
    fecha: '2022-03-16', tramo: 'principal', tema: 'fed_tesoro', clase: 'fomc-decision',
    titulo: 'La Fed sube tasas por primera vez desde 2018 (+25 pb)',
    severidad: 2, verificado: true,
    nota: 'Llevaba un 4 por marcar el inicio del régimen de tasas altas, que es importancia '
      + 'institucional y no efecto de precio: corregido el 2026-09-02. El mercado la esperaba '
      + 'y la celebró, con el S&P en +5,7% y el VIX cayendo un 23,9% a cinco sesiones. Un giro '
      + 'de ciclo anunciado con meses de antelación ya está en el precio cuando llega.',
  },
  {
    fecha: '2022-06-15', tramo: 'principal', tema: 'fed_tesoro', clase: 'fomc-decision',
    titulo: 'La Fed sube 75 pb, la mayor subida desde 1994',
    severidad: 2, verificado: true,
    nota: 'Llevaba un 5 por ser la mayor subida desde 1994, que es importancia institucional y '
      + 'no efecto de precio: corregido el 2026-09-02 con la medición delante. El S&P quedó en '
      + '+0,7% a cinco sesiones y el VIX BAJÓ un 15,1%. La repreciación ya había ocurrido cinco '
      + 'días antes con el IPC del 8,6%, que es el evento que merece el 5 de esa semana. El '
      + 'contraejemplo que enseña que lo descontado no mueve por grande que sea.',
  },
  {
    fecha: '2022-06-10', tramo: 'principal', tema: 'fed_tesoro', clase: 'dato-macro',
    titulo: 'IPC de EEUU de mayo sorprende al alza (8,6% interanual)',
    severidad: 5, verificado: true,
    nota: 'Sube de 4 a 5 el 2026-09-02: la nota vieja ya decía que mueve más que la reunión, '
      + 'pero le daba la misma severidad. Es el movimiento más fuerte del tramo principal '
      + '—S&P -8,7% y VIX +34,3% a cinco sesiones— y el que forzó los 75 pb de cinco días '
      + 'después. Un dato que rompe la expectativa reescribe la trayectoria; la decisión que '
      + 'lo confirma solo la ejecuta.',
  },
  {
    fecha: '2023-03-10', tramo: 'principal', tema: 'fed_tesoro', clase: 'crisis-institucional',
    titulo: 'Quiebra de Silicon Valley Bank',
    severidad: 5, verificado: true,
    nota: 'Crisis bancaria que reescribió la trayectoria de tasas en una semana.',
  },
  {
    fecha: '2023-07-26', tramo: 'principal', tema: 'fed_tesoro', clase: 'fomc-decision',
    titulo: 'Última subida del ciclo: la Fed lleva la tasa al 5,25-5,50%',
    severidad: 2, verificado: true,
    nota: 'Baja de 3 a 2 el 2026-09-02 para que la severidad diga lo que ya decía la nota: '
      + '«completamente descontada» es la definición del peldaño 2, no del 3. Ningún activo '
      + 'vigilado superó su umbral en las cinco sesiones siguientes.',
  },
  {
    fecha: '2024-09-18', tramo: 'principal', tema: 'fed_tesoro', clase: 'fomc-decision',
    titulo: 'Primer recorte del ciclo: la Fed baja 50 pb',
    severidad: 4, verificado: true,
    nota: 'El tamaño sí sorprendió: el consenso estaba dividido entre 25 y 50.',
  },
  {
    fecha: '2024-12-18', tramo: 'principal', tema: 'fed_tesoro', clase: 'fomc-decision',
    titulo: 'La Fed recorta 25 pb pero reduce los recortes previstos para 2025',
    severidad: 4, verificado: true,
    nota: 'El recorte era lo esperado; el diagrama de puntos no. Caída fuerte de índices.',
  },

  // ── Control 2014-2021 · el mismo tipo de suceso con tasas cero ────────────
  {
    fecha: '2014-03-18', tramo: 'control_2014', tema: 'guerra', clase: 'invasion',
    titulo: 'Rusia se anexiona Crimea',
    severidad: 4, verificado: true,
    nota: 'Anexión territorial en Europa. Referencia de cuánto movía esto antes de 2022.',
  },
  {
    fecha: '2014-07-17', tramo: 'control_2014', tema: 'guerra', clase: 'victimas-otan',
    titulo: 'Derribo del vuelo MH17 sobre Donbás, 298 muertos',
    severidad: 3, verificado: true,
    nota: 'Víctimas civiles de países OTAN. Prueba directa de gravedad humana alta con efecto de precio corto.',
  },
  {
    fecha: '2015-11-24', tramo: 'control_2014', tema: 'guerra', clase: 'incursion-otan',
    titulo: 'Turquía derriba un Su-24 ruso en su frontera',
    severidad: 3, verificado: true,
    nota: 'Un país OTAN derriba un avión ruso: el precedente más cercano a un choque directo.',
  },
  {
    fecha: '2018-03-04', tramo: 'control_2014', tema: 'guerra', clase: 'sabotaje',
    titulo: 'Envenenamiento de Skripal en Salisbury con Novichok',
    severidad: 2, verificado: true,
    nota: 'Agente químico ruso en suelo OTAN, expulsiones masivas de diplomáticos, cero efecto de precio.',
  },
  {
    fecha: '2020-03-15', tramo: 'control_2014', tema: 'fed_tesoro', clase: 'fomc-decision',
    titulo: 'La Fed recorta a cero en reunión de emergencia un domingo (covid)',
    severidad: 5, verificado: true,
    nota: 'Recorte de emergencia fuera de calendario. El extremo de la clase fomc-decision.',
  },

  // ── Control 2001-2013 · shocks de otra naturaleza ─────────────────────────
  {
    fecha: '2001-09-11', tramo: 'control_shocks', tema: 'guerra', clase: 'invasion',
    titulo: 'Atentados del 11 de septiembre en Estados Unidos',
    severidad: 5, verificado: true,
    nota: 'Cierre de la bolsa cuatro sesiones. Referencia absoluta de shock geopolítico.',
  },
  {
    fecha: '2003-03-20', tramo: 'control_shocks', tema: 'guerra', clase: 'invasion',
    titulo: 'Comienza la invasión de Irak',
    severidad: 3, verificado: true,
    nota: 'Guerra anunciada durante meses: el mercado subió al confirmarse. Caso de manual de "comprar el rumor".',
  },
  {
    fecha: '2008-09-15', tramo: 'control_shocks', tema: 'fed_tesoro', clase: 'crisis-institucional',
    titulo: 'Quiebra de Lehman Brothers',
    severidad: 5, verificado: true,
    nota: 'El shock financiero de referencia contra el que se mide cualquier otro.',
  },
  {
    fecha: '2011-08-05', tramo: 'control_shocks', tema: 'fed_tesoro', clase: 'crisis-institucional',
    titulo: 'S&P rebaja la calificación AAA de Estados Unidos',
    severidad: 4, verificado: true,
    nota: 'Golpe institucional puro, sin muertos ni tanques. Útil para separar gravedad de efecto.',
  },
  {
    fecha: '2013-05-22', tramo: 'control_shocks', tema: 'fed_tesoro', clase: 'declaracion',
    titulo: 'Bernanke insinúa el fin de las compras de bonos (taper tantrum)',
    severidad: 4, verificado: true,
    nota: 'Una sola declaración movió el mundo entero. El contraejemplo de que "declaración" siempre sea bajo.',
  },
] as const

export function eventosDe(tramo: Tramo): EventoHistorico[] {
  return EVENTOS.filter((e) => e.tramo === tramo)
}

/** Todos los tickers que hay que descargar para medir el corpus. */
export const TICKERS_MEDIDOS = [
  'GC=F', 'SI=F', 'BTC-USD', 'CL=F', 'NQ=F', 'ES=F', '^VIX', 'DX-Y.NYB',
] as const
