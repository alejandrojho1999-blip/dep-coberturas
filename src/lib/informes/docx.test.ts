// @vitest-environment node
import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { buildFilename, createDocxBuffer } from './docx'
import type { MarketData, ReportContent } from './types'

const marketData: MarketData = {
  ticker: 'AAPL',
  empresa: 'Apple Inc.',
  bolsa: 'NASDAQ',
  precio_actual: 231.4,
  precio_52w_alto: 260,
  precio_52w_bajo: 164,
  market_cap: 3.5e12,
  beta: 1.2,
  shares_outstanding: 15e9,
  moneda: 'USD',
  sector: 'Technology',
  industria: 'Consumer Electronics',
  descripcion: 'Fabricante de dispositivos.',
  pe_ratio: 34,
  ps_ratio: 8.6,
  ev_ebitda: 25,
  margen_bruto: 0.46,
  margen_neto: 0.25,
  margen_operacional: 0.31,
  eps: 6.8,
  deuda_total: 1.1e11,
  caja_total: 6e10,
  precio_objetivo: 255,
  recomendacion: 'buy',
  strong_buy: 12,
  buy: 20,
  hold: 8,
  sell: 1,
  strong_sell: 0,
  historial_ingresos: [],
  historial_precios: [],
  free_cashflow: 1e11,
  fcf_history: [],
  dcf_value: 240,
  revenue_growth_rate: 0.06,
}

/** Informe con el esquema anterior a la tesis: ni un campo opcional nuevo. */
const legacy: ReportContent = {
  ticker: 'AAPL',
  empresa: 'Apple Inc.',
  bolsa: 'NASDAQ',
  precio_actual: 231.4,
  precio_objetivo: 255,
  informe_numero: 7,
  resumen: 'Resumen ejecutivo.',
  negocio: 'Modelo de negocio.',
  fuentes_ingresos: [{ segmento: 'iPhone', porcentaje: '~52%', descripcion: 'Teléfonos.' }],
  dcf_analysis: 'Análisis DCF.',
  principales_clientes: [{ nombre: 'Operadoras', relevancia: 'Canal principal.' }],
  principales_proveedores: [{ nombre: 'TSMC', relevancia: 'Chips.' }],
  principales_competidores: [{ nombre: 'Samsung', relevancia: 'Gama alta.' }],
  financieros: 'Resultados.',
  valoracion: 'Múltiplos.',
  factores_positivos: [{ titulo: 'Marca', desc: 'Poder de fijación de precios.' }],
  factores_riesgo: [{ titulo: 'China', desc: 'Concentración de fabricación.' }],
  conclusion: 'Mantener.',
  mes_año: 'Septiembre 2026',
}

const tesis: ReportContent = {
  ...legacy,
  tipo_documento: 'tesis',
  tesis_central: 'Se compra el margen de servicios, no el ciclo del iPhone.',
  horizonte: '12-18 meses',
  catalizadores: [{ titulo: 'Servicios', desc: 'Crecimiento sostenido de suscripciones.' }],
  invalidadores: [{ titulo: 'Regulación', desc: 'Apertura forzosa de la App Store.' }],
  valoracion_propia: {
    metodo: 'DCF',
    supuestos: ['WACC 9 %', 'crecimiento terminal 2,5 %'],
    valor_por_accion: 264,
    upside_pct: 14.1,
  },
  trazabilidad: [
    { dato: 'Ingresos Q3', valor: '1.234,50', archivo: 'guidance.xlsx', ubicacion: 'hoja Q3', verificado: true },
  ],
  fuentes_adjuntas: [{ filename: 'guidance.xlsx', doc_type: 'excel', chars: 4210 }],
}

/** Un .docx es un ZIP: empieza por «PK». */
const esDocx = (b: Buffer) => b.subarray(0, 2).toString('latin1') === 'PK'

describe('createDocxBuffer', () => {
  it('el logotipo de marca existe donde el generador lo busca', () => {
    // Esta aserción es la que habría cazado el fallo: el generador apuntaba a
    // `public/emporium-logo.jpg`, borrado en el rebrand, y el catch lo tragaba.
    const logo = path.join(process.cwd(), 'public', 'brand', 'logo-hrz-azul.png')
    expect(fs.existsSync(logo)).toBe(true)
  })

  it('genera un documento con el esquema antiguo, sin campos de tesis', async () => {
    const buf = await createDocxBuffer(legacy, marketData)
    expect(esDocx(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(1000)
  })

  it('genera un documento con las secciones de tesis', async () => {
    const buf = await createDocxBuffer(tesis, marketData)
    expect(esDocx(buf)).toBe(true)
    // La tesis añade secciones: pesa más que el informe equivalente.
    const informe = await createDocxBuffer(legacy, marketData)
    expect(buf.length).toBeGreaterThan(informe.length)
  })

  it('no se rompe si la tesis llega sin valoración propia ni trazabilidad', async () => {
    const sinRespaldo: ReportContent = {
      ...tesis,
      valoracion_propia: undefined,
      trazabilidad: undefined,
      fuentes_adjuntas: undefined,
    }
    expect(esDocx(await createDocxBuffer(sinRespaldo, marketData))).toBe(true)
  })
})

describe('buildFilename', () => {
  it('nombra el informe con su mes', () => {
    expect(buildFilename('AAPL', 'Septiembre 2026')).toBe('AAPL_Informe_Septiembre2026.docx')
  })

  it('distingue la tesis del informe', () => {
    expect(buildFilename('AAPL', 'Septiembre 2026', 'tesis')).toBe('AAPL_Tesis_Septiembre2026.docx')
  })
})
