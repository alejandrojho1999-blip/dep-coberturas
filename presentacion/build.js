/**
 * Generador de «Emporium Quant Desk — De la idea al capital gestionado».
 *
 * Todas las cifras proceden de:
 *   - public/estrategias/data/cartera.json y los seis JSON por estrategia
 *   - src/lib/estrategias/{cartera.ts, catalogo.ts}
 *   - los umbrales reales de src/lib/peter-lynch/screener.ts, src/lib/options/*
 *   - Portafolio_6_Bots_MNQ.docx y Tesis_Bot_NQ_ZigZag_Breakout_5min_RTH.docx (Drive)
 *
 * Ejecutar:  node presentacion/build.js
 */

const path = require('path')
const fs = require('fs')
const pptxgen = require('pptxgenjs')

const RAIZ = path.resolve(__dirname, '..')
const cartera = JSON.parse(
  fs.readFileSync(path.join(RAIZ, 'public/estrategias/data/cartera.json'), 'utf8'),
)
const zigzag = JSON.parse(
  fs.readFileSync(path.join(RAIZ, 'public/estrategias/data/zigzag-breakout.json'), 'utf8'),
)

// ─────────────────────────────────────────────────────────────────────────────
// Paleta y tipografía
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  fondo: '0C1E2C', // azul noche, dominante
  fondoAlt: '071522', // portada y divisores
  marca: '003D66', // azul corporativo
  panel: '12293B', // superficie de tarjeta
  panelAlto: '1A3549', // tarjeta destacada
  borde: '24405A',
  texto: 'F2F6FA',
  suave: '9DB2C4',
  tenue: '6B8299',
  peter: '10B981',
  small: '38BDF8',
  gamma: '8B8FF0',
  theta: 'E0A458',
  futuros: '4D95D0',
  bien: '10B981',
  mal: 'F04438',
  oro: 'E0A458',
}

const F = { tit: 'Georgia', cuerpo: 'Calibri', dato: 'Consolas' }
const W = 13.333
const H = 7.5
const M = 0.62 // margen lateral

const sombra = () => ({
  type: 'outer',
  color: '000000',
  blur: 10,
  offset: 3,
  angle: 90,
  opacity: 0.28,
})

const pres = new pptxgen()
pres.layout = 'LAYOUT_WIDE'
pres.author = 'Luis Riofrío'
pres.company = 'Emporium Quality Funds'
pres.title = 'Emporium Quant Desk'
pres.subject = 'De la idea al capital gestionado'

let n = 0
const guion = []

// ─────────────────────────────────────────────────────────────────────────────
// Primitivas de maquetación
// ─────────────────────────────────────────────────────────────────────────────

/** Lámina nueva con fondo y pie. `tag` es el bloque temático. */
function lamina(tag, { oscura = false } = {}) {
  const s = pres.addSlide()
  s.background = { color: oscura ? C.fondoAlt : C.fondo }
  n += 1
  if (n > 1) {
    s.addText(tag.toUpperCase(), {
      x: M,
      y: H - 0.52,
      w: 6,
      h: 0.3,
      margin: 0,
      fontFace: F.dato,
      fontSize: 9,
      color: C.tenue,
      charSpacing: 2,
    })
    s.addText(String(n).padStart(2, '0'), {
      x: W - M - 1.2,
      y: H - 0.52,
      w: 1.2,
      h: 0.3,
      margin: 0,
      align: 'right',
      fontFace: F.dato,
      fontSize: 9,
      color: C.tenue,
    })
  }
  return s
}

/** Cabecera estándar: título grande y, opcionalmente, una entradilla. */
function titulo(s, txt, sub, { y = 0.52 } = {}) {
  s.addText(txt, {
    x: M,
    y,
    w: W - M * 2,
    h: 0.68,
    margin: 0,
    fontFace: F.tit,
    fontSize: 30,
    bold: true,
    color: C.texto,
    valign: 'middle',
  })
  if (sub) {
    s.addText(sub, {
      x: M,
      y: y + 0.7,
      w: W - M * 2 - 0.4,
      h: 0.46,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 14.5,
      color: C.suave,
      valign: 'top',
    })
  }
}

/** Tarjeta con barra de acento a la izquierda: el motivo visual del documento. */
function tarjeta(s, { x, y, w, h, acento, alta = false }) {
  s.addShape(pres.shapes.RECTANGLE, {
    x,
    y,
    w,
    h,
    fill: { color: alta ? C.panelAlto : C.panel },
    line: { color: C.borde, width: 0.75 },
    shadow: sombra(),
  })
  if (acento) {
    s.addShape(pres.shapes.RECTANGLE, {
      x,
      y,
      w: 0.07,
      h,
      fill: { color: acento },
      line: { color: acento, width: 0 },
    })
  }
}

/** Cifra protagonista con su etiqueta debajo. */
function cifra(s, { x, y, w, valor, etiqueta, color = C.texto, tam = 40, align = 'left' }) {
  s.addText(valor, {
    x,
    y,
    w,
    h: 0.72,
    margin: 0,
    align,
    fontFace: F.dato,
    fontSize: tam,
    bold: true,
    color,
    valign: 'middle',
  })
  s.addText(etiqueta, {
    x,
    y: y + 0.7,
    w,
    h: 0.5,
    margin: 0,
    align,
    fontFace: F.cuerpo,
    fontSize: 11.5,
    color: C.suave,
    valign: 'top',
  })
}

/** Etiqueta pequeña en mayúsculas, para rotular bloques dentro de una tarjeta. */
function rotulo(s, { x, y, w, txt, color = C.tenue, tam = 10 }) {
  s.addText(txt.toUpperCase(), {
    x,
    y,
    w,
    h: 0.26,
    margin: 0,
    fontFace: F.dato,
    fontSize: tam,
    color,
    charSpacing: 1.6,
    valign: 'middle',
  })
}

function parrafo(s, { x, y, w, h, txt, tam = 13, color = C.suave, align = 'left' }) {
  s.addText(txt, {
    x,
    y,
    w,
    h,
    margin: 0,
    align,
    fontFace: F.cuerpo,
    fontSize: tam,
    color,
    valign: 'top',
    lineSpacingMultiple: 1.18,
  })
}

function vinetas(s, { x, y, w, h, items, tam = 13, color = C.suave }) {
  s.addText(
    items.map((t, i) => ({
      text: t,
      options: { bullet: { indent: 14 }, breakLine: i < items.length - 1, paraSpaceAfter: 6 },
    })),
    {
      x,
      y,
      w,
      h,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: tam,
      color,
      valign: 'top',
    },
  )
}

/** Píldora de texto: usada para nombres de agentes, librerías y estados. */
function pildora(s, { x, y, w, h = 0.34, txt, color, relleno }) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x,
    y,
    w,
    h,
    rectRadius: h / 2,
    fill: { color: relleno || C.panel },
    line: { color: color || C.borde, width: 1 },
  })
  s.addText(txt, {
    x,
    y,
    w,
    h,
    margin: 0,
    align: 'center',
    valign: 'middle',
    fontFace: F.dato,
    fontSize: 10.5,
    color: color || C.suave,
  })
}

/** Caja de un diagrama de flujo. */
function nodo(s, { x, y, w, h, titulo: t, detalle, acento = C.futuros }) {
  s.addShape(pres.shapes.RECTANGLE, {
    x,
    y,
    w,
    h,
    fill: { color: C.panel },
    line: { color: acento, width: 1.1 },
  })
  s.addText(t, {
    x: x + 0.14,
    y: y + 0.1,
    w: w - 0.28,
    h: 0.32,
    margin: 0,
    fontFace: F.cuerpo,
    fontSize: 12,
    bold: true,
    color: C.texto,
    valign: 'middle',
  })
  if (detalle) {
    s.addText(detalle, {
      x: x + 0.14,
      y: y + 0.42,
      w: w - 0.28,
      h: h - 0.52,
      margin: 0,
      fontFace: F.dato,
      fontSize: 9.5,
      color: C.suave,
      valign: 'top',
      lineSpacingMultiple: 1.12,
    })
  }
}

function flechaDer(s, { x, y, w = 0.3, color = C.tenue }) {
  s.addShape(pres.shapes.RIGHT_ARROW, {
    x,
    y,
    w,
    h: 0.22,
    fill: { color },
    line: { color, width: 0 },
  })
}

function flechaAbajo(s, { x, y, h = 0.26, color = C.tenue }) {
  s.addShape(pres.shapes.DOWN_ARROW, {
    x,
    y,
    w: 0.22,
    h,
    fill: { color },
    line: { color, width: 0 },
  })
}

/**
 * Tabla con el estilo del documento.
 * `alinear` permite fijar la alineación por columna; por defecto la primera va a
 * la izquierda y el resto a la derecha (cifras). Las columnas alineadas a la
 * izquierda usan la tipografía de cuerpo, porque son texto, no datos.
 */
function tabla(s, { x, y, w, cabecera, filas, colW, alturaFila = 0.36, tam = 11.5, alinear }) {
  const al = (i) => (alinear ? alinear[i] : i === 0 ? 'left' : 'right')
  const head = cabecera.map((t, i) => ({
    text: t,
    options: {
      fill: { color: C.marca },
      color: C.texto,
      bold: true,
      fontFace: F.cuerpo,
      fontSize: tam,
      align: al(i),
      valign: 'middle',
    },
  }))
  const cuerpo = filas.map((fila, fi) =>
    fila.map((celda, i) => {
      const esObj = typeof celda === 'object' && celda !== null
      const txt = esObj ? celda.text : celda
      return {
        text: String(txt),
        options: {
          fill: { color: fi % 2 === 0 ? C.panel : C.fondo },
          color: (esObj && celda.color) || (i === 0 ? C.texto : C.suave),
          bold: Boolean(esObj && celda.bold),
          fontFace: al(i) === 'left' ? F.cuerpo : F.dato,
          fontSize: tam,
          align: al(i),
          valign: 'middle',
        },
      }
    }),
  )
  s.addTable([head, ...cuerpo], {
    x,
    y,
    w,
    colW,
    rowH: alturaFila,
    border: { pt: 0.5, color: C.borde },
    margin: [3, 8, 3, 8],
  })
}

function nota(s, txt, { y = H - 1.02, color = C.tenue, tam = 10.5 } = {}) {
  s.addText(txt, {
    x: M,
    y,
    w: W - M * 2,
    h: 0.4,
    margin: 0,
    fontFace: F.cuerpo,
    fontSize: tam,
    italic: true,
    color,
    valign: 'top',
  })
}

/** Registra la entrada del guion de locución de la lámina actual. */
function decir(titulo, cuerpo, transicion, fuentes) {
  guion.push({ n, titulo, cuerpo, transicion, fuentes })
}

