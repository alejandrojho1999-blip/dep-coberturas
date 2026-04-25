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

const COLOR_DARK = '1F3964'
const COLOR_MID  = '2E74B5'
const COLOR_WHITE = 'FFFFFF'
const COLOR_LIGHT = 'F2F2F2'

function half(pt: number) { return pt * 2 } // half-points for font size

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, size: half(13), color: COLOR_DARK, font: 'Calibri' })],
  })
}

function subheading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 140, after: 60 },
    children: [new TextRun({ text, bold: true, size: half(11), color: COLOR_MID, font: 'Calibri' })],
  })
}

function body(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, size: half(10.5), font: 'Calibri' })],
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

function cellBg(color: string, text: string, bold = false, size = 18, align = AlignmentType.CENTER): TableCell {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: color },
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, bold, size, color: COLOR_WHITE, font: 'Calibri' })],
      }),
    ],
  })
}

function cellVal(text: string, bold = false, size = 20, align = AlignmentType.CENTER): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, bold, size, font: 'Calibri' })],
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
        children: [new Paragraph({ children: [new TextRun({ text, size: half(10), font: 'Calibri' })] })],
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

export async function createDocxBuffer(
  content: ReportContent,
  marketData: MarketData,
  solicitante?: string
): Promise<Buffer> {
  const today = new Date()
  const firmante = solicitante?.trim() || 'Ing. Luis Riofrio, Mgs.'
  const currency = marketData.moneda ?? 'USD'

  // Load logo
  let logoBuffer: Buffer | null = null
  try {
    const logoPath = path.join(process.cwd(), 'public', 'emporium-logo.jpg')
    logoBuffer = fs.readFileSync(logoPath)
  } catch { /* no logo — skip gracefully */ }

  const headerChildren: Paragraph[] = []
  if (logoBuffer) {
    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: logoBuffer,
            transformation: { width: 200, height: 55 },
            type: 'jpg',
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
          run: { font: 'Calibri', size: half(10.5) },
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
                text: 'INFORME DE INVERSIÓN',
                bold: true,
                size: half(22),
                color: COLOR_DARK,
                font: 'Calibri',
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
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [new TextRun({ text: content.mes_año, size: half(12), font: 'Calibri' })],
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
                font: 'Calibri',
              }),
            ],
          }),

          separator(),

          // ── SECCIÓN 1: RESUMEN EJECUTIVO ─────────────────────────
          heading('1. RESUMEN EJECUTIVO'),
          body(content.resumen),

          separator(),

          // ── SECCIÓN 2: DESCRIPCIÓN DEL ACTIVO ───────────────────
          heading('2. DESCRIPCIÓN DEL ACTIVO'),

          subheading('2.1 Modelo de Negocio'),
          body(content.negocio),

          subheading('2.2 Fuentes de Ingresos'),
          fuentesTable,
          new Paragraph({ spacing: { after: 100 }, children: [] }),

          subheading('2.3 Histórico Anual de Ingresos'),
          incomeTable,
          new Paragraph({ spacing: { after: 100 }, children: [] }),

          separator(),

          // ── SECCIÓN 3: DESEMPEÑO Y VALORACIÓN ───────────────────
          heading('3. DESEMPEÑO Y VALORACIÓN'),

          subheading('3.1 Resultados Financieros'),
          body(content.financieros),

          subheading('3.2 Valoración de Mercado y Múltiplos'),
          body(content.valoracion),

          separator(),

          // ── SECCIÓN 4: FACTORES DE INVERSIÓN ────────────────────
          heading('4. FACTORES DE INVERSIÓN'),

          subheading('4.1 Factores Positivos'),
          ...content.factores_positivos.map(
            (f) =>
              new Paragraph({
                spacing: { after: 60 },
                bullet: { level: 0 },
                children: [
                  new TextRun({ text: `${f.titulo}: `, bold: true, size: half(10.5), font: 'Calibri' }),
                  new TextRun({ text: f.desc, size: half(10.5), font: 'Calibri' }),
                ],
              })
          ),

          new Paragraph({ spacing: { after: 80 }, children: [] }),

          subheading('4.2 Factores de Riesgo'),
          ...content.factores_riesgo.map(
            (f) =>
              new Paragraph({
                spacing: { after: 60 },
                bullet: { level: 0 },
                children: [
                  new TextRun({ text: `${f.titulo}: `, bold: true, size: half(10.5), font: 'Calibri' }),
                  new TextRun({ text: f.desc, size: half(10.5), font: 'Calibri' }),
                ],
              })
          ),

          separator(),

          // ── SECCIÓN 5: CONCLUSIÓN Y RECOMENDACIÓN ───────────────
          heading('5. CONCLUSIÓN Y RECOMENDACIÓN'),
          body(content.conclusion),

          // ── FIRMA ───────────────────────────────────────────────
          new Paragraph({ spacing: { before: 300 }, children: [] }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: 'Realizado por:', italics: true, size: half(10), font: 'Calibri' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: firmante, bold: true, size: half(11), color: COLOR_DARK, font: 'Calibri' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: 'Operador Junior — Emporium Quality Funds',
                italics: true,
                size: half(10),
                font: 'Calibri',
              }),
            ],
          }),
        ],
      },
    ],
  })

  return Buffer.from(await Packer.toBuffer(doc))
}

export function buildFilename(ticker: string, mesAño: string): string {
  return `${ticker.toUpperCase()}_Informe_${mesAño.replace(/\s+/g, '')}.docx`
}
