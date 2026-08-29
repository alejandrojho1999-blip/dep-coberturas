import { describe, it, expect } from 'vitest'
import {
  sumarDias, filaEn, indiceEn, factorSplitDesde, reportesVigentes, construirFila,
  fechasRebalanceoMensual,
} from '@/lib/backtest/panel'
import type { FundamentalesTicker, PriceRow, PriceSeries, ReporteFundamental } from '@/lib/backtest/types'

const precios = (fechas: string[], close = 100): PriceRow[] =>
  fechas.map((date, i) => ({ date, close: close + i, adjClose: close + i, volume: 1_000_000 }))

const reporte = (asOfDate: string, over: Partial<ReporteFundamental> = {}): ReporteFundamental => ({
  asOfDate,
  netIncome: 1_000_000_000,
  dilutedEPS: 5,
  totalDebt: 2_000_000_000,
  cash: 500_000_000,
  shares: 1_000_000_000,
  stockholdersEquity: null,
  totalRevenue: null,
  ...over,
})

describe('sumarDias', () => {
  it('avanza cruzando el cambio de mes', () => {
    expect(sumarDias('2024-01-31', 1)).toBe('2024-02-01')
  })

  it('retrocede con días negativos', () => {
    expect(sumarDias('2024-03-01', -1)).toBe('2024-02-29')
  })
})

describe('filaEn / indiceEn', () => {
  const rows = precios(['2024-01-02', '2024-01-03', '2024-01-05'])

  it('devuelve la última fila con fecha <= la pedida', () => {
    expect(filaEn(rows, '2024-01-04')?.date).toBe('2024-01-03')
  })

  it('devuelve la fila exacta cuando la fecha existe', () => {
    expect(filaEn(rows, '2024-01-05')?.date).toBe('2024-01-05')
  })

  it('devuelve null antes del inicio de la serie', () => {
    expect(filaEn(rows, '2023-12-31')).toBeNull()
    expect(indiceEn(rows, '2023-12-31')).toBe(-1)
  })
})

describe('factorSplitDesde', () => {
  const splits = [
    { date: '2020-08-31', factor: 4 },
    { date: '2024-06-10', factor: 10 },
  ]

  it('acumula solo los splits posteriores a la fecha', () => {
    expect(factorSplitDesde(splits, '2019-01-01')).toBe(40)
    expect(factorSplitDesde(splits, '2021-01-01')).toBe(10)
    expect(factorSplitDesde(splits, '2025-01-01')).toBe(1)
  })
})

describe('reportesVigentes', () => {
  const annual = [reporte('2022-12-31'), reporte('2023-12-31'), reporte('2024-12-31')]

  it('no usa un ejercicio antes de que el retardo lo haga público', () => {
    // 2023-12-31 + 90 días = 2024-03-30: el 2024-03-01 aún no está disponible.
    expect(reportesVigentes(annual, '2024-03-01')!.actual.asOfDate).toBe('2022-12-31')
  })

  it('lo usa a partir de la fecha de disponibilidad', () => {
    expect(reportesVigentes(annual, '2024-03-31')!.actual.asOfDate).toBe('2023-12-31')
  })

  it('con retardo 0 adelanta la disponibilidad: eso es look-ahead', () => {
    expect(reportesVigentes(annual, '2024-01-15', 0)!.actual.asOfDate).toBe('2023-12-31')
  })

  it('devuelve null si ningún ejercicio es público todavía', () => {
    expect(reportesVigentes(annual, '2021-01-01')).toBeNull()
  })

  it('expone el ejercicio previo para calcular el crecimiento', () => {
    expect(reportesVigentes(annual, '2024-04-01')!.previo?.asOfDate).toBe('2022-12-31')
  })
})

describe('construirFila', () => {
  const serie: PriceSeries = {
    ticker: 'TEST',
    rows: precios(['2024-06-28'], 100),  // close = 100
    splits: [],
  }
  const fund: FundamentalesTicker = {
    ticker: 'TEST',
    annual: [
      reporte('2022-12-31', { netIncome: 1_000_000_000 }),
      reporte('2023-12-31', { netIncome: 1_500_000_000 }),
    ],
    quarterly: [],
  }

  const fila = construirFila('TEST', '2024-06-28', serie, fund)!

  it('calcula el PER con el BPA del último ejercicio público', () => {
    expect(fila.trailingPE).toBeCloseTo(20, 6)   // 100 / 5
  })

  it('calcula la capitalización con las acciones reportadas', () => {
    expect(fila.marketCap).toBe(100 * 1_000_000_000)
  })

  it('calcula el crecimiento entre los dos últimos ejercicios', () => {
    expect(fila.earningsGrowth).toBeCloseTo(0.5, 6)
  })

  it('usa deuda neta sobre capitalización, no sobre fondos propios', () => {
    // (2000M - 500M) / 100.000M
    expect(fila.debtToEquity).toBeCloseTo(0.015, 6)
  })

  it('deriva el forwardPE proxy del crecimiento ya publicado', () => {
    expect(fila.forwardPE).toBeCloseTo(20 / 1.5, 6)
  })

  it('deriva el PEG proxy del mismo crecimiento', () => {
    expect(fila.pegRatio).toBeCloseTo(20 / 50, 6)
  })

  it('registra desde cuándo era público el informe usado', () => {
    expect(fila.reporteAsOf).toBe('2023-12-31')
    expect(fila.reportePublicoDesde).toBe('2024-03-30')
  })

  it('devuelve null si no hay ningún ejercicio publicado en esa fecha', () => {
    expect(construirFila('TEST', '2023-01-01', serie, fund)).toBeNull()
  })
})

describe('construirFila con split posterior al informe', () => {
  it('reexpresa acciones y BPA a la base de precios ajustada', () => {
    const serie: PriceSeries = {
      ticker: 'SPLIT',
      rows: precios(['2024-12-31'], 10),                    // close = 10 (post 10:1)
      splits: [{ date: '2024-06-10', factor: 10 }],
    }
    const fund: FundamentalesTicker = {
      ticker: 'SPLIT',
      annual: [reporte('2022-12-31'), reporte('2023-12-31')],  // BPA 5, 1.000M acciones pre-split
      quarterly: [],
    }
    const fila = construirFila('SPLIT', '2024-12-31', serie, fund)!

    // Acciones ×10 y BPA ÷10 → capitalización y PER invariantes al split.
    expect(fila.marketCap).toBe(10 * 10_000_000_000)
    expect(fila.trailingPE).toBeCloseTo(20, 6)
  })
})

describe('fechasRebalanceoMensual', () => {
  it('se queda con la última sesión de cada mes dentro del rango', () => {
    const rows = precios(['2024-01-30', '2024-01-31', '2024-02-28', '2024-02-29', '2024-03-01'])
    expect(fechasRebalanceoMensual(rows, '2024-01-01', '2024-02-29'))
      .toEqual(['2024-01-31', '2024-02-29'])
  })
})
