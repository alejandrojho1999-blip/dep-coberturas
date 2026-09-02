import fs from 'fs'
import path from 'path'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  Header,
  AlignmentType,
  BorderStyle,
  WidthType,
  TableBorders,
  convertMillimetersToTwip,
  ShadingType,
} from 'docx'
import type { ReportContent, MarketData } from './types'

const COLOR_DARK = '1C3042'
const COLOR_MID  = '003D66'
const COLOR_WHITE = 'FFFFFF'
const COLOR_LIGHT = 'F2F2F2'

function half(pt: number) { return pt * 2 } // half-points for font size

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, size: half(13), color: COLOR_DARK, font: 'Roboto' })],
  })
}

function subheading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 140, after: 60 },
    children: [new TextRun({ text, bold: true, size: half(11), color: COLOR_MID, font: 'Roboto' })],
  })
}

function body(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, size: half(10.5), font: 'Roboto' })],
  })
}

function separator(): Paragraph {
  return new Paragraph({
    spacing: { before: 100, after: 100 },
    border: {
      bottom: { color: COLOR_MID, space: 1, style: BorderStyle.SINGLE, size: 12 },
    },
    children: [],
  })
}

// `align` se anota: sin el tipo, TypeScript infiere del valor por defecto el
// literal 'center' y rechaza cualquier otra alineación.
function cellBg(color: string, text: string, bold = false, size = 18, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.CENTER): TableCell {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: color },
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, bold, size, color: COLOR_WHITE, font: 'Roboto' })],
      }),
    ],
  })
}

function cellVal(text: string, bold = false, size = 20, align = AlignmentType.CENTER): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, bold, size, font: 'Roboto' })],
      }),
    ],
  })
}

function stripedRow(cells: string[], isOdd: boolean): TableRow {
  const bg = isOdd ? COLOR_LIGHT : COLOR_WHITE
  return new TableRow({
    children: cells.map((text) =>
      new TableCell({
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: bg },
        children: [new Paragraph({ children: [new TextRun({ text, size: half(10), font: 'Roboto' })] })],
      })
    ),
  })
}

function formatCurrency(val: number | null, currency = 'USD'): string {
  if (val == null) return 'N/D'
  return `${currency} ${val.toFixed(2)}`
}

