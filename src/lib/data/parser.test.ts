import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { mapColumnName, parseUploadedFile } from './parser'

describe('mapColumnName', () => {
  it('maps CF_CAP_EXPEND_PRPTY_ADD to CAPEX_Growth as alias', () => {
    const result = mapColumnName('CF_CAP_EXPEND_PRPTY_ADD')
    expect(result.mappedTo).toBe('CAPEX_Growth')
    expect(result.confidence).toBe('alias')
  })

  it('maps GROSS_MARGIN to GROSS_MARGIN as exact', () => {
    const result = mapColumnName('GROSS_MARGIN')
    expect(result.mappedTo).toBe('GROSS_MARGIN')
    expect(result.confidence).toBe('exact')
  })

  it('maps gross_margin to GROSS_MARGIN as alias (case-insensitive)', () => {
    const result = mapColumnName('gross_margin')
    expect(result.mappedTo).toBe('GROSS_MARGIN')
    expect(result.confidence).toBe('alias')
  })

  it('maps P/E to PE_RATIO as alias', () => {
    const result = mapColumnName('P/E')
    expect(result.mappedTo).toBe('PE_RATIO')
    expect(result.confidence).toBe('alias')
  })

  it('returns null with unknown confidence for unrecognized column', () => {
    const result = mapColumnName('unknown_xyz')
    expect(result.mappedTo).toBeNull()
    expect(result.confidence).toBe('unknown')
  })

  it('maps ROE to RETURN_COM_EQY as alias', () => {
    const result = mapColumnName('ROE')
    expect(result.mappedTo).toBe('RETURN_COM_EQY')
    expect(result.confidence).toBe('alias')
  })

  it('maps EPS to TRAIL_12M_EPS as alias', () => {
    const result = mapColumnName('EPS')
    expect(result.mappedTo).toBe('TRAIL_12M_EPS')
    expect(result.confidence).toBe('alias')
  })
})

describe('parseUploadedFile', () => {
  function buildMockXlsxBuffer(
    rows: (string | number | null)[][]
  ): Buffer {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const arrayBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    return arrayBuffer
  }

  it('parses a basic file with Date, GROSS_MARGIN, CF_CAP_EXPEND_PRPTY_ADD', () => {
    const rows = [
      ['Date', 'GROSS_MARGIN', 'CF_CAP_EXPEND_PRPTY_ADD'],
      ['2020-01-01', 0.45, 1200],
      ['2020-04-01', 0.47, 1300],
      ['2020-07-01', 0.43, 1100],
      ['2020-10-01', 0.50, 1400],
    ]

    const buffer = buildMockXlsxBuffer(rows)
    const result = parseUploadedFile(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    expect(result.rowCount).toBe(4)
    expect(result.dateColumn).toBe('Date')

    const grossMarginCol = result.columns.find((c) => c.originalName === 'GROSS_MARGIN')
    expect(grossMarginCol).toBeDefined()
    expect(grossMarginCol?.mappedTo).toBe('GROSS_MARGIN')
    expect(grossMarginCol?.confidence).toBe('exact')
    expect(grossMarginCol?.values).toHaveLength(4)
    expect(grossMarginCol?.values[0]).toBeCloseTo(0.45)

    const capexCol = result.columns.find((c) => c.originalName === 'CF_CAP_EXPEND_PRPTY_ADD')
    expect(capexCol).toBeDefined()
    expect(capexCol?.mappedTo).toBe('CAPEX_Growth')
    expect(capexCol?.confidence).toBe('alias')
    expect(capexCol?.values).toHaveLength(4)
    expect(capexCol?.values[1]).toBe(1300)
  })

  it('detects date column by name containing "date" (case-insensitive)', () => {
    const rows = [
      ['report_date', 'NET_INCOME'],
      ['2021-03-31', 5000],
      ['2021-06-30', 5500],
    ]

    const buffer = buildMockXlsxBuffer(rows)
    const result = parseUploadedFile(buffer, 'text/csv')

    expect(result.dateColumn).toBe('report_date')
    expect(result.rowCount).toBe(2)
  })

  it('returns empty columns and rowCount 0 for header-only file', () => {
    const rows = [['Date', 'GROSS_MARGIN']]
    const buffer = buildMockXlsxBuffer(rows)
    const result = parseUploadedFile(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    expect(result.rowCount).toBe(0)
    expect(result.columns.length).toBe(0)
  })

  it('skips columns with no numeric values and adds warning', () => {
    const rows = [
      ['Date', 'GROSS_MARGIN', 'EMPTY_COL'],
      ['2020-01-01', 0.45, null],
      ['2020-04-01', 0.47, null],
    ]

    const buffer = buildMockXlsxBuffer(rows)
    const result = parseUploadedFile(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    const emptyCol = result.columns.find((c) => c.originalName === 'EMPTY_COL')
    expect(emptyCol).toBeUndefined()
    expect(result.warnings.some((w) => w.includes('EMPTY_COL'))).toBe(true)
  })

  it('maps P/B column to PX_TO_BOOK_RATIO', () => {
    const rows = [
      ['Date', 'P/B'],
      ['2020-01-01', 2.1],
      ['2020-04-01', 2.3],
    ]

    const buffer = buildMockXlsxBuffer(rows)
    const result = parseUploadedFile(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    const pbCol = result.columns.find((c) => c.originalName === 'P/B')
    expect(pbCol?.mappedTo).toBe('PX_TO_BOOK_RATIO')
    expect(pbCol?.confidence).toBe('alias')
  })
})