// ─────────────────────────────────────────────────────────────────────────────
// 01 · Portada
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('portada', { oscura: true })
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0,
    y: 0,
    w: 0.16,
    h: H,
    fill: { color: C.marca },
    line: { color: C.marca, width: 0 },
  })
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.16,
    y: 0,
    w: 0.04,
    h: H,
    fill: { color: C.futuros },
    line: { color: C.futuros, width: 0 },
  })

  rotulo(s, { x: 1.05, y: 1.28, w: 8, txt: 'Emporium Quality Funds', color: C.futuros, tam: 12 })
  s.addText('Emporium Quant Desk', {
    x: 1.0,
    y: 1.72,
    w: 11.4,
    h: 1.3,
    margin: 0,
    fontFace: F.tit,
    fontSize: 58,
    bold: true,
    color: C.texto,
    valign: 'middle',
  })
  s.addText('De la idea al capital gestionado', {
    x: 1.05,
    y: 3.02,
    w: 11.4,
    h: 0.6,
    margin: 0,
    fontFace: F.tit,
    fontSize: 25,
    italic: true,
    color: C.futuros,
    valign: 'middle',
  })

  const chips = [
    ['Peter', C.peter],
    ['Small', C.small],
    ['Gamma', C.gamma],
    ['Theta', C.theta],
    ['Portafolio de Futuros', C.futuros],
  ]
  let cx = 1.05
  chips.forEach(([t, col]) => {
    const w = t.length > 10 ? 2.25 : 1.35
    pildora(s, { x: cx, y: 3.95, w, txt: t, color: col })
    cx += w + 0.16
  })

  s.addText('Luis Riofrío  ·  Trader cuantitativo  ·  agosto de 2026', {
    x: 1.05,
    y: 4.82,
    w: 9,
    h: 0.36,
    margin: 0,
    fontFace: F.cuerpo,
    fontSize: 14,
    color: C.suave,
    valign: 'middle',
  })
  s.addShape(pres.shapes.RECTANGLE, {
    x: 1.05,
    y: 5.45,
    w: 8.4,
    h: 0.62,
    fill: { color: C.panel },
    line: { color: C.borde, width: 0.75 },
  })
  s.addText(
    'Documento interno. Resultados de simulación histórica; no constituyen asesoramiento financiero.',
    {
      x: 1.22,
      y: 5.45,
      w: 8.1,
      h: 0.62,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 11.5,
      italic: true,
      color: C.suave,
      valign: 'middle',
    },
  )
  decir(
    'Portada',
    'Buenos días. Lo que voy a presentar no es una idea de inversión: es una mesa de trading que ya está construida y funcionando. Se llama Emporium Quant Desk y tiene cinco operadores digitales. En los próximos veinte minutos veréis cómo está hecha por dentro, cómo piensa cada operador y, sobre todo, qué se ha hecho para saber si funciona o no.',
    'Empiezo por la idea, que cabe en una frase.',
    'Nombre acordado con el autor; disclaimer replicado de los documentos internos de agosto de 2026.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 02 · La idea en una frase
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('la idea')
  s.addText(
    'He contratado a cinco operadores\nque nunca improvisan.',
    {
      x: M,
      y: 1.0,
      w: 11.6,
      h: 1.9,
      margin: 0,
      fontFace: F.tit,
      fontSize: 40,
      bold: true,
      color: C.texto,
      valign: 'middle',
      lineSpacingMultiple: 1.1,
    },
  )
  parrafo(s, {
    x: M,
    y: 3.0,
    w: 10.4,
    h: 1.0,
    tam: 16,
    txt: 'Hacen el trabajo de un analista y de un operador: rastrean el universo, aplican criterios fijados de antemano, deciden, registran y revisan lo que tienen abierto. Cada decisión queda escrita, con su precio y su hora.',
  })

  const stats = [
    ['5', 'operadores en tres mesas', C.futuros],
    ['419', 'pruebas automáticas sobre la lógica', C.peter],
    ['3.838', 'operaciones simuladas en 11,6 años', C.oro],
    ['0', 'decisiones discrecionales', C.gamma],
  ]
  stats.forEach(([v, e, col], i) => {
    const x = M + i * 3.05
    tarjeta(s, { x, y: 4.32, w: 2.85, h: 1.5, acento: col })
    cifra(s, { x: x + 0.28, y: 4.5, w: 2.4, valor: v, etiqueta: e, color: col, tam: 34 })
  })
  decir(
    'La idea en una frase',
    'La tesis es sencilla: un operador humano se cansa, se enamora de una posición y cambia de criterio a mitad de camino. Estos cinco no. Aplican el mismo filtro el lunes y el viernes, y dejan rastro de cada decisión. Fijaos en el último dato: cero decisiones discrecionales. Es el corazón de todo lo que viene después.',
    'Veamos quiénes son.',
    'Cifras de src/lib/estrategias/cartera.json (3.838 operaciones) y del conjunto de tests Vitest del repositorio (419).',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 03 · Organigrama de la mesa
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('la plantilla')
  titulo(s, 'Tres mesas, cinco operadores', 'Cada mesa tiene su capital, su universo y su horizonte. No comparten bolsillo.')

  const mesas = [
    {
      nombre: 'MESA DE ACCIONES',
      capital: '$100.000',
      color: C.peter,
      agentes: [
        ['Agente Peter', 'Grandes compañías al estilo Lynch', C.peter],
        ['Agente Small', 'Pequeña capitalización', C.small],
      ],
    },
    {
      nombre: 'MESA DE OPCIONES',
      capital: '$100.000 + $300.000',
      color: C.gamma,
      agentes: [
        ['Agente Gamma', 'Compra direccional de opciones', C.gamma],
        ['Agente Theta', 'Venta de prima con colateral', C.theta],
      ],
    },
    {
      nombre: 'MESA DE FUTUROS',
      capital: '$50.000',
      color: C.futuros,
      agentes: [['Portafolio de Futuros', 'Seis estrategias sistemáticas sobre MNQ', C.futuros]],
    },
  ]

  mesas.forEach((mesa, i) => {
    const x = M + i * 4.08
    const w = 3.86
    tarjeta(s, { x, y: 2.05, w, h: 3.6, acento: mesa.color })
    rotulo(s, { x: x + 0.28, y: 2.28, w: w - 0.5, txt: mesa.nombre, color: mesa.color, tam: 11 })
    s.addText(mesa.capital, {
      x: x + 0.26,
      y: 2.6,
      w: w - 0.5,
      h: 0.5,
      margin: 0,
      fontFace: F.dato,
      fontSize: 21,
      bold: true,
      color: C.texto,
      valign: 'middle',
    })
    s.addText('capital asignado', {
      x: x + 0.26,
      y: 3.06,
      w: w - 0.5,
      h: 0.26,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 10.5,
      color: C.tenue,
      valign: 'middle',
    })
    mesa.agentes.forEach(([nom, desc, col], j) => {
      const y = 3.48 + j * 1.02
      s.addShape(pres.shapes.RECTANGLE, {
        x: x + 0.26,
        y,
        w: w - 0.52,
        h: 0.86,
        fill: { color: C.fondo },
        line: { color: C.borde, width: 0.75 },
      })
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.42,
        y: y + 0.3,
        w: 0.22,
        h: 0.22,
        fill: { color: col },
        line: { color: col, width: 0 },
      })
      s.addText(nom, {
        x: x + 0.76,
        y: y + 0.08,
        w: w - 1.1,
        h: 0.3,
        margin: 0,
        fontFace: F.cuerpo,
        fontSize: 12.5,
        bold: true,
        color: C.texto,
        valign: 'middle',
      })
      s.addText(desc, {
        x: x + 0.76,
        y: y + 0.38,
        w: w - 1.05,
        h: 0.42,
        margin: 0,
        fontFace: F.cuerpo,
        fontSize: 10.5,
        color: C.suave,
        valign: 'top',
      })
    })
    // La mesa de futuros tiene un solo «operador»: se detalla su composición
    // para que la columna no quede vacía frente a las otras dos.
    if (i === 2) {
      const y = 3.48 + 1.02
      s.addShape(pres.shapes.RECTANGLE, {
        x: x + 0.26,
        y,
        w: w - 0.52,
        h: 0.86,
        fill: { color: C.fondo },
        line: { color: C.borde, width: 0.75 },
      })
      s.addText('Overnight Drift · RSI2 Reversion · ZigZag Breakout · Weekend Effect · Momentum de Apertura · IBS Reversion', {
        x: x + 0.44,
        y: y + 0.08,
        w: w - 0.88,
        h: 0.7,
        margin: 0,
        fontFace: F.cuerpo,
        fontSize: 10,
        color: C.suave,
        valign: 'middle',
        lineSpacingMultiple: 1.1,
      })
    }
  })
  nota(
    s,
    'La mesa de opciones separa dos bolsillos porque la venta de prima exige colateral: $100.000 para Gamma y $300.000 para Theta.',
  )
  decir(
    'Organigrama de la mesa',
    'Tres mesas. Acciones, con Peter y Small, cien mil dólares. Opciones, con Gamma y Theta, y aquí hay una separación importante: Gamma compra opciones y le basta con cien mil, mientras que Theta vende prima y necesita colateral, por eso tiene trescientos mil. Y la mesa de futuros, cincuenta mil dólares para un portafolio de seis estrategias. No comparten bolsillo: si una mesa se equivoca, no se lleva por delante a las otras.',
    'Un vistazo a qué hace exactamente cada uno.',
    'src/lib/portafolios/config.ts (CAPITAL_ACCIONES, CAPITAL_OPCIONES_LARGAS, CAPITAL_OPCIONES_CORTAS) y MARCO_COMUN de catalogo.ts (cuenta de $50.000).',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 04 · Qué hace cada uno
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('la plantilla')
  titulo(s, 'La ficha de cada operador', 'Mismo esqueleto de decisión, calibración distinta.')

  const fichas = [
    {
      nom: 'AGENTE PETER',
      col: C.peter,
      rol: 'Acciones de gran capitalización',
      filas: [
        ['Universo', '443 valores del S&P 500 y el NASDAQ 100'],
        ['Busca', 'Compañías buenas y baratas al estilo Peter Lynch'],
        ['Entrega', 'Compra con precio de entrada, objetivo y stop'],
        ['Exigencia', 'Los 6 criterios fundamentales, sin excepción'],
      ],
    },
    {
      nom: 'AGENTE SMALL',
      col: C.small,
      rol: 'Pequeña capitalización',
      filas: [
        ['Universo', '307 valores del S&P 600 y el Russell 2000'],
        ['Busca', 'Lo mismo, con la vara calibrada para small caps'],
        ['Entrega', 'Compra con su capitalización registrada'],
        ['Exigencia', '4 de 6 criterios'],
      ],
    },
    {
      nom: 'AGENTE GAMMA',
      col: C.gamma,
      rol: 'Opciones largas, direccional',
      filas: [
        ['Universo', 'Las posiciones vivas de Peter y Small'],
        ['Busca', 'Traducir una convicción en acciones a una opción'],
        ['Entrega', 'Contrato concreto: strike, vencimiento y prima'],
        ['Exigencia', 'Delta 0,30-0,65 · 21-90 días · puntuación ≥ 50'],
      ],
    },
    {
      nom: 'AGENTE THETA',
      col: C.theta,
      rol: 'Opciones cortas, venta de prima',
      filas: [
        ['Universo', '36 subyacentes líquidos, lista fija'],
        ['Busca', 'Cobrar prima cara sin asumir dirección'],
        ['Entrega', 'Put vendida o call cubierta, con su colateral'],
        ['Exigencia', 'Volatilidad > 30 % · delta 0,15-0,35 · puntuación ≥ 60'],
      ],
    },
  ]

  fichas.forEach((f, i) => {
    const x = M + (i % 2) * 6.14
    const y = 2.02 + Math.floor(i / 2) * 2.38
    tarjeta(s, { x, y, w: 5.92, h: 2.2, acento: f.col })
    rotulo(s, { x: x + 0.26, y: y + 0.16, w: 3.6, txt: f.nom, color: f.col, tam: 11 })
    s.addText(f.rol, {
      x: x + 0.26,
      y: y + 0.42,
      w: 5.4,
      h: 0.28,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 12,
      italic: true,
      color: C.texto,
      valign: 'middle',
    })
    f.filas.forEach(([k, v], j) => {
      const fy = y + 0.78 + j * 0.34
      s.addText(k, {
        x: x + 0.26,
        y: fy,
        w: 1.0,
        h: 0.3,
        margin: 0,
        fontFace: F.dato,
        fontSize: 9,
        color: C.tenue,
        valign: 'middle',
      })
      s.addText(v, {
        x: x + 1.3,
        y: fy,
        w: 4.4,
        h: 0.3,
        margin: 0,
        fontFace: F.cuerpo,
        fontSize: 11,
        color: C.suave,
        valign: 'middle',
      })
    })
  })
  decir(
    'La ficha de cada operador',
    'Cuatro fichas. Peter mira 443 grandes compañías y les exige los seis criterios completos. Small mira 307 pequeñas y se conforma con cuatro de seis, porque en small caps exigir seis vacía la lista. Gamma no tiene universo propio: trabaja sobre lo que Peter y Small ya han aprobado, es decir, la mesa de opciones se apoya en el trabajo de la mesa de acciones. Y Theta es el único que no busca dirección: busca prima cara, con volatilidad por encima del treinta por ciento.',
    'Antes de entrar en el detalle, conviene decir qué no hacen.',
    'Umbrales verificados en src/lib/peter-lynch/screener.ts y en los filtros de AgenteGamma.tsx / AgenteTheta.tsx.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 05 · Qué NO hacen
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('la plantilla')
  titulo(s, 'Lo que estos agentes no hacen', 'Fijar el límite es parte del diseño, no una carencia.')

  const limites = [
    ['No ejecutan órdenes', 'Producen recomendaciones trazables. La orden la manda una persona.'],
    ['No deciden el tamaño', 'El importe por operación está fijado en configuración: ticket de $1.000 en acciones, un contrato por señal en opciones.'],
    ['No tienen acceso a la cuenta', 'Ningún agente posee credenciales del bróker. La separación es física, no una promesa.'],
    ['No operan a la baja en futuros', 'En las seis estrategias se probó el lado corto, no tenía ventaja y se eliminó del código.'],
    ['No se saltan su propio filtro', 'Ningún paso rescata a un candidato descartado por el paso anterior.'],
    ['No inventan un precio', 'Si el mercado no da precio real de entrada, la recomendación se descarta entera.'],
  ]
  limites.forEach(([t, d], i) => {
    const x = M + (i % 2) * 6.14
    const y = 2.02 + Math.floor(i / 2) * 1.48
    tarjeta(s, { x, y, w: 5.92, h: 1.3, acento: C.mal })
    s.addText(t, {
      x: x + 0.3,
      y: y + 0.16,
      w: 5.3,
      h: 0.32,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 13.5,
      bold: true,
      color: C.texto,
      valign: 'middle',
    })
    s.addText(d, {
      x: x + 0.3,
      y: y + 0.5,
      w: 5.34,
      h: 0.68,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 11,
      color: C.suave,
      valign: 'top',
      lineSpacingMultiple: 1.12,
    })
  })
  decir(
    'Lo que no hacen',
    'Igual de importante que lo que hacen. Ninguno ejecuta órdenes ni tiene credenciales del bróker: la separación es física. Ninguno decide cuánto arriesgar, eso está escrito en configuración. Y el último punto es el que más me importa: si el mercado no da un precio real de entrada, la recomendación se cae entera. Preferimos perder una oportunidad a registrar un precio inventado, porque un precio inventado contamina para siempre el histórico con el que luego mides.',
    'Vamos al cómo. Primero, la arquitectura.',
    'src/lib/portafolios/config.ts (TICKET_ACCIONES, CONTRATOS_POR_SENAL); guarda de precio nulo en AgentePeter.tsx y AgenteGamma.tsx; «solo largos» documentado en catalogo.ts.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 06 · Monolito o microservicios
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('arquitectura')
  titulo(s, '¿Monolito o microservicios?', 'La respuesta honesta: un monolito modular, más un único servicio aparte.')

  tarjeta(s, { x: M, y: 2.02, w: 5.92, h: 2.62, acento: C.futuros, alta: true })
  rotulo(s, { x: M + 0.3, y: 2.22, w: 5, txt: 'Servicio 1 · el monolito', color: C.futuros, tam: 11 })
  s.addText('Next.js 16.2.1 · App Router', {
    x: M + 0.28,
    y: 2.52,
    w: 5.3,
    h: 0.4,
    margin: 0,
    fontFace: F.tit,
    fontSize: 19,
    bold: true,
    color: C.texto,
    valign: 'middle',
  })
  vinetas(s, {
    x: M + 0.3,
    y: 3.0,
    w: 5.34,
    h: 1.5,
    tam: 11.5,
    items: [
      'Interfaz, API y lógica de negocio en un mismo despliegue',
      '38 rutas de API, todas en runtime Node',
      'Sin colas, sin workers, sin funciones en el borde',
      'Un solo despliegue que subir y una sola versión que auditar',
    ],
  })

  tarjeta(s, { x: M + 6.14, y: 2.02, w: 5.92, h: 2.62, acento: C.gamma })
  rotulo(s, { x: M + 6.44, y: 2.22, w: 5, txt: 'Servicio 2 · el especialista', color: C.gamma, tam: 11 })
  s.addText('FastAPI · Python 3.11', {
    x: M + 6.42,
    y: 2.52,
    w: 5.3,
    h: 0.4,
    margin: 0,
    fontFace: F.tit,
    fontSize: 19,
    bold: true,
    color: C.texto,
    valign: 'middle',
  })
  vinetas(s, {
    x: M + 6.44,
    y: 3.0,
    w: 5.34,
    h: 1.5,
    tam: 11.5,
    items: [
      'Solo el módulo de inferencia causal, que necesita el ecosistema científico de Python',
      'Servicio privado: no se expone a internet',
      'Se habla con el monolito por una puerta única y con clave',
    ],
  })

  tarjeta(s, { x: M, y: 4.86, w: 12.06, h: 1.14, acento: C.oro })
  s.addText(
    [
      { text: 'Veredicto:  ', options: { bold: true, color: C.oro } },
      {
        text: 'no son microservicios. Son dos servicios con un contrato explícito. Se eligió así porque un equipo de una persona paga el coste de los microservicios (despliegues, versiones, trazas) sin recibir su beneficio; el único trozo que de verdad necesitaba salir fue el que no podía escribirse en TypeScript.',
        options: { color: C.suave },
      },
    ],
    {
      x: M + 0.3,
      y: 4.86,
      w: 11.5,
      h: 1.14,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 12.5,
      valign: 'middle',
      lineSpacingMultiple: 1.14,
    },
  )
  decir(
    '¿Monolito o microservicios?',
    'Me lo preguntan siempre, así que lo contesto de frente. Esto es un monolito modular: una sola aplicación Next.js donde conviven la interfaz, las treinta y ocho rutas de API y toda la lógica. Y hay exactamente un servicio aparte, en Python, para la parte de inferencia causal, porque esa parte necesita librerías científicas que no existen en JavaScript. No son microservicios. Un equipo de una persona paga todos los costes de los microservicios y no recibe ninguno de sus beneficios.',
    'Así se ve el recorrido de una petición.',
    'render.yaml (dos servicios), next.config.ts, inventario de 38 route handlers y ausencia de server actions verificada por grep.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 07 · Diagrama de arquitectura
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('arquitectura')
  titulo(s, 'El recorrido de una decisión', 'De la pulsación del navegador al registro en base de datos.')

  const y0 = 2.15
  nodo(s, { x: M, y: y0, w: 2.0, h: 0.92, titulo: 'Navegador', detalle: 'Panel del gestor', acento: C.suave })
  flechaDer(s, { x: M + 2.08, y: y0 + 0.35 })
  nodo(s, {
    x: M + 2.48,
    y: y0,
    w: 2.1,
    h: 0.92,
    titulo: 'Proxy de sesión',
    detalle: 'src/proxy.ts\nrefresca y protege',
    acento: C.mal,
  })
  flechaDer(s, { x: M + 4.66, y: y0 + 0.35 })
  nodo(s, {
    x: M + 5.06,
    y: y0,
    w: 2.3,
    h: 0.92,
    titulo: 'Rutas de API',
    detalle: '38 handlers Node\norquestan, no calculan',
    acento: C.futuros,
  })
  flechaDer(s, { x: M + 7.44, y: y0 + 0.35 })
  nodo(s, {
    x: M + 7.84,
    y: y0,
    w: 2.3,
    h: 0.92,
    titulo: 'Núcleo src/lib',
    detalle: '~80 módulos puros\naquí vive el criterio',
    acento: C.peter,
  })

  // Fuentes externas
  const yF = 3.62
  rotulo(s, { x: M, y: yF - 0.32, w: 6, txt: 'Fuentes de datos externas', color: C.tenue })
  const fuentes = [
    ['Yahoo Finance', 'precios, cadenas de opciones y fundamentales'],
    ['FRED', 'series macro de la Reserva Federal'],
    ['OpenRouter', 'la capa de lenguaje que redacta el juicio'],
  ]
  fuentes.forEach(([t, d], i) => {
    const x = M + i * 4.08
    tarjeta(s, { x, y: yF, w: 3.86, h: 0.92, acento: C.oro })
    s.addText(t, {
      x: x + 0.24,
      y: yF + 0.1,
      w: 3.4,
      h: 0.3,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 12,
      bold: true,
      color: C.texto,
      valign: 'middle',
    })
    s.addText(d, {
      x: x + 0.24,
      y: yF + 0.4,
      w: 3.44,
      h: 0.44,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 10,
      color: C.suave,
      valign: 'top',
    })
  })

  // Persistencia y servicio Python
  const yP = 4.88
  tarjeta(s, { x: M, y: yP, w: 6.6, h: 1.12, acento: C.peter })
  s.addText('Supabase', {
    x: M + 0.28,
    y: yP + 0.12,
    w: 3,
    h: 0.32,
    margin: 0,
    fontFace: F.cuerpo,
    fontSize: 13,
    bold: true,
    color: C.texto,
    valign: 'middle',
  })
  s.addText(
    'Base de datos, autenticación y almacenamiento. 18 migraciones y seguridad a nivel de fila en todas las tablas.',
    {
      x: M + 0.28,
      y: yP + 0.44,
      w: 6.1,
      h: 0.6,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 10.5,
      color: C.suave,
      valign: 'top',
    },
  )
  tarjeta(s, { x: M + 6.86, y: yP, w: 5.2, h: 1.12, acento: C.gamma })
  s.addText('Puerta al servicio Python', {
    x: M + 7.14,
    y: yP + 0.12,
    w: 4.6,
    h: 0.32,
    margin: 0,
    fontFace: F.cuerpo,
    fontSize: 13,
    bold: true,
    color: C.texto,
    valign: 'middle',
  })
  s.addText(
    'Una única ruta valida la sesión, firma con clave y reenvía al FastAPI privado.',
    {
      x: M + 7.14,
      y: yP + 0.44,
      w: 4.72,
      h: 0.6,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 10.5,
      color: C.suave,
      valign: 'top',
    },
  )
  decir(
    'El recorrido de una decisión',
    'De izquierda a derecha. El navegador pide algo, un proxy comprueba que la sesión es válida, la ruta de API orquesta y el núcleo calcula. Quiero subrayar la última caja: las rutas de API no calculan nada, solo mueven datos. Todo el criterio vive en unos ochenta módulos puros, y por eso se pueden poner a prueba de forma automática. Abajo, las tres fuentes externas y los dos destinos: la base de datos y la puerta al servicio Python.',
    'Y esto importa porque determina qué se puede verificar.',
    'src/proxy.ts, inventario de route handlers, src/lib (~80 módulos), supabase/migrations (18), gateway /api/ergos-quant/[...path].',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 08 · Dónde corre la lógica
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('arquitectura')
  titulo(s, 'Dónde corre la lógica de negocio', 'La decisión de diseño que hace el sistema auditable.')

  const nums = [
    ['38', 'rutas de API', C.futuros],
    ['~80', 'módulos de lógica pura', C.peter],
    ['419', 'pruebas automáticas', C.oro],
    ['0', 'colas, workers o cachés distribuidas', C.gamma],
  ]
  nums.forEach(([v, e, col], i) => {
    const x = M + i * 3.05
    tarjeta(s, { x, y: 2.02, w: 2.85, h: 1.44, acento: col })
    cifra(s, { x: x + 0.28, y: 2.18, w: 2.4, valor: v, etiqueta: e, color: col, tam: 32 })
  })

  tarjeta(s, { x: M, y: 3.72, w: 5.92, h: 2.2, acento: C.peter })
  rotulo(s, { x: M + 0.3, y: 3.92, w: 5, txt: 'Por qué se separa así', color: C.peter, tam: 11 })
  parrafo(s, {
    x: M + 0.3,
    y: 4.24,
    w: 5.32,
    h: 1.56,
    tam: 12,
    txt: 'Todo lo que decide —el filtro de Peter, la puntuación de un contrato, el precio teórico de una opción, el cálculo del drawdown— está en funciones sin acceso a red ni a base de datos. Eso permite ejecutarlas miles de veces en un segundo y comprobar que dan el resultado esperado. Lo que toca el mundo exterior queda fuera, en una capa fina.',
  })

  tarjeta(s, { x: M + 6.14, y: 3.72, w: 5.92, h: 2.2, acento: C.oro })
  rotulo(s, { x: M + 6.44, y: 3.92, w: 5, txt: 'Qué está cubierto por pruebas', color: C.oro, tam: 11 })
  vinetas(s, {
    x: M + 6.44,
    y: 4.24,
    w: 5.32,
    h: 1.56,
    tam: 11.5,
    items: [
      'Valoración de opciones y griegas: 8 baterías',
      'Niveles de salida, liquidación y valoración de la cartera',
      'Métricas de portafolio: equity, drawdown, rentabilidad',
      'Autenticación del proceso automático y control de acceso',
    ],
  })
  decir(
    'Dónde corre la lógica',
    'Este es el motivo por el que el sistema es auditable. Todo lo que decide está en funciones puras: no tocan la red ni la base de datos, así que puedo ejecutarlas miles de veces y comprobar que dan lo que deben. Cuatrocientas diecinueve pruebas cubren la valoración de opciones, los niveles de salida, la liquidación al vencimiento y las métricas de cartera. Lo que sale al mundo exterior queda en una capa fina y separada.',
    'Veamos dónde vive todo esto.',
    'Recuento de route handlers y ficheros de src/lib; 419 casos en 31 ficheros de test (Vitest).',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 09 · Datos y despliegue
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('arquitectura')
  titulo(s, 'Dónde vive y quién lo despierta', 'Cuatro piezas de infraestructura, cada una con un papel.')

  const piezas = [
    {
      t: 'SUPABASE',
      c: C.peter,
      sub: 'Base de datos y autenticación',
      d: '18 migraciones versionadas. Seguridad a nivel de fila activada en todas las tablas: aunque alguien esquive la comprobación de la aplicación, la base de datos sigue negando el acceso.',
    },
    {
      t: 'GITHUB',
      c: C.suave,
      sub: 'Repositorio y reloj',
      d: 'Además de guardar el código, es quien despierta al sistema: cada 30 minutos, de lunes a viernes, lanza la revisión de las posiciones abiertas.',
    },
    {
      t: 'RENDER',
      c: C.gamma,
      sub: 'Los dos servicios',
      d: 'Un plano declarativo levanta la aplicación Node y el servicio Python privado, y les inyecta la clave compartida sin que nadie la escriba a mano.',
    },
    {
      t: 'VERCEL',
      c: C.futuros,
      sub: 'Publicación del panel',
      d: 'Cada cambio en la rama principal publica una versión nueva del panel, con la anterior siempre disponible para volver atrás.',
    },
  ]
  piezas.forEach((p, i) => {
    const x = M + i * 3.05
    tarjeta(s, { x, y: 2.02, w: 2.85, h: 3.0, acento: p.c })
    rotulo(s, { x: x + 0.26, y: 2.24, w: 2.4, txt: p.t, color: p.c, tam: 11 })
    s.addText(p.sub, {
      x: x + 0.24,
      y: 2.54,
      w: 2.44,
      h: 0.46,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 12.5,
      bold: true,
      color: C.texto,
      valign: 'top',
    })
    s.addText(p.d, {
      x: x + 0.24,
      y: 3.06,
      w: 2.44,
      h: 1.82,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 10.5,
      color: C.suave,
      valign: 'top',
      lineSpacingMultiple: 1.14,
    })
  })

  tarjeta(s, { x: M, y: 5.24, w: 12.06, h: 0.86, acento: C.oro })
  s.addText(
    [
      { text: 'Un detalle revelador:  ', options: { bold: true, color: C.oro } },
      {
        text: 'el reloj está en GitHub y no en el proveedor de hosting porque el plan gratuito de éste solo permite una ejecución diaria, y las posiciones de opciones hay que vigilarlas durante la sesión. Se resolvió sin añadir coste.',
        options: { color: C.suave },
      },
    ],
    {
      x: M + 0.3,
      y: 5.24,
      w: 11.5,
      h: 0.86,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 12,
      valign: 'middle',
    },
  )
  decir(
    'Dónde vive y quién lo despierta',
    'Cuatro piezas. Supabase guarda los datos y controla el acceso, con seguridad a nivel de fila: si alguien esquiva la comprobación de la aplicación, la base de datos sigue diciendo que no. GitHub guarda el código y además hace de reloj. Render levanta los dos servicios. Y Vercel publica el panel. El detalle de abajo me gusta contarlo porque resume la filosofía: necesitábamos vigilar las opciones cada media hora, el plan gratuito solo daba una vez al día, y se resolvió moviendo el reloj a GitHub. Sin añadir un euro.',
    'Y todo esto está construido sobre software libre.',
    '.github/workflows/review-exits.yml, render.yaml, supabase/migrations, políticas RLS de las migraciones 016 y 018.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 10 · Software libre utilizado
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('arquitectura')
  titulo(s, 'Construido sobre software libre', 'Todo el material de base es abierto y gratuito. El coste está en el criterio, no en las licencias.')

  const grupos = [
    ['Aplicación', C.futuros, ['Next.js 16.2.1', 'React 19.2.4', 'TypeScript 5', 'Tailwind CSS v4', 'shadcn/ui']],
    ['Datos y cálculo', C.peter, ['yahoo-finance2', 'mathjs', 'SheetJS', 'docx', 'Recharts']],
    ['Ciencia (Python)', C.gamma, ['DoWhy', 'EconML', 'statsmodels', 'scikit-learn', 'PyPortfolioOpt']],
    ['Calidad', C.oro, ['Vitest', 'Testing Library', 'ESLint 9']],
  ]
  grupos.forEach((g, i) => {
    const [t, col, libs] = g
    const x = M + i * 3.05
    rotulo(s, { x, y: 2.12, w: 2.85, txt: t, color: col, tam: 10.5 })
    libs.forEach((l, j) => {
      pildora(s, { x, y: 2.46 + j * 0.46, w: 2.6, h: 0.36, txt: l, color: col })
    })
  })

  tarjeta(s, { x: M, y: 4.86, w: 12.06, h: 1.24, acento: C.oro, alta: true })
  rotulo(s, { x: M + 0.3, y: 5.02, w: 8, txt: 'Lo que no se tomó prestado', color: C.oro, tam: 11 })
  s.addText(
    'El modelo de valoración de opciones está escrito a mano —Black-Scholes, sus griegas y la aproximación de la normal— en lugar de importar una librería. Es la pieza de la que dependen las decisiones de Gamma y Theta, así que tenía que ser código propio, legible y cubierto por pruebas.',
    {
      x: M + 0.3,
      y: 5.3,
      w: 11.5,
      h: 0.72,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 12.5,
      color: C.suave,
      valign: 'top',
      lineSpacingMultiple: 1.12,
    },
  )
  decir(
    'Construido sobre software libre',
    'Todo el material de base es abierto y gratuito: Next, React, las librerías de datos, el ecosistema científico de Python y las herramientas de calidad. Cero coste de licencias. Pero fijaos en el recuadro de abajo, porque es una decisión deliberada: el modelo de valoración de opciones no se importó de ninguna librería, está escrito a mano. Es la pieza de la que cuelgan todas las decisiones de Gamma y Theta. De eso quería tener el control y poder enseñar la prueba.',
    'Ya sabemos dónde vive. Ahora, cómo piensa.',
    'package.json y package-lock.json (versiones exactas), requirements.txt del servicio Python, src/lib/options/blackScholes.ts.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 11 · El embudo común
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('los agentes')
  titulo(s, 'Todos siguen el mismo embudo', 'Cada paso descarta. Ningún paso rescata.')

  const pasos = [
    ['0', 'Revisar lo que ya está abierto', 'Antes de buscar nada nuevo, comprueba si lo que tiene sigue mereciendo estar ahí', C.mal],
    ['1', 'Filtro propio del agente', 'Fundamentales en acciones; cadena de opciones y liquidez en derivados', C.futuros],
    ['2', 'Proyección a 30 días', 'Regresión sobre los últimos 60 cierres, mezclada con una media exponencial', C.peter],
    ['3', 'Momentum', 'Fuerza relativa, cruce de medias y volumen: hacen falta 2 de 3', C.small],
    ['4', 'Confirmación con lenguaje', 'Tres papeles —técnico, fundamental y gestor— con convicción mínima de 7 sobre 10', C.gamma],
    ['5', 'Alta registrada', 'Precio real de entrada, objetivo, stop y motivo, en una sola tabla auditable', C.oro],
  ]
  const anchoMax = 12.06
  pasos.forEach(([num, t, d, col], i) => {
    const y = 2.06 + i * 0.62
    const w = anchoMax - i * 0.82
    const x = M + (anchoMax - w) / 2
    s.addShape(pres.shapes.RECTANGLE, {
      x,
      y,
      w,
      h: 0.54,
      fill: { color: C.panel },
      line: { color: col, width: 1 },
    })
    s.addShape(pres.shapes.RECTANGLE, {
      x,
      y,
      w: 0.42,
      h: 0.54,
      fill: { color: col },
      line: { color: col, width: 0 },
    })
    s.addText(num, {
      x,
      y,
      w: 0.42,
      h: 0.54,
      margin: 0,
      align: 'center',
      valign: 'middle',
      fontFace: F.dato,
      fontSize: 14,
      bold: true,
      color: C.fondoAlt,
    })
    s.addText(t, {
      x: x + 0.58,
      y,
      w: 3.4,
      h: 0.54,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 12.5,
      bold: true,
      color: C.texto,
      valign: 'middle',
    })
    s.addText(d, {
      x: x + 4.06,
      y,
      w: w - 4.26,
      h: 0.54,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 10.5,
      color: C.suave,
      valign: 'middle',
    })
  })

  tarjeta(s, { x: M, y: 5.86, w: 12.06, h: 0.66, acento: C.oro, alta: true })
  s.addText(
    [
      { text: 'El embudo se estrecha:  ', options: { bold: true, color: C.oro } },
      {
        text: 'de cientos de candidatos a unos pocos. Casi todas las ejecuciones terminan sin ninguna recomendación, y eso es exactamente el comportamiento correcto.',
        options: { color: C.suave },
      },
    ],
    { x: M + 0.3, y: 5.86, w: 11.5, h: 0.66, margin: 0, fontFace: F.cuerpo, fontSize: 12.5, valign: 'middle' },
  )
  decir(
    'El embudo común',
    'Los cuatro agentes comparten este esqueleto de seis pasos. Empiezan por revisar lo que ya tienen abierto, antes de mirar nada nuevo. Después aplican su filtro propio, una proyección a treinta días, un chequeo de momentum, una confirmación con lenguaje y, si sobrevive, el alta registrada. La regla clave está en el subtítulo: cada paso descarta y ningún paso rescata. Y en la columna de la derecha, algo que conviene decir en voz alta: la mayoría de las ejecuciones no producen ninguna recomendación. Eso no es un fallo, es el filtro funcionando.',
    'Veámoslo aplicado, empezando por Peter.',
    'Estructura común de run() en AgentePeter.tsx, AgenteSmall.tsx, AgenteGamma.tsx y AgenteTheta.tsx.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Plantilla de lámina de agente
// ─────────────────────────────────────────────────────────────────────────────
function laminaAgente({ tag, nombre, color, subtitulo, flujo, criterios, tituloCriterios, pie }) {
  const s = lamina(tag)
  titulo(s, nombre, subtitulo)

  const y0 = 2.12
  flujo.forEach((paso, i) => {
    const x = M + i * 2.46
    nodo(s, { x, y: y0, w: 2.2, h: 1.26, titulo: paso[0], detalle: paso[1], acento: color })
    if (i < flujo.length - 1) flechaDer(s, { x: x + 2.26, y: y0 + 0.52, color })
  })

  rotulo(s, { x: M, y: 3.72, w: 8, txt: tituloCriterios, color, tam: 11 })
  tabla(s, {
    x: M,
    y: 4.02,
    w: 12.06,
    cabecera: criterios.cabecera,
    filas: criterios.filas,
    colW: criterios.colW,
    alinear: ['left', 'right', 'left'],
    alturaFila: 0.34,
    tam: 11,
  })
  if (pie) nota(s, pie)
  return s
}

// ─────────────────────────────────────────────────────────────────────────────
// 12 · Agente Peter
// ─────────────────────────────────────────────────────────────────────────────
{
  laminaAgente({
    tag: 'los agentes',
    nombre: 'Agente Peter · el analista fundamental',
    color: C.peter,
    subtitulo: 'Busca compañías buenas a precio razonable, y solo las compra si además el mercado ya se está moviendo a favor.',
    flujo: [
      ['1 · Universo', '443 valores\nS&P 500 + NASDAQ 100'],
      ['2 · Criba Lynch', 'Los 6 criterios\nsin excepción'],
      ['3 · Proyección', 'Retorno esperado\na 30 días ≥ +2 %'],
      ['4 · Momentum', '2 de 3 señales\nde precio y volumen'],
      ['5 · Juicio', 'Convicción ≥ 7/10\ny dirección de compra'],
    ],
    tituloCriterios: 'Los seis criterios, con sus umbrales reales',
    criterios: {
      cabecera: ['Criterio', 'Umbral', 'Qué evita'],
      colW: [3.4, 2.2, 6.46],
      filas: [
        ['Precio / beneficio actual', '< 25', { text: 'Pagar de más por el beneficio de hoy', color: C.suave }],
        ['Precio / beneficio esperado', '< 15', { text: 'Que el crecimiento futuro ya esté en el precio', color: C.suave }],
        ['Deuda neta sobre capitalización', '< 0,35', { text: 'Compañías que dependen del crédito para existir', color: C.suave }],
        ['Crecimiento del beneficio', '> 15 %', { text: 'Negocios estancados que parecen baratos', color: C.suave }],
        ['PEG (precio / crecimiento)', '< 2', { text: 'Crecimiento caro disfrazado de calidad', color: C.suave }],
        ['Capitalización', '≥ $5.000 M', { text: 'Valores sin liquidez para entrar y salir', color: C.suave }],
      ],
    },
    pie: 'Y la venta también es automática: si al revisar la posición fallan 2 de las 3 condiciones (fundamentales, proyección y momentum), se cierra y se registra la rentabilidad. No hay toma de beneficios discrecional.',
  })
  decir(
    'Agente Peter',
    'Peter recorre 443 grandes compañías y les exige los seis criterios completos. Los umbrales están a la vista, y en la columna de la derecha he puesto qué evita cada uno, que es lo que de verdad importa: el PEG evita el crecimiento caro disfrazado de calidad, la deuda neta evita empresas que solo existen mientras haya crédito barato. Pero cumplir fundamentales no basta: además exige que la proyección a treinta días sea de al menos un dos por ciento y que dos de tres señales de momentum acompañen. Y la venta es igual de automática: si fallan dos de las tres condiciones, cierra.',
    'Small es el mismo motor, con la vara a otra altura.',
    'src/lib/peter-lynch/screener.ts (LARGE_CAP_OPTIONS), AgentePeter.tsx (corte 6/6, failCount ≥ 2), /api/agentes/forecast y /momentum.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 13 · Agente Small
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('los agentes')
  titulo(s, 'Agente Small · el mismo motor, otra vara', 'En pequeña capitalización, exigir la perfección deja la lista vacía. Se baja el listón a propósito y se documenta.')

  tabla(s, {
    x: M,
    y: 2.06,
    w: 7.9,
    cabecera: ['Criterio', 'Peter', 'Small'],
    colW: [3.8, 1.85, 2.25],
    alturaFila: 0.38,
    tam: 11.5,
    filas: [
      ['Universo', '443', '307'],
      ['Precio / beneficio', '< 25', { text: '< 20', color: C.small }],
      ['Precio / beneficio esperado', '< 15', { text: '< 18', color: C.small }],
      ['Deuda neta / capitalización', '< 0,35', { text: '< 0,50', color: C.small }],
      ['Crecimiento del beneficio', '> 15 %', '> 15 %'],
      ['PEG', '< 2', { text: '< 1,5', color: C.small }],
      ['Capitalización', '≥ $5.000 M', { text: '$100 M – $2.000 M', color: C.small }],
      [
        { text: 'Criterios exigidos' },
        { text: '6 de 6', bold: true, color: C.peter },
        { text: '4 de 6', bold: true, color: C.small },
      ],
    ],
  })

  tarjeta(s, { x: M + 8.16, y: 2.06, w: 3.9, h: 1.72, acento: C.small })
  rotulo(s, { x: M + 8.44, y: 2.24, w: 3.3, txt: 'Por qué se relaja', color: C.small, tam: 11 })
  parrafo(s, {
    x: M + 8.44,
    y: 2.56,
    w: 3.36,
    h: 1.1,
    tam: 11.5,
    txt: 'Una empresa pequeña rara vez es barata, poco endeudada y de alto crecimiento a la vez. Con el listón de Peter, el filtro devuelve cero candidatos casi siempre.',
  })

  tarjeta(s, { x: M + 8.16, y: 3.90, w: 3.9, h: 2.18, acento: C.mal })
  rotulo(s, { x: M + 8.44, y: 4.08, w: 3.3, txt: 'Lo que cuesta relajarlo', color: C.mal, tam: 11 })
  parrafo(s, {
    x: M + 8.44,
    y: 4.40,
    w: 3.36,
    h: 1.6,
    tam: 10.5,
    txt: 'Menos exigencia significa más candidatos y más falsos positivos. Se compensa por el otro lado: mismo umbral de proyección, mismo momentum y misma convicción mínima de 7. La relajación afecta al filtro, nunca al tamaño de la apuesta.',
  })
  nota(
    s,
    'La categoría se sigue guardando en base de datos como SMALL_CAPS por continuidad histórica de los registros anteriores al cambio de nombre.',
  )
  decir(
    'Agente Small',
    'Small es el mismo motor con la vara a otra altura, y quiero ser explícito en por qué. Una empresa pequeña rara vez es barata, poco endeudada y de alto crecimiento a la vez; con el listón de Peter, el filtro devuelve cero candidatos casi siempre. Así que se baja: PEG uno y medio en lugar de dos, cuatro criterios de seis en lugar de seis. Eso tiene un coste, más falsos positivos, y se compensa por el otro lado: el momentum, la proyección y la convicción mínima son idénticos, y el ticket es el mismo. Relajamos el filtro, nunca el tamaño de la apuesta.',
    'Pasamos a la mesa de opciones.',
    'src/lib/peter-lynch/screener.ts (SMALL_CAP_OPTIONS), AgenteSmall.tsx (corte ≥ 4/6), src/lib/agentes/types.ts.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 14 · Agente Gamma
// ─────────────────────────────────────────────────────────────────────────────
{
  laminaAgente({
    tag: 'los agentes',
    nombre: 'Agente Gamma · convicción apalancada',
    color: C.gamma,
    subtitulo: 'No busca ideas nuevas: coge las que Peter y Small ya han aprobado y las traduce a un contrato de opciones.',
    flujo: [
      ['1 · Universo', 'Las posiciones vivas\nde Peter y Small'],
      ['2 · Dirección', '≥ +2 % compra call\n≤ −3 % compra put'],
      ['3 · Cadena', 'Strikes a ±25 %\nvencimientos 21-75 días'],
      ['4 · Calidad', 'Delta, plazo y\npuntuación ≥ 50'],
      ['5 · Juicio', 'Convicción ≥ 7/10\nsobre el contrato'],
    ],
    tituloCriterios: 'Cómo se elige el contrato concreto',
    criterios: {
      cabecera: ['Decisión', 'Regla', 'Razón'],
      colW: [3.4, 2.5, 6.16],
      filas: [
        ['Zona muerta de dirección', 'entre −3 % y +2 %', { text: 'Sin convicción clara no se paga prima', color: C.suave }],
        ['Sensibilidad al precio (delta)', '0,30 – 0,65', { text: 'Ni lotería barata ni acción disfrazada', color: C.suave }],
        ['Días hasta el vencimiento', '21 – 90', { text: 'Tiempo para que la tesis se cumpla', color: C.suave }],
        ['Puntuación del contrato', '≥ 50 sobre 100', { text: 'Liquidez, plazo y prima justa frente al valor teórico', color: C.suave }],
        ['Objetivo y stop', '×2,5 y ×0,5 la prima', { text: 'Fijados al abrir, no negociados después', color: C.suave }],
      ],
    },
    pie: 'Las griegas no se toman de la fuente de datos: se recalculan con el modelo propio a partir de la volatilidad implícita publicada, para que el criterio no dependa de un campo ajeno que puede venir vacío o mal.',
  })
  decir(
    'Agente Gamma',
    'Gamma es el más interesante en cuanto a diseño, porque no tiene universo propio: trabaja sobre lo que Peter y Small ya han aprobado. La mesa de opciones se apoya en el trabajo de la mesa de acciones. Después decide dirección, y fijaos en la zona muerta: si la proyección está entre menos tres y más dos por ciento, no hace nada. Sin convicción no se paga prima. Luego elige el contrato con una delta de entre treinta y sesenta y cinco: ni lotería barata ni una acción disfrazada. Y el objetivo y el stop se fijan al abrir, no se negocian después.',
    'Theta juega al otro lado de la mesa.',
    'AgenteGamma.tsx (universo desde picks vivos, umbrales de dirección y filtro de calidad), src/lib/options/{analyzer,yahoo-options,exit-levels}.ts.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 15 · Agente Theta
// ─────────────────────────────────────────────────────────────────────────────
{
  laminaAgente({
    tag: 'los agentes',
    nombre: 'Agente Theta · cobrar el paso del tiempo',
    color: C.theta,
    subtitulo: 'No apuesta por una dirección: vende prima cara y deja que el tiempo trabaje. Su riesgo no es equivocarse de rumbo, es un movimiento brusco.',
    flujo: [
      ['1 · Universo', '36 subyacentes\nlíquidos, lista fija'],
      ['2 · Seguridad', 'Descarta si se prevé\nun movimiento adverso'],
      ['3 · Estrategia', 'Put vendida o\ncall cubierta'],
      ['4 · Prima', 'Volatilidad > 30 %\ny puntuación ≥ 60'],
      ['5 · Juicio', 'Convicción ≥ 7/10\nsobre el riesgo'],
    ],
    tituloCriterios: 'El filtro de la prima: por qué es más exigente que el de Gamma',
    criterios: {
      cabecera: ['Decisión', 'Regla', 'Razón'],
      colW: [3.4, 2.5, 6.16],
      filas: [
        ['Volatilidad implícita', '> 30 %', { text: 'Vender prima barata es asumir riesgo sin cobrarlo', color: C.suave }],
        ['Sensibilidad al precio (delta)', '0,15 – 0,35', { text: 'Probabilidad alta de que expire sin valor', color: C.suave }],
        ['Días hasta el vencimiento', '21 – 45', { text: 'El tramo donde el tiempo se paga más rápido', color: C.suave }],
        ['Puntuación del contrato', '≥ 60 sobre 100', { text: 'Diez puntos por encima de Gamma: el riesgo es asimétrico', color: C.suave }],
        ['Objetivo y stop', 'recomprar al 50 % / cortar al 200 %', { text: 'No se espera al vencimiento por costumbre', color: C.suave }],
      ],
    },
    pie: 'El filtro de seguridad direccional no busca acertar: solo descarta vender una put cuando se anticipa una caída superior al 5 %, o una call cubierta cuando se anticipa una subida superior al 8 %.',
  })
  decir(
    'Agente Theta',
    'Theta está al otro lado de la mesa: no apuesta por una dirección, vende prima y deja que el tiempo trabaje. Su riesgo es asimétrico, cobra poco muchas veces y puede perder mucho una vez, y por eso su listón es más alto: puntuación sesenta frente a los cincuenta de Gamma. Exige volatilidad por encima del treinta por ciento, porque vender prima barata es asumir riesgo sin cobrarlo. Y tiene un filtro de seguridad que no pretende acertar la dirección: solo se niega a vender una put si se anticipa una caída fuerte. Es una red, no una predicción.',
    'Detrás de esos filtros hay un motor de puntuación. Merece un minuto.',
    'AgenteTheta.tsx (36 subyacentes, filtros IV/DTE/delta/score, umbrales de seguridad), src/lib/options/exit-levels.ts.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 16 · Motor de puntuación
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('los agentes')
  titulo(s, 'Cómo se puntúa una opción', 'Todo contrato parte de 50 puntos y sube o baja según seis factores. Es lo que impide elegir «la opción que más se mueve».')

  // Diagrama de barras divergentes dibujado a mano: el gráfico nativo apila las
  // etiquetas de categoría sobre las barras negativas y las vuelve ilegibles.
  const factores = [
    ['Liquidez sobrada', 18],
    ['Delta en el rango objetivo', 14],
    ['Ubicación técnica favorable', 12],
    ['Prima barata frente al valor teórico', 10],
    ['Vencimiento óptimo', 10],
    ['Sesgo fundamental a favor', 8],
    ['Sesgo fundamental en contra', -5],
    ['Delta fuera de rango', -10],
    ['Prima cara frente al valor teórico', -10],
    ['Vencimiento demasiado corto', -18],
    ['Liquidez insuficiente', -28],
    ['Tipo de contrato erróneo', -45],
  ]
  const bx = M + 3.9 // inicio de la zona de barras
  const bw = 3.0 // ancho de la zona de barras
  const vMin = -45
  const vMax = 18
  const cero = bx + ((0 - vMin) / (vMax - vMin)) * bw
  const alto = 0.27
  const y0b = 2.2

  s.addShape(pres.shapes.LINE, {
    x: cero,
    y: y0b - 0.14,
    w: 0,
    h: factores.length * alto + 0.2,
    line: { color: C.borde, width: 1 },
  })

  factores.forEach(([nom, v], i) => {
    const y = y0b + i * alto
    const largo = (Math.abs(v) / (vMax - vMin)) * bw
    const positivo = v > 0
    const col = positivo ? C.futuros : C.mal
    s.addShape(pres.shapes.RECTANGLE, {
      x: positivo ? cero : cero - largo,
      y: y + 0.05,
      w: largo,
      h: alto - 0.1,
      fill: { color: col },
      line: { color: col, width: 0 },
    })
    s.addText(nom, {
      x: M,
      y,
      w: 3.1,
      h: alto,
      margin: 0,
      align: 'right',
      fontFace: F.cuerpo,
      fontSize: 9.5,
      color: C.suave,
      valign: 'middle',
    })
    s.addText(`${v > 0 ? '+' : '−'}${Math.abs(v)}`, {
      x: positivo ? cero + largo + 0.06 : cero - largo - 0.66,
      y,
      w: 0.6,
      h: alto,
      margin: 0,
      align: positivo ? 'left' : 'right',
      fontFace: F.dato,
      fontSize: 10,
      bold: true,
      color: col,
      valign: 'middle',
    })
  })
  s.addText('puntos sobre la base de 50', {
    x: bx,
    y: y0b + factores.length * alto + 0.08,
    w: bw,
    h: 0.3,
    margin: 0,
    align: 'center',
    fontFace: F.cuerpo,
    fontSize: 10,
    italic: true,
    color: C.tenue,
    valign: 'middle',
  })

  tarjeta(s, { x: M + 7.76, y: 2.18, w: 4.3, h: 1.82, acento: C.oro })
  rotulo(s, { x: M + 8.04, y: 2.36, w: 3.7, txt: 'Prima justa', color: C.oro, tam: 11 })
  parrafo(s, {
    x: M + 8.04,
    y: 2.68,
    w: 3.76,
    h: 1.2,
    tam: 11.5,
    txt: 'El sistema compara la prima que pide el mercado con la que arroja el modelo propio. Por debajo del 0,88 la considera barata; por encima del 1,15, cara. Comprar caro o vender barato resta puntos.',
  })

  tarjeta(s, { x: M + 7.76, y: 4.16, w: 4.3, h: 1.88, acento: C.mal })
  rotulo(s, { x: M + 8.04, y: 4.34, w: 3.7, txt: 'El veto de la liquidez', color: C.mal, tam: 11 })
  parrafo(s, {
    x: M + 8.04,
    y: 4.66,
    w: 3.76,
    h: 1.28,
    tam: 11.5,
    txt: 'Si un contrato no tiene interés abierto, volumen y una horquilla razonable, su puntuación queda limitada a 40 por bueno que sea todo lo demás. Un contrato del que no se puede salir no es una oportunidad.',
  })
  decir(
    'Cómo se puntúa una opción',
    'Aquí está el motor que hay detrás de Gamma y Theta. Todo contrato parte de cincuenta puntos y se mueve según seis factores. En rojo, lo que resta: elegir el tipo equivocado son cuarenta y cinco puntos, la falta de liquidez veintiocho. En azul, lo que suma. Y las dos tarjetas de la derecha son las importantes. La primera: el sistema compara la prima que pide el mercado con la que dice su propio modelo, y penaliza comprar caro o vender barato. La segunda es un veto: si de un contrato no se puede salir, su puntuación queda limitada a cuarenta por bueno que sea todo lo demás. Un contrato ilíquido no es una oportunidad, es una trampa.',
    'Y una vez abierta la posición, ¿quién la vigila?',
    'src/lib/options/strategy-scoring.ts (base 50 y todos los deltas), src/lib/options/pricing.ts (umbrales 0,88 y 1,15).',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 17 · Ciclo de vida de la recomendación
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('los agentes')
  titulo(s, 'Qué pasa después de recomendar', 'La diferencia entre una lista de ideas y una mesa que gestiona.')

  const hitos = [
    ['ALTA', 'Se registra con precio real, objetivo, stop y motivo. Si ya existe una posición viva del mismo valor, no se duplica.', C.peter],
    ['CADA 30 MIN', 'Durante la sesión, un proceso automático cotiza cada contrato abierto por el punto medio de horquilla y compara con sus niveles.', C.futuros],
    ['SALIDA', 'Si toca objetivo o stop, se cierra y se registra la rentabilidad y la fecha. En acciones, el cierre lo dispara el deterioro de 2 de 3 condiciones.', C.theta],
    ['VENCIMIENTO', 'Los contratos que expiran se liquidan a su valor intrínseco real contra el cierre del subyacente de ese día, no a una estimación.', C.gamma],
  ]
  hitos.forEach(([t, d, col], i) => {
    const x = M + i * 3.05
    tarjeta(s, { x, y: 2.16, w: 2.85, h: 2.5, acento: col })
    s.addShape(pres.shapes.OVAL, {
      x: x + 0.26,
      y: 2.38,
      w: 0.34,
      h: 0.34,
      fill: { color: col },
      line: { color: col, width: 0 },
    })
    s.addText(String(i + 1), {
      x: x + 0.26,
      y: 2.38,
      w: 0.34,
      h: 0.34,
      margin: 0,
      align: 'center',
      valign: 'middle',
      fontFace: F.dato,
      fontSize: 12,
      bold: true,
      color: C.fondoAlt,
    })
    rotulo(s, { x: x + 0.7, y: 2.4, w: 2.0, txt: t, color: col, tam: 10.5 })
    s.addText(d, {
      x: x + 0.26,
      y: 2.88,
      w: 2.42,
      h: 1.6,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 11,
      color: C.suave,
      valign: 'top',
      lineSpacingMultiple: 1.14,
    })
  })

  tarjeta(s, { x: M, y: 4.9, w: 12.06, h: 1.1, acento: C.oro })
  s.addText(
    [
      { text: 'El detalle que separa un prototipo de una mesa:  ', options: { bold: true, color: C.oro } },
      {
        text: 'la liquidación al vencimiento se hace contra el precio real de cierre del subyacente. Suena obvio, pero una versión anterior daba por bueno un ±100 % fijo, y esa cifra falsa se habría propagado a todas las estadísticas de la cartera.',
        options: { color: C.suave },
      },
    ],
    { x: M + 0.3, y: 4.9, w: 11.5, h: 1.1, margin: 0, fontFace: F.cuerpo, fontSize: 12, valign: 'middle', lineSpacingMultiple: 1.12 },
  )
  decir(
    'Qué pasa después de recomendar',
    'Cuatro momentos. Alta, con precio real y sin duplicar posiciones. Vigilancia cada treinta minutos durante la sesión, cotizando por el punto medio de la horquilla, no por el último cruce, que puede ser de hace horas. Salida por objetivo o stop. Y liquidación al vencimiento contra el cierre real del subyacente. Ese último punto lo destaco porque una versión anterior daba por bueno un más o menos cien por cien fijo, y esa cifra falsa se habría propagado a todas las estadísticas de la cartera. Se detectó y se corrigió. Este tipo de errores son los que separan un prototipo de una mesa.',
    'Y ahora la pregunta que me haríais vosotros.',
    'src/lib/options/{review-exits,exit-review-core,settle-picks,quote-contracts}.ts; dedup en /api/agentes/picks; cron cada 30 min en GitHub Actions.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 18 · Por qué no hay backtesting en los agentes
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('la pregunta incómoda', { oscura: true })
  titulo(
    s,
    'Estos cuatro agentes no tienen backtest',
    'Y no es una tarea pendiente: es una decisión, y prefiero explicarla antes de que me la preguntéis.',
  )

  const razones = [
    {
      t: 'RAZÓN 1 · Los fundamentales no tienen memoria',
      d: 'La fuente de datos devuelve el PER, el PEG y la deuda de HOY. No los que se publicaron en 2019. Si simulase el filtro de Peter sobre 2019 con los datos de hoy, el sistema estaría eligiendo empresas sabiendo ya cómo acabó la historia.',
      etiqueta: 'Sesgo de anticipación',
    },
    {
      t: 'RAZÓN 2 · El universo son los supervivientes',
      d: 'La lista de 443 y 307 valores contiene los que están en el índice hoy. Las compañías que quebraron o fueron excluidas no aparecen. Un backtest sobre esa lista solo puede mirar a las que sobrevivieron.',
      etiqueta: 'Sesgo de supervivencia',
    },
  ]
  razones.forEach((r, i) => {
    const x = M + i * 6.14
    tarjeta(s, { x, y: 2.2, w: 5.92, h: 2.34, acento: C.mal, alta: true })
    s.addText(r.t, {
      x: x + 0.3,
      y: 2.38,
      w: 5.3,
      h: 0.36,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 13.5,
      bold: true,
      color: C.texto,
      valign: 'middle',
    })
    parrafo(s, { x: x + 0.3, y: 2.82, w: 5.34, h: 1.32, tam: 11.5, txt: r.d })
    pildora(s, { x: x + 0.3, y: 4.1, w: 2.5, txt: r.etiqueta, color: C.mal })
  })

  tarjeta(s, { x: M, y: 4.76, w: 12.06, h: 1.24, acento: C.oro, alta: true })
  s.addText(
    'Un backtest construido así no daría un resultado dudoso: daría un resultado espectacular y falso. Y una cifra falsa con la que decidir es peor que no tener cifra.',
    {
      x: M + 0.34,
      y: 4.84,
      w: 11.4,
      h: 0.56,
      margin: 0,
      fontFace: F.tit,
      fontSize: 17,
      bold: true,
      color: C.oro,
      valign: 'middle',
    },
  )
  s.addText(
    'Lo que sí es verificable —la proyección y el momentum, que solo usan precio y volumen— está cubierto por pruebas automáticas. Lo que no se puede medir con honestidad, no se presenta medido.',
    {
      x: M + 0.34,
      y: 5.42,
      w: 11.4,
      h: 0.48,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 12,
      color: C.suave,
      valign: 'middle',
    },
  )
  decir(
    'Por qué no hay backtest en los agentes',
    'Aquí viene la parte incómoda, y prefiero decirla yo antes de que me la preguntéis. Estos cuatro agentes no tienen backtest. Y no es una tarea pendiente, es una decisión. Dos razones. La primera: la fuente devuelve los fundamentales de hoy, no los de 2019. Simular el filtro sobre 2019 con datos de hoy es elegir empresas sabiendo ya cómo acabó la historia. La segunda: la lista de valores son los que están en el índice hoy; los que quebraron no aparecen. Un backtest así no daría un resultado dudoso, daría un resultado espectacular y falso. Y una cifra falsa con la que decidir es peor que no tener cifra.',
    'Entonces, ¿sobre qué se apoya la confianza?',
    'PROGRESS.md, sección «Los agentes de acciones NO tienen backtest», y los avisos en las fichas de los cuatro agentes en la propia aplicación.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 19 · Por qué confiar capital
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('la pregunta incómoda')
  titulo(s, 'Entonces, ¿por qué confiarles dinero?', 'Porque lo que se compra es el proceso, no una promesa de rentabilidad.')

  const razones = [
    ['Criterio fijado antes', 'Los umbrales están escritos en el código antes de ver un solo resultado. No se ajustan después para que el número quede bonito.', C.peter],
    ['Cero discrecionalidad', 'El mismo dato de entrada produce la misma decisión el lunes y el viernes, con el mercado en calma o en pánico.', C.small],
    ['Precio siempre real', 'Nunca se registra una entrada estimada. Sin precio de mercado, no hay recomendación.', C.gamma],
    ['Trazabilidad completa', 'Cada alta guarda su motivo, su objetivo, su stop y su fuente. Cada cierre guarda su precio y su fecha.', C.theta],
    ['Riesgo acotado por diseño', 'Capital separado por mesa, ticket fijo y un contrato por señal. Un error no puede escalar.', C.futuros],
    ['Salida automática', 'Se vende por deterioro objetivo de las condiciones, no por corazonada ni por aguantar «a que se recupere».', C.oro],
  ]
  razones.forEach(([t, d, col], i) => {
    const x = M + (i % 3) * 4.08
    const y = 2.1 + Math.floor(i / 3) * 1.78
    tarjeta(s, { x, y, w: 3.86, h: 1.6, acento: col })
    s.addText(t, {
      x: x + 0.28,
      y: y + 0.16,
      w: 3.3,
      h: 0.34,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 13,
      bold: true,
      color: C.texto,
      valign: 'middle',
    })
    s.addText(d, {
      x: x + 0.28,
      y: y + 0.54,
      w: 3.34,
      h: 0.94,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 10.5,
      color: C.suave,
      valign: 'top',
      lineSpacingMultiple: 1.14,
    })
  })

  tarjeta(s, { x: M, y: 5.72, w: 12.06, h: 0.7, acento: C.oro, alta: true })
  s.addText(
    'La propuesta no es «esto gana un X %». Es: aquí está el criterio, aquí está el registro de cada decisión, y aquí está lo que todavía no sabemos.',
    {
      x: M + 0.32,
      y: 5.72,
      w: 11.5,
      h: 0.7,
      margin: 0,
      fontFace: F.tit,
      fontSize: 14.5,
      italic: true,
      color: C.oro,
      valign: 'middle',
    },
  )
  decir(
    'Por qué confiarles dinero',
    'Si no hay backtest, ¿sobre qué se apoya la confianza? Sobre seis cosas. El criterio está escrito antes de ver resultados y no se retoca después para que el número quede bonito. No hay discrecionalidad: mismo dato, misma decisión, en calma o en pánico. El precio de entrada siempre es real. Cada decisión deja rastro. El riesgo está acotado por diseño, con capital separado y ticket fijo. Y la salida es automática, por deterioro objetivo, no por aguantar a que se recupere. La frase de abajo es la propuesta entera: no os digo que esto gana un tanto por ciento. Os digo aquí está el criterio, aquí está el registro y aquí está lo que todavía no sabemos.',
    'Cambio de mesa. Los futuros sí se pueden medir, y se han medido.',
    'Síntesis de las reglas verificadas en el código de los cuatro agentes y en src/lib/portafolios/config.ts.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 20 · Las cinco fases
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('metodología', { oscura: true })
  titulo(
    s,
    'De la idea al capital: cinco fases',
    'En futuros sí existe histórico limpio de precios, así que aquí sí se puede medir. Y se mide con un protocolo fijo.',
  )

  const fases = [
    ['A', 'ESTRUCTURA', 'Se prueba el parámetro que define la estrategia (la ventana horaria, el umbral) contra todas sus alternativas razonables.', '¿Es la mejor elección o solo una elección?'],
    ['B', 'VECINDAD', 'Se mueven los parámetros alrededor del elegido. Si el vecino de al lado se derrumba, el resultado era un accidente.', '¿Sobrevive a que me equivoque un poco?'],
    ['C', 'FUERA DE MUESTRA', 'Se ejecuta sobre un tramo de historia que nunca se usó para elegir nada.', '¿Funciona donde no la he entrenado?'],
    ['D', 'REGÍMENES', 'Se parte la historia en bloques y se exige que la mayoría sean positivos.', '¿Depende de una sola época?'],
    ['E', 'SIMULADO', 'Se pone a operar en tiempo real, sin dinero, y se compara con lo prometido.', '¿Se comporta como decía el papel?'],
  ]
  fases.forEach(([letra, t, d, preg], i) => {
    const x = M + i * 2.44
    const col = i === 4 ? C.oro : C.futuros
    tarjeta(s, { x, y: 2.16, w: 2.28, h: 3.36, acento: col, alta: i === 4 })
    s.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.26,
      y: 2.38,
      w: 0.46,
      h: 0.46,
      fill: { color: col },
      line: { color: col, width: 0 },
    })
    s.addText(letra, {
      x: x + 0.26,
      y: 2.38,
      w: 0.46,
      h: 0.46,
      margin: 0,
      align: 'center',
      valign: 'middle',
      fontFace: F.tit,
      fontSize: 18,
      bold: true,
      color: C.fondoAlt,
    })
    rotulo(s, { x: x + 0.82, y: 2.44, w: 1.4, txt: t, color: col, tam: 9.5 })
    s.addText(d, {
      x: x + 0.26,
      y: 2.98,
      w: 1.84,
      h: 1.6,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 10.5,
      color: C.suave,
      valign: 'top',
      lineSpacingMultiple: 1.14,
    })
    s.addText(preg, {
      x: x + 0.26,
      y: 4.66,
      w: 1.84,
      h: 0.74,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 10.5,
      italic: true,
      color: col,
      valign: 'top',
      lineSpacingMultiple: 1.12,
    })
    if (i < 4) flechaDer(s, { x: x + 2.3, y: 3.7, color: C.tenue, w: 0.12 })
  })

  tarjeta(s, { x: M, y: 5.72, w: 12.06, h: 0.72, acento: C.mal })
  s.addText(
    [
      { text: 'La regla que sostiene todo el protocolo:  ', options: { bold: true, color: C.mal } },
      {
        text: 'el listón de aprobado se escribe ANTES de mirar el resultado. Si se fija después, el análisis deja de ser una prueba y pasa a ser una justificación.',
        options: { color: C.suave },
      },
    ],
    { x: M + 0.32, y: 5.72, w: 11.5, h: 0.72, margin: 0, fontFace: F.cuerpo, fontSize: 12.5, valign: 'middle' },
  )
  decir(
    'Las cinco fases',
    'Cambiamos de mesa. En futuros sí hay histórico limpio de precios, así que aquí sí se puede medir de verdad, y se mide con este protocolo de cinco fases. La A pregunta si el parámetro central es la mejor elección o solo una elección. La B mueve los parámetros alrededor: si el vecino de al lado se derrumba, el resultado era un accidente. La C ejecuta sobre historia que nunca se usó. La D parte la historia en bloques para ver si depende de una sola época. Y la E la pone a operar en tiempo real sin dinero. Pero la regla de verdad está abajo: el listón se escribe antes de mirar el resultado. Si se fija después, aquello deja de ser una prueba y pasa a ser una justificación.',
    'Conviene precisar tres términos que se confunden.',
    'Cabeceras de las seis estrategias en public/estrategias/code/*.cs; MARCO_COMUN de catalogo.ts.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 21 · In-sample, out-of-sample y walk-forward
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('metodología')
  titulo(s, 'Tres términos que se confunden', 'Y una lección aprendida cuatro veces.')

  const defs = [
    ['DENTRO DE MUESTRA', 'El tramo con el que se eligen los parámetros. Aquí todo se ve bien: es donde se ha buscado. Ningún resultado de esta fase demuestra nada.', C.tenue],
    ['FUERA DE MUESTRA', 'Un tramo apartado desde el principio y no tocado. Es el único juez real. Si la estrategia muere aquí, muere.', C.peter],
    ['WALK-FORWARD', 'Se repite el ciclo optimizar-validar deslizando una ventana por toda la historia. Simula al operador que reajusta cada cierto tiempo.', C.futuros],
  ]
  defs.forEach(([t, d, col], i) => {
    const x = M + i * 4.08
    tarjeta(s, { x, y: 2.1, w: 3.86, h: 1.86, acento: col })
    rotulo(s, { x: x + 0.28, y: 2.28, w: 3.3, txt: t, color: col, tam: 10.5 })
    parrafo(s, { x: x + 0.28, y: 2.62, w: 3.34, h: 1.2, tam: 11.5, txt: d })
  })

  tarjeta(s, { x: M, y: 4.2, w: 7.2, h: 1.9, acento: C.mal, alta: true })
  rotulo(s, { x: M + 0.3, y: 4.38, w: 6.4, txt: 'La lección, anotada en el propio código', color: C.mal, tam: 11 })
  s.addText('«Cuarta vez que el candidato del dentro-de-muestra muere en el fuera-de-muestra.»', {
    x: M + 0.3,
    y: 4.68,
    w: 6.62,
    h: 0.66,
    margin: 0,
    fontFace: F.tit,
    fontSize: 15,
    italic: true,
    color: C.texto,
    valign: 'middle',
    lineSpacingMultiple: 1.1,
  })
  parrafo(s, {
    x: M + 0.3,
    y: 5.36,
    w: 6.62,
    h: 0.6,
    tam: 11,
    txt: 'Comentario en la estrategia Weekend Effect. La configuración ganadora en la fase de búsqueda fue rechazada al validarla, y se quedó con la sencilla.',
  })

  tarjeta(s, { x: M + 7.46, y: 4.2, w: 4.6, h: 1.9, acento: C.oro })
  rotulo(s, { x: M + 7.74, y: 4.38, w: 4.0, txt: 'Cuándo el walk-forward no sirve', color: C.oro, tam: 11 })
  parrafo(s, {
    x: M + 7.74,
    y: 4.7,
    w: 4.06,
    h: 1.26,
    tam: 11,
    txt: 'En Overnight Drift las ventanas de validación daban cero operaciones, porque la media de 200 sesiones no cabía en el tramo. Se sustituyó por un corte directo en dos mitades, y se escribió por qué. Aplicar un método que no encaja y presentar su resultado sería el error más caro de todos.',
  })
  decir(
    'Tres términos que se confunden',
    'Tres definiciones rápidas. Dentro de muestra es el tramo donde se eligen los parámetros; ahí todo se ve bien porque es donde se ha buscado, y ningún resultado de esa fase demuestra nada. Fuera de muestra es el tramo apartado y no tocado: ese es el único juez. Y el walk-forward repite el ciclo deslizando una ventana. Abajo a la izquierda, un comentario literal del código: cuarta vez que el candidato del dentro-de-muestra muere en el fuera-de-muestra. Cuatro veces. Y a la derecha, algo igual de importante: hay un caso donde el walk-forward no era aplicable, se dijo por escrito y se usó otro método. Aplicar una técnica que no encaja y presentar su resultado sería el error más caro de todos.',
    'Antes del caso completo, el cementerio.',
    'Comentarios de cabecera de weekend-effect.cs y overnight-drift.cs.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 22 · El cementerio
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('metodología')
  titulo(s, 'Lo que se probó y no entró', 'Un proceso sin descartes no es un proceso: es una colección de aciertos contados a posteriori.')

  tabla(s, {
    x: M,
    y: 2.1,
    w: 12.06,
    cabecera: ['Idea descartada', 'Operaciones', 'Factor de beneficio', 'Motivo del descarte'],
    colW: [3.3, 1.35, 1.85, 5.56],
    alinear: ['left', 'right', 'right', 'left'],
    alturaFila: 0.38,
    tam: 11,
    filas: [
      ['RSI2 espejo en corto', '118', { text: '0,96', color: C.mal }, { text: 'El lado corto del mismo patrón no existe', color: C.suave }],
      ['Momentum sobre crudo', '82', { text: '0,71', color: C.mal }, { text: 'Premisa falsificada: 52 latigazos sin banda muerta', color: C.suave }],
      ['Spread RTY / ES en reversión', '59', { text: '0,80', color: C.mal }, { text: 'La ventaja ya era negativa antes de costes', color: C.suave }],
      ['Momentum del ratio RTY / ES', '19', { text: '1,01', color: C.mal }, { text: 'Indistinguible del azar', color: C.suave }],
      ['Oro tras caídas del S&P', '73', { text: '1,73', color: C.oro }, { text: 'Aprobaba el resumen; 3 operaciones eran el 85 % del beneficio', color: C.oro }],
      ['ORB Regime (retirado)', '1.423', { text: '—', color: C.suave }, { text: 'Con ventaja real, pero duplicaba al Momentum y disparaba el drawdown', color: C.suave }],
    ],
  })

  tarjeta(s, { x: M, y: 5.22, w: 5.92, h: 1.12, acento: C.mal })
  rotulo(s, { x: M + 0.3, y: 5.36, w: 5, txt: 'Lección de las cuatro primeras', color: C.mal, tam: 11 })
  parrafo(s, {
    x: M + 0.3,
    y: 5.66,
    w: 5.34,
    h: 0.62,
    tam: 11,
    txt: 'La descorrelación sin ventaja no vale nada. Un activo distinto no genera ventaja por el hecho de ser distinto.',
  })

  tarjeta(s, { x: M + 6.14, y: 5.22, w: 5.92, h: 1.12, acento: C.oro, alta: true })
  rotulo(s, { x: M + 6.44, y: 5.36, w: 5, txt: 'Lección del oro, la más útil', color: C.oro, tam: 11 })
  parrafo(s, {
    x: M + 6.44,
    y: 5.66,
    w: 5.34,
    h: 0.62,
    tam: 11,
    txt: 'El factor de beneficio no distingue una ventaja repetible de una cola derecha afortunada. La concentración sí. Por eso se mide siempre.',
  })
  decir(
    'El cementerio',
    'Esta lámina es, para mí, la más importante de la metodología. Un proceso sin descartes no es un proceso, es una colección de aciertos contados a posteriori. Aquí están seis ideas que no entraron, con sus cifras. Las cuatro primeras fallaron igual y dejan la misma lección: la descorrelación sin ventaja no vale nada. Un activo distinto no genera ventaja por ser distinto. Pero mirad la fila del oro, porque es la peligrosa: factor de beneficio uno coma setenta y tres, curva que sube, aprobaba el resumen. Lo que lo tumbó fue abrir la distribución: tres operaciones eran el ochenta y cinco por ciento del beneficio. El factor de beneficio no distingue una ventaja repetible de una racha afortunada. La concentración sí.',
    'Y ahora el caso completo, de principio a fin.',
    'src/lib/estrategias/cartera.ts, bloque DESCARTADOS y LECCION_DESCARTES; documento Portafolio_6_Bots_MNQ, apartados 9 y 9.1.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 23 · ZigZag: qué hace
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('caso zigzag', { oscura: true })
  titulo(s, 'Caso completo: ZigZag Breakout', 'Elijo esta y no otra a propósito: es la más débil de las seis. Si el método aguanta aquí, aguanta en todas.')

  tarjeta(s, { x: M, y: 2.14, w: 5.92, h: 2.06, acento: C.futuros, alta: true })
  rotulo(s, { x: M + 0.3, y: 2.3, w: 5, txt: 'Condición 1 · vela con fuerza', color: C.futuros, tam: 11 })
  parrafo(s, {
    x: M + 0.3,
    y: 2.62,
    w: 5.34,
    h: 1.4,
    tam: 12,
    txt: 'El cuerpo de la vela que rompe la zona debe ser al menos el 40 % de su recorrido total. Una vela con mecha larga y cuerpo pequeño está diciendo que la ruptura se está rechazando, no confirmando.',
  })

  tarjeta(s, { x: M + 6.14, y: 2.14, w: 5.92, h: 2.06, acento: C.futuros, alta: true })
  rotulo(s, { x: M + 6.44, y: 2.3, w: 5, txt: 'Condición 2 · camino limpio', color: C.futuros, tam: 11 })
  parrafo(s, {
    x: M + 6.44,
    y: 2.62,
    w: 5.34,
    h: 1.4,
    tam: 12,
    txt: 'Ninguna otra zona viva puede interponerse entre el precio de entrada y el objetivo proyectado. Si hay una zona en medio, el recorrido está bloqueado y la operación no se toma, por buena que parezca la señal.',
  })

  rotulo(s, { x: M, y: 4.38, w: 8, txt: 'Configuración de producción', color: C.oro, tam: 11 })
  tabla(s, {
    x: M,
    y: 4.68,
    w: 12.06,
    cabecera: ['Parámetro', 'Valor', 'Parámetro', 'Valor'],
    colW: [3.3, 2.7, 3.3, 2.76],
    alinear: ['left', 'right', 'left', 'right'],
    alturaFila: 0.34,
    tam: 11,
    filas: [
      ['Instrumento y gráfico', 'MNQ · 5 minutos', 'Objetivo', '2 veces el riesgo'],
      ['Desviación del ZigZag', '0,02 % del precio', 'Stop', 'Pivote anterior − 2 puntos'],
      ['Ventana de entrada', '09:30 – 10:30 Nueva York', 'Riesgo por operación', '$300 en MNQ'],
      ['Frecuencia máxima', 'Una operación al día', 'Dirección y tamaño', 'Solo largos · 1 contrato'],
    ],
  })
  decir(
    'Caso completo: ZigZag',
    'Voy a recorrer una estrategia entera, de principio a fin. Y elijo el ZigZag a propósito, porque es la más débil de las seis. Si el método aguanta con la peor, aguanta con todas. Qué hace: rompe zonas de soporte y resistencia, pero con dos condiciones que la separan de una ruptura corriente. La primera, la vela que rompe debe tener cuerpo: si es una mecha larga con cuerpo pequeño, el mercado está rechazando la ruptura, no confirmándola. La segunda, el camino hasta el objetivo tiene que estar despejado; si hay otra zona en medio, no se toma la operación. Abajo, la configuración exacta con la que corre.',
    'Este es el recorrido de validación que hizo.',
    'catalogo.ts, ficha zigzag-breakout; tesis del 15 de agosto de 2026 y cabecera de zigzag-breakout.cs.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 24 · ZigZag: recorrido de validación
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('caso zigzag')
  titulo(s, 'Su recorrido, fase a fase', 'Resultados literales del registro de validación.')

  const fases = [
    ['A', 'VENTANA HORARIA', 'PASA', 'La franja 09:30-10:30 gana entre 26 ventanas evaluadas. Alargarla hasta las 11:30 hunde el factor de beneficio a 1,049.', C.bien],
    ['B', 'VECINDAD · 9 CORRIDAS', 'PASA', 'El PEOR de los nueve vecinos sigue dando factor 1,389. No es un pico afortunado en el mapa de parámetros.', C.bien],
    ['C', 'FUERA DE MUESTRA', 'PASA', 'Sobre el tramo 2015-2019, que no se usó para elegir nada: factor 1,350 en el centro y entre 1,279 y 1,396 alrededor.', C.bien],
    ['D', 'SEIS BLOQUES', 'PASA', '5 de 6 bloques de régimen por encima de 1,00. El peor, 0,921. El bloque flojo es el de 2025-2026.', C.bien],
    ['E', 'SIMULADO', 'EN CURSO', 'Operando en tiempo real sin dinero desde el 11 de agosto de 2026. Aún no hay histórico suficiente para concluir nada.', C.oro],
  ]
  fases.forEach(([letra, t, estado, d, col], i) => {
    const y = 2.1 + i * 0.78
    tarjeta(s, { x: M, y, w: 8.9, h: 0.68, acento: col })
    s.addShape(pres.shapes.RECTANGLE, {
      x: M + 0.2,
      y: y + 0.13,
      w: 0.42,
      h: 0.42,
      fill: { color: col },
      line: { color: col, width: 0 },
    })
    s.addText(letra, {
      x: M + 0.2,
      y: y + 0.13,
      w: 0.42,
      h: 0.42,
      margin: 0,
      align: 'center',
      valign: 'middle',
      fontFace: F.tit,
      fontSize: 15,
      bold: true,
      color: C.fondoAlt,
    })
    s.addText(t, {
      x: M + 0.76,
      y,
      w: 2.1,
      h: 0.68,
      margin: 0,
      fontFace: F.dato,
      fontSize: 10,
      color: C.texto,
      valign: 'middle',
      charSpacing: 0.8,
    })
    s.addText(d, {
      x: M + 2.94,
      y,
      w: 5.06,
      h: 0.68,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 10.5,
      color: C.suave,
      valign: 'middle',
      lineSpacingMultiple: 1.05,
    })
    pildora(s, { x: M + 8.08, y: y + 0.17, w: 0.72, h: 0.34, txt: estado === 'PASA' ? 'OK' : '···', color: col })
  })

  tarjeta(s, { x: M + 9.16, y: 2.1, w: 2.9, h: 3.9, acento: C.mal, alta: true })
  cifra(s, { x: M + 9.44, y: 2.3, w: 2.4, valor: '13', etiqueta: 'variantes probadas y descartadas', color: C.mal, tam: 44 })
  parrafo(s, {
    x: M + 9.44,
    y: 3.5,
    w: 2.36,
    h: 2.3,
    tam: 10.5,
    txt: 'Operar también a la baja, objetivo fijo, mover el stop a punto de entrada, esperar un retroceso antes de entrar, límite de tiempo, filtros de régimen, filtro por día de la semana, parar tras varias ganadoras… Ninguna mejoró el resultado, y todas quedaron anotadas con su cifra.',
  })
  decir(
    'El recorrido de validación del ZigZag',
    'Fase por fase, con resultados literales del registro. La A: la franja de nueve y media a diez y media gana entre veintiséis ventanas evaluadas; alargarla hasta las once y media hunde el factor de beneficio a uno coma cero cuarenta y nueve. La B: nueve corridas moviendo parámetros, y el peor vecino sigue dando uno coma treinta y ocho. La C: fuera de muestra, uno coma treinta y cinco. La D: cinco de seis bloques por encima de uno. Y la E está en curso. A la derecha, trece variantes probadas y descartadas, todas anotadas con su cifra. Es tan importante lo que se descartó como lo que quedó.',
    'Y aun con todo esto, el veredicto individual es un suspenso.',
    'Bloque «FASE A…E» de la cabecera de zigzag-breakout.cs y sus trece descartes documentados.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 25 · ZigZag: el veredicto individual
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('caso zigzag')
  titulo(s, 'Y aun así, en solitario suspende', 'La honestidad de este proyecto se mide aquí, no en las láminas de resultados buenos.')

  const stats = [
    ['1,90', 't de Student', 'Por debajo de 2: no se puede afirmar que la ventaja exista', C.mal],
    ['13,84 %', 'Probabilidad de azar', 'Uno de cada siete resultados así saldría por suerte', C.mal],
    ['1,24', 'Factor de beneficio', 'Gana 1,24 por cada 1 que pierde', C.suave],
    ['89 %', 'Concentración', 'Diez operaciones de 532 producen el 89 % del beneficio', C.mal],
  ]
  stats.forEach(([v, t, d, col], i) => {
    const x = M + i * 3.05
    tarjeta(s, { x, y: 2.06, w: 2.85, h: 1.72, acento: col })
    s.addText(v, {
      x: x + 0.26,
      y: 2.2,
      w: 2.4,
      h: 0.56,
      margin: 0,
      fontFace: F.dato,
      fontSize: 30,
      bold: true,
      color: col,
      valign: 'middle',
    })
    rotulo(s, { x: x + 0.26, y: 2.78, w: 2.4, txt: t, color: C.texto, tam: 9.5 })
    s.addText(d, {
      x: x + 0.26,
      y: 3.06,
      w: 2.42,
      h: 0.62,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 10,
      color: C.suave,
      valign: 'top',
      lineSpacingMultiple: 1.1,
    })
  })

  const anual = zigzag.anual || []
  s.addChart(
    pres.charts.BAR,
    [
      {
        name: 'Resultado anual (MNQ, 1 contrato)',
        labels: anual.map((a) => a.anio),
        values: anual.map((a) => Math.round(a.pnl)),
      },
    ],
    {
      x: M,
      y: 3.94,
      w: 8.0,
      h: 2.06,
      barDir: 'col',
      chartColors: ['4D95D0'],
      invertedColors: ['F04438'],
      chartArea: { fill: { color: C.fondo } },
      plotArea: { fill: { color: C.fondo } },
      catAxisLabelColor: C.suave,
      valAxisLabelColor: C.tenue,
      catAxisLabelFontSize: 9.5,
      valAxisLabelFontSize: 9,
      catAxisLabelFontFace: F.dato,
      valGridLine: { color: C.borde, size: 0.5 },
      catGridLine: { style: 'none' },
      showLegend: false,
      showTitle: false,
      barGapWidthPct: 45,
    },
  )

  tarjeta(s, { x: M + 8.26, y: 3.94, w: 3.8, h: 2.06, acento: C.oro, alta: true })
  rotulo(s, { x: M + 8.54, y: 4.1, w: 3.2, txt: 'Nunca podrá validarse sola', color: C.oro, tam: 10.5 })
  parrafo(s, {
    x: M + 8.54,
    y: 4.42,
    w: 3.26,
    h: 1.44,
    tam: 11,
    txt: 'Con la dispersión que tiene por operación, harían falta unas mil operaciones para llevar su t a 2,5. A 46 operaciones al año, son veintidós años más. Por eso la decisión correcta sobre esta estrategia no es individual: es de cartera.',
  })
  nota(
    s,
    'El gráfico muestra los tres años negativos: 2022, 2025 y 2026. La tesis publica la concentración en el 96 % sobre NQ; el cálculo sobre la serie escalada a MNQ da 89 %. Se muestra la cifra calculada.',
    { y: H - 0.9, tam: 9.5 },
  )
  decir(
    'El veredicto individual del ZigZag',
    'Aquí es donde se mide la honestidad de un proyecto: no en las láminas de resultados buenos. Su t de Student es uno coma noventa, por debajo de dos, lo que significa que no puedo afirmar que su ventaja exista. Probabilidad de azar del catorce por ciento: uno de cada siete resultados así saldría por suerte. Y diez operaciones de quinientas treinta y dos producen el ochenta y nueve por ciento del beneficio. El gráfico enseña tres años en negativo, incluido el actual. Y la tarjeta de la derecha cierra el asunto: harían falta veintidós años más de operativa para poder validarla en solitario. Nunca va a pasar.',
    'Entonces, ¿por qué sigue en la cartera? Aquí viene la parte que más me costó aprender.',
    'zigzag-breakout.json (t-stat 1,90, PF 1,24, concentración top-10 = 89,1 %, serie anual) y la tesis individual del 15 de agosto.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 26 · ZigZag: el error de método
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('caso zigzag')
  titulo(s, 'Estuvo 24 horas fuera de la cartera', 'Lo saqué aplicando el listón individual a una decisión de portafolio. Fue un error de método, y queda documentado para no repetirlo.')

  rotulo(s, { x: M, y: 2.16, w: 8, txt: 'La prueba que revirtió la decisión · periodo 2015 – junio 2020', color: C.oro, tam: 11 })
  tabla(s, {
    x: M,
    y: 2.46,
    w: 7.5,
    cabecera: ['Configuración', 'Beneficio', 'Peor caída', 'Beneficio / caída'],
    colW: [2.7, 1.6, 1.6, 1.6],
    alturaFila: 0.42,
    tam: 12,
    filas: [
      ['Cartera sin el ZigZag', '$3.490', '−$3.858', { text: '0,90', color: C.mal, bold: true }],
      ['Cartera con el ZigZag', '$11.195', '−$4.141', { text: '2,70', color: C.bien, bold: true }],
    ],
  })

  tarjeta(s, { x: M, y: 3.98, w: 7.5, h: 1.02, acento: C.bien, alta: true })
  s.addText(
    'El ZigZag aportó $7.705 en ese tramo. Las otras cuatro estrategias, juntas, aportaron $3.490.',
    {
      x: M + 0.3,
      y: 3.98,
      w: 7.0,
      h: 1.02,
      margin: 0,
      fontFace: F.tit,
      fontSize: 14.5,
      bold: true,
      color: C.texto,
      valign: 'middle',
      lineSpacingMultiple: 1.1,
    },
  )

  tarjeta(s, { x: M, y: 5.16, w: 7.5, h: 1.14, acento: C.mal })
  rotulo(s, { x: M + 0.3, y: 5.3, w: 6.8, txt: 'Y la objeción se aplicó mal', color: C.mal, tam: 10.5 })
  parrafo(s, {
    x: M + 0.3,
    y: 5.58,
    w: 6.94,
    h: 0.66,
    tam: 11,
    txt: 'Lo saqué por tener el beneficio concentrado en pocas operaciones. Al medir lo mismo en las demás en ese periodo: Momentum 97 %, Overnight 117 %, Weekend 169 %. Todas igual o peor. Le apliqué un criterio que no apliqué al resto.',
  })

  tarjeta(s, { x: M + 7.76, y: 2.46, w: 4.3, h: 3.84, acento: C.oro, alta: true })
  rotulo(s, { x: M + 8.04, y: 2.66, w: 3.7, txt: 'La lección', color: C.oro, tam: 11 })
  s.addText(
    '«¿Es rentable por sí sola?» no es la pregunta de un portafolio.\n\nLa pregunta es: ¿aporta más de lo que quita al conjunto?',
    {
      x: M + 8.04,
      y: 2.98,
      w: 3.76,
      h: 1.5,
      margin: 0,
      fontFace: F.tit,
      fontSize: 14.5,
      italic: true,
      color: C.texto,
      valign: 'top',
      lineSpacingMultiple: 1.16,
    },
  )
  parrafo(s, {
    x: M + 8.04,
    y: 4.56,
    w: 3.76,
    h: 1.4,
    tam: 11,
    txt: 'Una estrategia floja pero descorrelacionada puede aportar más que una fuerte pero correlacionada. Es teoría de carteras elemental, y dejé que las métricas individuales dominaran la conclusión. La reincorporación no borra nada de lo medido: sigue siendo la más débil, y por eso nunca operará más de un contrato.',
  })
  decir(
    'El error de método',
    'Esta lámina es la que más me costó escribir. Saqué el ZigZag de la cartera y estuvo fuera veinticuatro horas. Lo saqué aplicándole el listón de estrategia individual a una decisión de portafolio, y esa no es la pregunta correcta. Mirad la tabla: en el periodo dos mil quince a dos mil veinte, sin el ZigZag la cartera hace novecientos de ratio beneficio-caída; con él, dos coma setenta. Aportó siete mil setecientos cinco dólares cuando las otras cuatro juntas aportaron tres mil cuatrocientos noventa. Y encima la objeción estaba mal aplicada: lo saqué por tener el beneficio concentrado, y al medir lo mismo en las demás, todas estaban igual o peor. La lección está a la derecha, y es teoría de carteras elemental que yo dejé de aplicar.',
    'Eso nos lleva a lo que hace un portafolio que no hace ninguna estrategia sola.',
    'Tesis del ZigZag, apartados 2 y 3; hoja «Aporte al portafolio» del registro de validación.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 27 · El todo frente a las partes
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('el portafolio', { oscura: true })
  titulo(s, 'El conjunto frente a la suma de las partes', 'Seis estrategias sobre MNQ, un contrato cada una, 11,6 años de histórico y 3.838 operaciones.')

  const comp = cartera.componentes
  tabla(s, {
    x: M,
    y: 2.1,
    w: 8.0,
    cabecera: ['Estrategia', 'Beneficio', 'Peor caída', 'Ben./caída', '% del total'],
    colW: [2.9, 1.42, 1.42, 1.16, 1.1],
    alturaFila: 0.32,
    tam: 10.5,
    filas: [
      ...comp.map((c) => [
        c.nombre,
        `$${Math.round(c.neto).toLocaleString('de-DE')}`,
        `−$${Math.round(Math.abs(c.drawdown)).toLocaleString('de-DE')}`,
        c.netoSobreDrawdown.toFixed(2).replace('.', ','),
        `${c.porcentajeDelNeto.toString().replace('.', ',')} %`,
      ]),
      [
        { text: 'Suma de las caídas individuales' },
        { text: '—', color: C.tenue },
        { text: '−$15.994', color: C.mal, bold: true },
        { text: '—', color: C.tenue },
        { text: '—', color: C.tenue },
      ],
      [
        { text: 'PORTAFOLIO REAL' },
        { text: '$89.341', color: C.bien, bold: true },
        { text: '−$4.099', color: C.bien, bold: true },
        { text: '21,79', color: C.bien, bold: true },
        { text: '100 %', color: C.texto, bold: true },
      ],
    ],
  })

  const kpis = [
    ['74 %', 'menos caída que la suma de las partes', C.bien],
    ['4,92', 'solidez estadística del conjunto\n(el mejor bot solo llega a 3,65)', C.bien],
    ['66 %', 'de los 140 meses en positivo', C.futuros],
  ]
  kpis.forEach(([v, e, col], i) => {
    const y = 2.1 + i * 1.06
    tarjeta(s, { x: M + 8.26, y, w: 3.8, h: 0.96, acento: col, alta: i === 0 })
    s.addText(v, {
      x: M + 8.5,
      y: y + 0.08,
      w: 1.5,
      h: 0.56,
      margin: 0,
      fontFace: F.dato,
      fontSize: 24,
      bold: true,
      color: col,
      valign: 'middle',
    })
    s.addText(e, {
      x: M + 10.02,
      y: y + 0.06,
      w: 1.82,
      h: 0.84,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 10,
      color: C.suave,
      valign: 'middle',
      lineSpacingMultiple: 1.08,
    })
  })

  tarjeta(s, { x: M, y: 5.34, w: 12.06, h: 0.96, acento: C.oro })
  s.addText(
    [
      { text: 'La cifra que resume el argumento:  ', options: { bold: true, color: C.oro } },
      {
        text: 'si las seis estrategias sufriesen a la vez, la caída sería de $15.994. Como no lo hacen, la caída real medida es de $4.099. Esa diferencia no es una estimación: sale de sumar día a día el resultado real de las 3.838 operaciones.',
        options: { color: C.suave },
      },
    ],
    { x: M + 0.3, y: 5.34, w: 11.5, h: 0.96, margin: 0, fontFace: F.cuerpo, fontSize: 12, valign: 'middle', lineSpacingMultiple: 1.1 },
  )
  decir(
    'El conjunto frente a la suma de las partes',
    'Aquí está el argumento central del portafolio. Seis estrategias, un contrato cada una. Individualmente, ninguna es espectacular: la mejor tiene un ratio beneficio-caída de nueve, la peor de dos y medio. Pero fijaos en las dos últimas filas de la tabla. Si las seis sufriesen a la vez, la caída sería de casi dieciséis mil dólares. La caída real medida es de cuatro mil noventa y nueve. Un setenta y cuatro por ciento menos. Y la solidez estadística del conjunto, cuatro coma noventa y dos, supera a la del mejor bot individual, que se queda en tres coma sesenta y cinco. El conjunto es más sólido que cualquiera de sus partes.',
    'Y ahora el porqué, que es más interesante que el cuánto.',
    'public/estrategias/data/cartera.json, bloques resumen y componentes.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 28 · Correlación en los peores días
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('el portafolio')
  titulo(s, 'Lo que de verdad protege', 'No la correlación media, sino la del 10 % de peores días. Es donde el signo se invierte.')

  const pares = [
    ['Momentum – Overnight', 0.29, -0.72],
    ['RSI2 – Overnight', -0.12, -0.67],
    ['ZigZag – Momentum', 0.58, -0.48],
    ['ZigZag – Overnight', 0.06, -0.38],
    ['ZigZag – Weekend', 0.46, -0.32],
  ]

  // Una fila por par: los cinco puntos de cada extremo se agolpan en el mismo
  // rango de valores, así que un gráfico de pendientes clásico solapa etiquetas.
  const ejeX = M + 3.2
  const ejeW = 5.0
  const centro = ejeX + ejeW / 2
  const escalaX = (v) => centro + (v / 0.8) * (ejeW / 2)
  const filaH = 0.66
  const y0c = 2.62

  rotulo(s, { x: M, y: 2.16, w: 3.0, txt: 'Par de estrategias', color: C.tenue, tam: 9.5 })
  s.addShape(pres.shapes.LINE, {
    x: centro,
    y: y0c - 0.16,
    w: 0,
    h: pares.length * filaH + 0.1,
    line: { color: C.borde, width: 1, dashType: 'dash' },
  })
  s.addText('correlación 0', {
    x: centro - 0.9,
    y: y0c - 0.5,
    w: 1.8,
    h: 0.28,
    margin: 0,
    align: 'center',
    fontFace: F.dato,
    fontSize: 9,
    color: C.tenue,
    valign: 'middle',
  })
  s.addText('gana cuando la cartera sufre  ◄', {
    x: ejeX - 0.1,
    y: 2.16,
    w: 2.3,
    h: 0.28,
    margin: 0,
    fontFace: F.cuerpo,
    fontSize: 9.5,
    italic: true,
    color: C.oro,
    valign: 'middle',
  })

  const colores = [C.futuros, C.peter, C.gamma, C.small, C.theta]
  pares.forEach(([nombre, media, peores], i) => {
    const y = y0c + i * filaH
    const cy = y + filaH / 2 - 0.08
    const col = colores[i]
    const xm = escalaX(media)
    const xp = escalaX(peores)

    s.addText(nombre, {
      x: M,
      y,
      w: 3.0,
      h: filaH - 0.1,
      margin: 0,
      align: 'right',
      fontFace: F.cuerpo,
      fontSize: 11,
      color: C.texto,
      valign: 'middle',
    })
    // Trazo que une la posición media con la de los peores días
    s.addShape(pres.shapes.LINE, {
      x: Math.min(xm, xp),
      y: cy,
      w: Math.abs(xp - xm),
      h: 0,
      line: { color: col, width: 2 },
    })
    // Punto hueco: correlación media
    s.addShape(pres.shapes.OVAL, {
      x: xm - 0.085,
      y: cy - 0.085,
      w: 0.17,
      h: 0.17,
      fill: { color: C.fondo },
      line: { color: C.tenue, width: 1.5 },
    })
    // Punto sólido: correlación en los peores días
    s.addShape(pres.shapes.OVAL, {
      x: xp - 0.095,
      y: cy - 0.095,
      w: 0.19,
      h: 0.19,
      fill: { color: col },
      line: { color: col, width: 0 },
    })
    s.addText(media.toFixed(2).replace('.', ','), {
      x: xm - 0.45,
      y: cy - 0.42,
      w: 0.9,
      h: 0.28,
      margin: 0,
      align: 'center',
      fontFace: F.dato,
      fontSize: 9.5,
      color: C.tenue,
      valign: 'middle',
    })
    s.addText(peores.toFixed(2).replace('.', ','), {
      x: xp - 0.45,
      y: cy - 0.42,
      w: 0.9,
      h: 0.28,
      margin: 0,
      align: 'center',
      fontFace: F.dato,
      fontSize: 11,
      bold: true,
      color: col,
      valign: 'middle',
    })
  })

  s.addText('○  correlación media          ●  en el 10 % de peores días', {
    x: ejeX,
    y: y0c + pares.length * filaH + 0.08,
    w: ejeW,
    h: 0.3,
    margin: 0,
    align: 'center',
    fontFace: F.cuerpo,
    fontSize: 10,
    color: C.suave,
    valign: 'middle',
  })

  tarjeta(s, { x: M + 8.5, y: 2.16, w: 3.56, h: 4.12, acento: C.oro, alta: true })
  rotulo(s, { x: M + 8.78, y: 2.34, w: 3.0, txt: 'Por qué importa', color: C.oro, tam: 10.5 })
  parrafo(s, {
    x: M + 8.78,
    y: 2.66,
    w: 3.02,
    h: 3.5,
    tam: 10.5,
    txt: 'Una cartera puede tener correlaciones bajas de media y dispararse a uno justo en el pánico, que es cuando duele.\n\nAquí pasa lo contrario: los pares que de media parecen redundantes cambian de signo en los peores días.\n\nEl ZigZag correlaciona +0,58 con el Momentum de media, pero −0,48 cuando la cartera sufre: gana cuando los demás pierden.\n\nEso es lo que amortigua una caída, y no lo enseña ninguna matriz de correlación convencional.',
  })
  decir(
    'Lo que de verdad protege',
    'Esta es la lámina más importante de todo el bloque, y la idea es sutil. Cuando alguien enseña una matriz de correlaciones, enseña la media. Y la media miente, porque una cartera puede tener correlaciones bajas de media y dispararse a uno justo en el pánico, que es exactamente cuando duele. Lo que hay aquí es otra cosa: la correlación restringida al diez por ciento de peores días del portafolio. Y mirad cómo cruzan todas las líneas hacia abajo. El ZigZag correlaciona más cero coma cincuenta y ocho con el Momentum de media, y menos cero coma cuarenta y ocho cuando la cartera sufre. Gana cuando los demás pierden. Eso es lo que amortigua una caída de verdad.',
    'Con esa lente, cada estrategia tiene un papel distinto.',
    'src/lib/estrategias/cartera.ts, bloque CORRELACIONES; hoja «Correlación» del registro del portafolio.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 29 · Clasificación por función
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('el portafolio')
  titulo(s, 'Cada estrategia tiene un papel', 'No todas están para ganar dinero. Algunas están para que las demás puedan seguir jugando.')

  const roles = [
    {
      rol: 'MOTORES DE RETORNO',
      col: C.bien,
      desc: 'Aportan casi la mitad del beneficio. Son también las más dependientes del régimen actual.',
      items: [
        ['Overnight Drift', '$24.420 · 27,3 % del total · 2.076 operaciones'],
        ['RSI2 Reversion', '$18.830 · el más caro de perder: −9,50 de ratio'],
      ],
    },
    {
      rol: 'SATÉLITES DE CRECIMIENTO',
      col: C.small,
      desc: 'Aportan menos beneficio pero con caídas contenidas. Estabilizan la curva sin arriesgar mucho.',
      items: [
        ['Weekend Effect', '$15.364 · segundo más caro de perder: −5,81'],
        ['Momentum de Apertura', '$6.369 · la menor caída de las seis: −$983'],
      ],
    },
    {
      rol: 'COBERTURA DE COLA',
      col: C.oro,
      desc: 'Entra por descorrelación, no por rentabilidad. Es la que sostiene la cartera cuando el resto no funciona.',
      items: [
        ['ZigZag Breakout', '$18.047 · correlación negativa con TODAS en los peores días'],
        ['Regla fija', 'Nunca más de un contrato. Su valor es la cobertura, no el retorno'],
      ],
    },
    {
      rol: 'AMORTIGUADOR DE RÉGIMEN',
      col: C.gamma,
      desc: 'La menos dependiente del cambio de mercado de 2020, y diseñada para no solapar con nadie.',
      items: [
        ['IBS Reversion', '$6.311 · el ratio de dependencia más bajo de los seis'],
        ['Diseño deliberado', 'Correlación −0,038 con Overnight: se evitó el solape a propósito'],
      ],
    },
  ]
  roles.forEach((r, i) => {
    const x = M + (i % 2) * 6.14
    const y = 2.04 + Math.floor(i / 2) * 1.96
    tarjeta(s, { x, y, w: 5.92, h: 1.8, acento: r.col })
    rotulo(s, { x: x + 0.28, y: y + 0.14, w: 4.6, txt: r.rol, color: r.col, tam: 10.5 })
    s.addText(r.desc, {
      x: x + 0.28,
      y: y + 0.42,
      w: 5.34,
      h: 0.44,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 10.5,
      italic: true,
      color: C.suave,
      valign: 'top',
    })
    r.items.forEach(([nom, dat], j) => {
      const iy = y + 0.94 + j * 0.4
      s.addText(nom, {
        x: x + 0.28,
        y: iy,
        w: 1.9,
        h: 0.34,
        margin: 0,
        fontFace: F.cuerpo,
        fontSize: 11,
        bold: true,
        color: C.texto,
        valign: 'middle',
      })
      s.addText(dat, {
        x: x + 2.22,
        y: iy,
        w: 3.4,
        h: 0.34,
        margin: 0,
        fontFace: F.dato,
        fontSize: 9,
        color: C.suave,
        valign: 'middle',
      })
    })
  })

  tarjeta(s, { x: M, y: 5.92, w: 12.06, h: 0.62, acento: C.mal })
  s.addText(
    'Ninguna es prescindible: quitar la que menos aporta ya cuesta 1,77 puntos de ratio beneficio-caída, y quitar el RSI2 cuesta 9,50.',
    { x: M + 0.3, y: 5.92, w: 11.5, h: 0.62, margin: 0, fontFace: F.cuerpo, fontSize: 12, color: C.suave, valign: 'middle' },
  )
  decir(
    'Cada estrategia tiene un papel',
    'Y aquí está la clasificación, que es lo que convierte seis bots en una cartera. Arriba a la izquierda, los motores: Overnight y RSI2, casi la mitad del beneficio, pero también los más dependientes del régimen actual. A la derecha, los satélites de crecimiento: aportan menos pero con caídas contenidas, el Momentum tiene la menor de las seis. Abajo a la izquierda, la cobertura de cola, que es el ZigZag: entra por descorrelación, no por rentabilidad, y por eso nunca operará más de un contrato. Y el amortiguador de régimen, el IBS, diseñado explícitamente para no solaparse con nadie. La frase de abajo cierra: ninguna es prescindible.',
    'Pero hay un riesgo que comparten cinco de las seis, y no lo voy a esconder.',
    'cartera.ts (APORTE_MARGINAL, DEPENDENCIA_REGIMEN) y cartera.json (componentes).',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 30 · Dependencia de régimen
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('el portafolio')
  titulo(s, 'El riesgo que sí tiene esta cartera', 'Cinco de las seis son estadísticamente nulas antes de julio de 2020 y fuertes después. Apuestan al mismo mundo.')

  // Curva de equity del portafolio
  const eq = cartera.equity
  const paso = Math.max(1, Math.floor(eq.length / 70))
  const puntos = eq.filter((_, i) => i % paso === 0 || i === eq.length - 1)
  let ultimoAnio = ''
  const labels = puntos.map((p) => {
    const anio = p.fecha.slice(0, 4)
    if (anio !== ultimoAnio) {
      ultimoAnio = anio
      return anio
    }
    return ''
  })

  s.addChart(
    pres.charts.LINE,
    [
      {
        name: 'Beneficio acumulado del portafolio (MNQ, 1 contrato por estrategia)',
        labels,
        values: puntos.map((p) => Math.round(p.valor)),
      },
    ],
    {
      x: M,
      y: 2.14,
      w: 8.0,
      h: 2.72,
      chartColors: ['4D95D0'],
      lineSize: 2.5,
      lineSmooth: false,
      chartArea: { fill: { color: C.fondo } },
      plotArea: { fill: { color: C.fondo } },
      catAxisLabelColor: C.suave,
      valAxisLabelColor: C.tenue,
      catAxisLabelFontFace: F.dato,
      catAxisLabelFontSize: 9,
      valAxisLabelFontSize: 9,
      valGridLine: { color: C.borde, size: 0.5 },
      catGridLine: { style: 'none' },
      showLegend: false,
      showTitle: false,
      lineDataSymbol: 'none',
    },
  )
  s.addText('Los cinco primeros años y medio son prácticamente planos.', {
    x: M + 0.5,
    y: 4.9,
    w: 7.2,
    h: 0.3,
    margin: 0,
    fontFace: F.cuerpo,
    fontSize: 11,
    italic: true,
    color: C.tenue,
    valign: 'middle',
  })

  const bloques = [
    ['2015 – junio 2020', '$11.568', '−$4.099', '2,82', C.mal],
    ['julio 2020 – hoy', '$77.772', '−$4.052', '19,19', C.bien],
  ]
  bloques.forEach(([per, neto, dd, ratio, col], i) => {
    const y = 2.14 + i * 1.42
    tarjeta(s, { x: M + 8.26, y, w: 3.8, h: 1.3, acento: col, alta: true })
    rotulo(s, { x: M + 8.52, y: y + 0.14, w: 3.3, txt: per, color: col, tam: 10 })
    s.addText(ratio, {
      x: M + 8.5,
      y: y + 0.44,
      w: 1.5,
      h: 0.62,
      margin: 0,
      fontFace: F.dato,
      fontSize: 27,
      bold: true,
      color: col,
      valign: 'middle',
    })
    s.addText(`beneficio / caída\n${neto} con ${dd}`, {
      x: M + 10.0,
      y: y + 0.44,
      w: 1.86,
      h: 0.66,
      margin: 0,
      fontFace: F.cuerpo,
      fontSize: 9.5,
      color: C.suave,
      valign: 'middle',
      lineSpacingMultiple: 1.1,
    })
  })

  tarjeta(s, { x: M, y: 5.36, w: 12.06, h: 1.06, acento: C.oro, alta: true })
  s.addText(
    [
      { text: 'Lo tranquilizador dentro de lo incómodo:  ', options: { bold: true, color: C.oro } },
      {
        text: 'la peor caída de todo el registro pertenece al régimen antiguo. Es decir, el peor caso que hemos medido YA ES el escenario «desaparece el factor común». No sería una catástrofe: serían varios años ganando poco mientras se soporta esa caída.',
        options: { color: C.suave },
      },
    ],
    { x: M + 0.3, y: 5.36, w: 11.5, h: 1.06, margin: 0, fontFace: F.cuerpo, fontSize: 12.5, valign: 'middle', lineSpacingMultiple: 1.12 },
  )
  decir(
    'El riesgo que sí tiene esta cartera',
    'No lo voy a esconder, porque es el riesgo estructural. Cinco de las seis estrategias son estadísticamente nulas antes de julio de dos mil veinte y fuertes después. Miradlo en la curva: los cinco primeros años y medio son prácticamente planos. Once mil quinientos dólares con una caída de cuatro mil. Y a partir de ahí, setenta y siete mil. El mismo código, sin tocar una línea. Eso significa que las seis están apostando, en el fondo, a que el mercado siga pareciéndose al de los últimos cinco años. Ahora, lo tranquilizador dentro de lo incómodo: la peor caída de todo el registro pertenece al régimen antiguo. El peor caso que hemos medido ya es el escenario de que desaparezca el factor común. No sería una catástrofe; serían varios años ganando poco.',
    'Con eso sobre la mesa, así es como se dimensiona.',
    'cartera.json (bloque regimen y serie equity) y apartado 4 del documento del portafolio.',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 31 · Cierre
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lamina('cierre', { oscura: true })
  titulo(s, 'Cómo se dimensiona y en qué punto estamos', 'La recomendación es la más conservadora de las cuatro posibles.')

  tabla(s, {
    x: M,
    y: 2.06,
    w: 7.4,
    cabecera: ['Tamaño', 'Caída esperada', '% de la cuenta', '$/año histórico'],
    colW: [2.3, 1.75, 1.65, 1.7],
    alturaFila: 0.36,
    tam: 11,
    filas: [
      [
        { text: '1 contrato por bot', bold: true },
        { text: '−$4.099', color: C.bien, bold: true },
        { text: '8,2 %', color: C.bien, bold: true },
        { text: '$7.714', color: C.bien, bold: true },
      ],
      ['2 contratos por bot', '−$8.198', '16,4 %', '$15.428'],
      ['3 contratos por bot', '−$12.297', '24,6 %', '$23.142'],
      ['4 contratos por bot', '−$16.396', '32,8 %', '$30.856'],
    ],
  })

  tarjeta(s, { x: M, y: 4.06, w: 7.4, h: 1.08, acento: C.oro, alta: true })
  rotulo(s, { x: M + 0.3, y: 4.2, w: 6.8, txt: 'Con qué cifra planificar', color: C.oro, tam: 10.5 })
  parrafo(s, {
    x: M + 0.3,
    y: 4.48,
    w: 6.84,
    h: 0.62,
    tam: 11,
    txt: 'Con $7.714 al año, la media de los 11,6 años que incluye ambos regímenes. No con los $12.710 del régimen actual. Y hay que estar preparado para $2.118 durante varios años seguidos.',
  })

  rotulo(s, { x: M, y: 5.32, w: 6, txt: 'Reglas de gobierno', color: C.futuros, tam: 10.5 })
  vinetas(s, {
    x: M,
    y: 5.6,
    w: 7.4,
    h: 1.1,
    tam: 10.5,
    items: [
      'Encender las seis a la vez: la ventaja del 74 % solo existe si corren juntas',
      'No pausar por intuición: apagar un bot unos días concretos puede costar el año entero',
      'Umbral de revisión: si el resultado móvil de 12 meses cae por debajo de −$4.099, parar y revisar',
    ],
  })

  tarjeta(s, { x: M + 7.66, y: 2.06, w: 4.4, h: 4.62, acento: C.mal, alta: true })
  rotulo(s, { x: M + 7.94, y: 2.26, w: 3.8, txt: 'En qué punto estamos hoy', color: C.mal, tam: 11 })
  s.addText('Fase E', {
    x: M + 7.92,
    y: 2.56,
    w: 3.8,
    h: 0.6,
    margin: 0,
    fontFace: F.tit,
    fontSize: 30,
    bold: true,
    color: C.texto,
    valign: 'middle',
  })
  s.addText('simulado, sin capital asignado', {
    x: M + 7.94,
    y: 3.14,
    w: 3.86,
    h: 0.3,
    margin: 0,
    fontFace: F.cuerpo,
    fontSize: 12,
    italic: true,
    color: C.mal,
    valign: 'middle',
  })
  parrafo(s, {
    x: M + 7.94,
    y: 3.56,
    w: 3.86,
    h: 2.6,
    tam: 11,
    txt: 'Las seis estrategias operan en tiempo real desde el 11 de agosto de 2026 —el IBS desde el 16— sin dinero detrás. Todos los resultados de esta presentación son de simulación histórica.\n\nLos cuatro agentes de acciones y opciones sí producen recomendaciones en vivo, con capital nocional y registro completo.\n\nLo que pido no es capital todavía. Es acordar el criterio con el que decidiremos, dentro de unos meses, si la Fase E ha cumplido lo que el papel prometía.',
  })
  decir(
    'Cierre',
    'Cierro con el dimensionamiento y con dónde estamos de verdad. La recomendación es la más conservadora de las cuatro: un contrato por bot, caída esperada del ocho coma dos por ciento de la cuenta. Y planificar con siete mil setecientos catorce dólares al año, que es la media de los once años y medio e incluye ambos regímenes, no con los doce mil setecientos del régimen actual. Hay que estar preparado para dos mil cien durante varios años seguidos. Tres reglas de gobierno: encender las seis a la vez, no pausar por intuición y tener un umbral de revisión escrito. Y a la derecha, el estado real, sin adornos: Fase E, simulado, sin capital asignado. Todo lo que habéis visto es simulación histórica. Y por eso lo que os pido hoy no es capital: es que acordemos ahora el criterio con el que decidiremos, dentro de unos meses, si esto ha cumplido lo que prometía. Gracias.',
    '— fin de la presentación —',
    'cartera.ts (DIMENSIONAMIENTO, ESCENARIOS_ANUALES, REGLAS_OPERATIVAS) y MARCO_COMUN (estado «Fase E — simulado, sin capital asignado»).',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Escritura
// ─────────────────────────────────────────────────────────────────────────────

const salida = path.join(__dirname, 'Emporium_Quant_Desk.pptx')

/** Estima la duración leyendo a ~150 palabras por minuto. */
function minutos(texto) {
  const palabras = texto.trim().split(/\s+/).length
  return palabras / 150
}

function construirGuion() {
  const total = guion.reduce((acc, g) => acc + minutos(g.cuerpo), 0)
  const lineas = [
    '# Emporium Quant Desk — guion de locución',
    '',
    '**De la idea al capital gestionado** · Luis Riofrío · Emporium Quality Funds',
    '',
    `${guion.length} diapositivas · duración estimada leyendo a ritmo natural: **${Math.round(total)} minutos** ` +
      `(sin contar pausas ni preguntas).`,
    '',
    'Cada entrada trae lo que se dice, la transición a la siguiente lámina y la fuente de las cifras que',
    'aparecen en pantalla, por si alguien las pregunta en el momento.',
    '',
    '> Generado por `presentacion/build.js`. Si cambia una diapositiva, se regenera este guion con ella:',
    '> `node presentacion/build.js`.',
    '',
    '---',
    '',
  ]
  guion.forEach((g) => {
    lineas.push(`## ${String(g.n).padStart(2, '0')} · ${g.titulo}`)
    lineas.push('')
    lineas.push(`*≈ ${Math.max(1, Math.round(minutos(g.cuerpo) * 60))} segundos*`)
    lineas.push('')
    lineas.push(g.cuerpo)
    lineas.push('')
    lineas.push(`**Transición.** ${g.transicion}`)
    lineas.push('')
    lineas.push(`**Fuente de las cifras.** ${g.fuentes}`)
    lineas.push('')
    lineas.push('---')
    lineas.push('')
  })
  lineas.push('## Tres cosas que no se pueden omitir')
  lineas.push('')
  lineas.push(
    '1. **Lámina 18** — los cuatro agentes no tienen backtest, y por qué construirlo sería engañoso.',
  )
  lineas.push(
    '2. **Lámina 30** — cinco de las seis estrategias dependen del régimen posterior a julio de 2020.',
  )
  lineas.push(
    '3. **Lámina 31** — Fase E: simulado, sin capital asignado. Todo lo mostrado es simulación histórica.',
  )
  lineas.push('')
  lineas.push(
    'Si el tiempo aprieta, se recorta del bloque de arquitectura (láminas 7 a 10), nunca de estas tres.',
  )
  lineas.push('')
  return lineas.join('\n')
}

pres.writeFile({ fileName: salida }).then(() => {
  fs.writeFileSync(path.join(__dirname, 'GUION_LOCUCION.md'), construirGuion(), 'utf8')
  console.log(`OK · ${n} diapositivas → ${salida}`)
  console.log(`OK · guion de locución → ${path.join(__dirname, 'GUION_LOCUCION.md')}`)
})