function formatLarge(n: number | null): string {
  if (n == null) return 'N/D'
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (Math.abs(n) >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (Math.abs(n) >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toFixed(2)}`
}

function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function fmtPct(n: number | null): string {
  if (n == null) return 'N/D'
  return `${(n * 100).toFixed(2)}%`
}

// Minimal 1×1 transparent PNG — required fallback for SVG in older Word versions
const SVG_FALLBACK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

function buildChartSvg(prices: { fecha: string; cierre: number }[]): Buffer | null {
  if (prices.length < 5) return null

  const W = 620, H = 220
  const padL = 58, padR = 15, padT = 15, padB = 36
  const cW = W - padL - padR
  const cH = H - padT - padB

  const vals = prices.map((p) => p.cierre)
  const lo   = Math.min(...vals)
  const hi   = Math.max(...vals)
  const span = hi - lo || 1

  const sx = (i: number) => padL + (i / (prices.length - 1)) * cW
  const sy = (v: number) => padT + cH - ((v - lo) / span) * cH

  const pts     = prices.map((p, i) => `${sx(i).toFixed(1)},${sy(p.cierre).toFixed(1)}`).join(' ')
  const fillPts = `${padL},${padT + cH} ` + pts + ` ${sx(prices.length - 1).toFixed(1)},${padT + cH}`

  // X-axis: ~10 evenly spaced labels
  const nX = 10
  const xLabels = Array.from({ length: nX }, (_, li) => {
    const idx = Math.min(Math.round((li * (prices.length - 1)) / (nX - 1)), prices.length - 1)
    const d   = new Date(prices[idx].fecha + 'T12:00:00Z')
    const lbl = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
    return `<text x="${sx(idx).toFixed(1)}" y="${H - 8}" font-size="9" fill="#555" text-anchor="middle" font-family="Roboto,Arial,sans-serif">${lbl}</text>`
  }).join('\n  ')

  // Y-axis: 4 levels
  const yParts: string[] = []
  for (let yi = 0; yi <= 4; yi++) {
    const v   = lo + (span * yi) / 4
    const y   = sy(v)
    const lbl = v >= 10000 ? `${(v / 1000).toFixed(0)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)
    yParts.push(
      `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#ececec" stroke-width="0.8"/>`,
      `<text x="${padL - 5}" y="${(y + 3).toFixed(1)}" font-size="9" fill="#555" text-anchor="end" font-family="Roboto,Arial,sans-serif">${lbl}</text>`,
    )
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1C3042" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#1C3042" stop-opacity="0.02"/>
    </linearGradient>
  </defs>
  ${yParts.join('\n  ')}
  <polygon points="${fillPts}" fill="url(#g)"/>
  <polyline points="${pts}" fill="none" stroke="#1C3042" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  ${xLabels}
  <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + cH}" stroke="#ccc" stroke-width="1"/>
  <line x1="${padL}" y1="${padT + cH}" x2="${W - padR}" y2="${padT + cH}" stroke="#ccc" stroke-width="1"/>
</svg>`

  return Buffer.from(svg)
}

/** Lista con viñeta de «Título: explicación», el formato de los factores. */
function vinetas(items: readonly { titulo: string; desc: string }[]): Paragraph[] {
  return items.map(
    (f) =>
      new Paragraph({
        spacing: { after: 60 },
        bullet: { level: 0 },
        children: [
          new TextRun({ text: `${f.titulo}: `, bold: true, size: half(10.5), font: 'Roboto' }),
          new TextRun({ text: f.desc, size: half(10.5), font: 'Roboto' }),
        ],
      })
  )
}

export async function createDocxBuffer(
  content: ReportContent,
  marketData: MarketData,
  solicitante?: string
): Promise<Buffer> {
  const today = new Date()
  const firmante = solicitante?.trim() || 'Operador — SynerGy'
  const currency = marketData.moneda ?? 'USD'

  // Una tesis abre con la afirmación que defiende, así que todo lo demás baja
  // un número. Los informes antiguos no traen `tipo_documento` y conservan la
  // numeración con la que se generaron.
  const esTesis = content.tipo_documento === 'tesis'
  const sec = (n: number) => n + (esTesis ? 1 : 0)

  // Logotipo de cabecera. La variante azul es la del manual para fondos claros,
  // que es exactamente lo que es una hoja de Word. El fallo se avisa en vez de
  // tragarse en silencio: el logotipo anterior llevaba borrado desde el rebrand
  // y este `catch` mudo escondió el desperfecto durante semanas de informes.
  let logoBuffer: Buffer | null = null
  try {
    const logoPath = path.join(process.cwd(), 'public', 'brand', 'logo-hrz-azul.png')
    logoBuffer = fs.readFileSync(logoPath)
  } catch (e) {
    console.warn('[informes] logotipo no disponible, el documento sale sin marca:', e)
  }

  const headerChildren: Paragraph[] = []
  if (logoBuffer) {
    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: logoBuffer,
            // 1920×616 en el original: con 55 de alto el logotipo saldría
            // aplastado.
            transformation: { width: 200, height: 64 },
            type: 'png',
          }),
        ],
      })
    )
  }

  // Metadata table (2 rows × 4 columns)
  const metaLabels = ['Informe No.', 'Ticker', 'Precio Actual', 'Precio Objetivo']
  const metaValues = [
    String(content.informe_numero),
    content.ticker,
    formatCurrency(content.precio_actual, currency),
    formatCurrency(content.precio_objetivo, currency),
  ]

  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TableBorders.NONE,
    rows: [
      new TableRow({
        children: metaLabels.map((label) => cellBg(COLOR_DARK, label, true, half(9))),
      }),
      new TableRow({
        children: metaValues.map((val) => cellVal(val, true, half(10))),
      }),
    ],
  })

  // Income history table
  const incomeRows: TableRow[] = [
    new TableRow({
      children: ['Año', 'Revenue', 'Gross Profit', 'Net Income'].map((h) =>
        cellBg(COLOR_MID, h, true, half(9))
      ),
    }),
    ...marketData.historial_ingresos.map((row, i) =>
      stripedRow(
        [
          String(row.año),
          formatLarge(row.revenue),
          formatLarge(row.gross_profit),
          formatLarge(row.net_income),
        ],
        i % 2 === 0
      )
    ),
  ]

  const incomeTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TableBorders.NONE,
    rows: incomeRows,
  })

  // TTM key metrics table
  const ttmLabels = ['EPS (TTM)', 'EV/EBITDA', 'P/E (TTM)', 'Margen Bruto', 'Margen Neto']
  const ttmValues = [
    marketData.eps      != null ? marketData.eps.toFixed(2)      : 'N/D',
    marketData.ev_ebitda != null ? marketData.ev_ebitda.toFixed(2) : 'N/D',
    marketData.pe_ratio != null ? marketData.pe_ratio.toFixed(2) : 'N/D',
    fmtPct(marketData.margen_bruto),
    fmtPct(marketData.margen_neto),
  ]

  const ttmTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TableBorders.NONE,
    rows: [
      new TableRow({ children: ttmLabels.map((label) => cellBg(COLOR_MID, label, true, half(9))) }),
      new TableRow({ children: ttmValues.map((val) => cellVal(val, true, half(10))) }),
    ],
  })

  const svgBuffer = buildChartSvg(marketData.historial_precios)

  // FCF history table
  const fcfRows: TableRow[] = [
    new TableRow({
      children: ['Año', 'Flujo Operativo (CFO)', 'CapEx', 'FCF Libre'].map((h) =>
        cellBg(COLOR_MID, h, true, half(9))
      ),
    }),
    ...(marketData.fcf_history.length > 0
      ? marketData.fcf_history.map((row, i) =>
          stripedRow(
            [
              String(row.año),
              formatLarge(row.cfo),
              formatLarge(row.capex),
              formatLarge(row.fcf),
            ],
            i % 2 === 0
          )
        )
      : [stripedRow(['N/D', 'N/D', 'N/D', 'N/D'], true)]),
  ]

  const fcfTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TableBorders.NONE,
    rows: fcfRows,
  })

  // Clientes table
  const clientesRows: TableRow[] = [
    new TableRow({
      children: ['Cliente / Segmento', 'Relevancia'].map((h) =>
        cellBg(COLOR_MID, h, true, half(9))
      ),
    }),
    ...(content.principales_clientes?.length > 0
      ? content.principales_clientes.map((c, i) =>
          stripedRow([c.nombre, c.relevancia], i % 2 === 0)
        )
      : [stripedRow(['No disponible', ''], true)]),
  ]

  const clientesTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TableBorders.NONE,
    rows: clientesRows,
  })

  // Proveedores table
  const proveedoresRows: TableRow[] = [
    new TableRow({
      children: ['Proveedor / Categoría', 'Relevancia'].map((h) =>
        cellBg(COLOR_MID, h, true, half(9))
      ),
    }),
    ...(content.principales_proveedores?.length > 0
      ? content.principales_proveedores.map((p, i) =>
          stripedRow([p.nombre, p.relevancia], i % 2 === 0)
        )
      : [stripedRow(['No disponible', ''], true)]),
  ]

  const proveedoresTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TableBorders.NONE,
    rows: proveedoresRows,
  })

  // Competidores table
  const competidoresRows: TableRow[] = [
    new TableRow({
      children: ['Competidor / Grupo', 'Relevancia Competitiva'].map((h) =>
        cellBg(COLOR_MID, h, true, half(9))
      ),
    }),
    ...(content.principales_competidores?.length > 0
      ? content.principales_competidores.map((c, i) =>
          stripedRow([c.nombre, c.relevancia], i % 2 === 0)
        )
      : [stripedRow(['No disponible', ''], true)]),
  ]

  const competidoresTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TableBorders.NONE,
    rows: competidoresRows,
  })

  // Fuentes de ingresos table
  const fuentesRows: TableRow[] = [
    new TableRow({
      children: ['Segmento', '% Aprox.', 'Descripción'].map((h) =>
        cellBg(COLOR_MID, h, true, half(9))
      ),
    }),
    ...content.fuentes_ingresos.map((f, i) =>
      stripedRow([f.segmento, f.porcentaje, f.descripcion], i % 2 === 0)
    ),
  ]

  const fuentesTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TableBorders.NONE,
    rows: fuentesRows,
  })

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Roboto', size: half(10.5) },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top:    convertMillimetersToTwip(20),
              bottom: convertMillimetersToTwip(20),
              left:   convertMillimetersToTwip(25),
              right:  convertMillimetersToTwip(25),
            },
          },
        },
        headers: {
          default: new Header({ children: headerChildren }),
        },
        children: [
          // ── PORTADA ─────────────────────────────────────────────
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 120 },
            children: [
              new TextRun({
                text: esTesis ? 'TESIS DE INVERSIÓN' : 'INFORME DE INVERSIÓN',
                bold: true,
                size: half(22),
                color: COLOR_DARK,
                font: 'Roboto',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: `${content.empresa}  (${content.bolsa}: ${content.ticker})`,
                bold: true,
                size: half(16),
                color: COLOR_MID,
                font: 'Roboto',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [new TextRun({ text: content.mes_año, size: half(12), font: 'Roboto' })],
          }),

          separator(),

          metaTable,

          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 80, after: 200 },
            children: [
              new TextRun({
                text: `Fecha de elaboración: ${formatDate(today)}`,
                italics: true,
                size: half(9),
                font: 'Roboto',
              }),
            ],
          }),

          separator(),

          // ── SECCIÓN 1 (solo tesis): TESIS CENTRAL ────────────────
          ...(content.tesis_central
            ? [
                heading('1. TESIS CENTRAL'),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  borders: TableBorders.NONE,
                  rows: [
                    new TableRow({
                      children: [
                        cellBg(COLOR_DARK, content.tesis_central, false, half(11), AlignmentType.LEFT),
                      ],
                    }),
                  ],
                }),
                ...(content.horizonte
                  ? [
                      new Paragraph({
                        spacing: { before: 100, after: 60 },
                        children: [
                          new TextRun({ text: 'Horizonte: ', bold: true, size: half(10.5), font: 'Roboto' }),
                          new TextRun({ text: content.horizonte, size: half(10.5), font: 'Roboto' }),
                        ],
                      }),
                    ]
                  : []),
                separator(),
              ]
            : []),

          // ── RESUMEN EJECUTIVO ────────────────────────────────────
          heading(`${sec(1)}. RESUMEN EJECUTIVO`),
          body(content.resumen),

          separator(),

          // ── SECCIÓN 2: DESCRIPCIÓN DEL ACTIVO ───────────────────
          heading(`${sec(2)}. DESCRIPCIÓN DEL ACTIVO`),

          subheading(`${sec(2)}.1 Modelo de Negocio`),
          body(content.negocio),

          subheading(`${sec(2)}.2 Fuentes de Ingresos`),
          fuentesTable,
          new Paragraph({ spacing: { after: 100 }, children: [] }),

          subheading(`${sec(2)}.3 Histórico Anual de Ingresos`),
          incomeTable,
          new Paragraph({ spacing: { after: 100 }, children: [] }),

          subheading(`${sec(2)}.4 Indicadores Financieros Clave (TTM)`),
          ttmTable,
          new Paragraph({ spacing: { after: 100 }, children: [] }),

          subheading(`${sec(2)}.5 Flujo de Caja Libre (FCF)`),
          fcfTable,
          new Paragraph({ spacing: { after: 100 }, children: [] }),

          subheading(`${sec(2)}.6 Principales Clientes`),
          clientesTable,
          new Paragraph({ spacing: { after: 100 }, children: [] }),

          subheading(`${sec(2)}.7 Principales Proveedores`),
          proveedoresTable,
          new Paragraph({ spacing: { after: 100 }, children: [] }),

          subheading(`${sec(2)}.8 Principales Competidores`),
          competidoresTable,
          new Paragraph({ spacing: { after: 100 }, children: [] }),

          subheading(`${sec(2)}.9 Evolución del Precio — Últimas 52 Semanas`),
          ...(svgBuffer
            ? [new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
                children: [new ImageRun({
                  data: svgBuffer,
                  transformation: { width: 560, height: 212 },
                  type: 'svg',
                  fallback: { type: 'png', data: SVG_FALLBACK_PNG },
                })],
              })]
            : [body('Gráfica no disponible.')]),

          separator(),

          // ── SECCIÓN 3: DESEMPEÑO Y VALORACIÓN ───────────────────
          heading(`${sec(3)}. DESEMPEÑO Y VALORACIÓN`),

          subheading(`${sec(3)}.1 Resultados Financieros`),
          body(content.financieros),

          subheading(`${sec(3)}.2 Valoración de Mercado y Múltiplos`),
          body(content.valoracion),

          subheading(`${sec(3)}.3 Flujo de Caja Libre y Valoración DCF`),
          body(content.dcf_analysis ?? 'Análisis DCF no disponible.'),

          separator(),

          // ── SECCIÓN 4: FACTORES DE INVERSIÓN ────────────────────
          heading(`${sec(4)}. FACTORES DE INVERSIÓN`),

          subheading(`${sec(4)}.1 Factores Positivos`),
          ...content.factores_positivos.map(
            (f) =>
              new Paragraph({
                spacing: { after: 60 },
                bullet: { level: 0 },
                children: [
                  new TextRun({ text: `${f.titulo}: `, bold: true, size: half(10.5), font: 'Roboto' }),
                  new TextRun({ text: f.desc, size: half(10.5), font: 'Roboto' }),
                ],
              })
          ),

          new Paragraph({ spacing: { after: 80 }, children: [] }),

          subheading(`${sec(4)}.2 Factores de Riesgo`),
          ...content.factores_riesgo.map(
            (f) =>
              new Paragraph({
                spacing: { after: 60 },
                bullet: { level: 0 },
                children: [
                  new TextRun({ text: `${f.titulo}: `, bold: true, size: half(10.5), font: 'Roboto' }),
                  new TextRun({ text: f.desc, size: half(10.5), font: 'Roboto' }),
                ],
              })
          ),

          separator(),

          // ── SECCIÓN 5: CONCLUSIÓN Y RECOMENDACIÓN ───────────────
          heading(`${sec(5)}. CONCLUSIÓN Y RECOMENDACIÓN`),
          body(content.conclusion),

          // ── SECCIÓN 6 (solo tesis): CATALIZADORES E INVALIDADORES ─
          // Una tesis que no se puede falsar no es una tesis, así que los dos
          // bloques van juntos: lo que la haría avanzar y lo que la rompería.
          ...(content.catalizadores?.length || content.invalidadores?.length
            ? [
                separator(),
                heading('6. CATALIZADORES Y QUÉ INVALIDARÍA LA TESIS'),
                ...(content.catalizadores?.length
                  ? [subheading('6.1 Catalizadores'), ...vinetas(content.catalizadores)]
                  : []),
                ...(content.invalidadores?.length
                  ? [
                      new Paragraph({ spacing: { after: 80 }, children: [] }),
                      subheading('6.2 Qué daría la tesis por rota'),
                      ...vinetas(content.invalidadores),
                    ]
                  : []),
              ]
            : []),

          // ── SECCIÓN 7 (solo tesis): VALORACIÓN PROPIA ────────────
          // Solo llega aquí si el servidor pudo respaldarla con al menos una
          // cifra localizada en los adjuntos.
          ...(content.valoracion_propia
            ? [
                separator(),
                heading('7. VALORACIÓN PROPIA'),
                new Paragraph({
                  spacing: { after: 80 },
                  children: [
                    new TextRun({ text: 'Método: ', bold: true, size: half(10.5), font: 'Roboto' }),
                    new TextRun({ text: content.valoracion_propia.metodo, size: half(10.5), font: 'Roboto' }),
                  ],
                }),
                ...(content.valoracion_propia.supuestos ?? []).map(
                  (sup) =>
                    new Paragraph({
                      spacing: { after: 40 },
                      bullet: { level: 0 },
                      children: [new TextRun({ text: sup, size: half(10.5), font: 'Roboto' })],
                    })
                ),
                ...(content.valoracion_propia.valor_por_accion != null
                  ? [
                      new Paragraph({
                        spacing: { before: 100 },
                        children: [
                          new TextRun({ text: 'Valor por acción: ', bold: true, size: half(10.5), font: 'Roboto' }),
                          new TextRun({
                            text: formatCurrency(content.valoracion_propia.valor_por_accion, currency),
                            bold: true,
                            size: half(10.5),
                            color: COLOR_MID,
                            font: 'Roboto',
                          }),
                          new TextRun({
                            text: content.valoracion_propia.upside_pct != null
                              ? `  (${content.valoracion_propia.upside_pct >= 0 ? '+' : ''}${content.valoracion_propia.upside_pct.toFixed(1)}% sobre el precio actual)`
                              : '',
                            size: half(10.5),
                            font: 'Roboto',
                          }),
                        ],
                      }),
                    ]
                  : []),
              ]
            : []),

          // ── ANEXO A (solo tesis): FUENTES Y TRAZABILIDAD ─────────
          // Cada fila de esta tabla se comprobó contra el texto del archivo que
          // dice citar. Lo que no se pudo localizar no llegó hasta aquí.
          ...(content.trazabilidad?.length || content.fuentes_adjuntas?.length
            ? [
                separator(),
                heading('ANEXO A. FUENTES APORTADAS Y TRAZABILIDAD'),
                ...(content.fuentes_adjuntas?.length
                  ? [
                      body(
                        `Documentos aportados: ${content.fuentes_adjuntas
                          .map((f) => `${f.filename} (${f.doc_type}, ${f.chars.toLocaleString('es-ES')} caracteres)`)
                          .join('; ')}.`
                      ),
                    ]
                  : []),
                ...(content.trazabilidad?.length
                  ? [
                      new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                          new TableRow({
                            children: ['Dato', 'Valor', 'Archivo', 'Ubicación'].map((h) =>
                              cellBg(COLOR_MID, h, true, half(10))
                            ),
                          }),
                          ...content.trazabilidad.map((t, i) =>
                            stripedRow([t.dato, t.valor, t.archivo, t.ubicacion], i % 2 === 1)
                          ),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 100 },
                        children: [
                          new TextRun({
                            text: 'Cada cifra de esta tabla se localizó en el archivo indicado. Las que no se pudieron comprobar se excluyeron del documento.',
                            italics: true,
                            size: half(9),
                            font: 'Roboto',
                          }),
                        ],
                      }),
                    ]
                  : []),
              ]
            : []),

          // ── FIRMA ───────────────────────────────────────────────
          new Paragraph({ spacing: { before: 300 }, children: [] }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: 'Realizado por:', italics: true, size: half(10), font: 'Roboto' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: firmante, bold: true, size: half(11), color: COLOR_DARK, font: 'Roboto' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: 'Operador Junior — SynerGy',
                italics: true,
                size: half(10),
                font: 'Roboto',
              }),
            ],
          }),
        ],
      },
    ],
  })

  return Buffer.from(await Packer.toBuffer(doc))
}

export function buildFilename(
  ticker: string,
  mesAño: string,
  tipo: 'informe' | 'tesis' = 'informe',
): string {
  const que = tipo === 'tesis' ? 'Tesis' : 'Informe'
  return `${ticker.toUpperCase()}_${que}_${mesAño.replace(/\s+/g, '')}.docx`
}
