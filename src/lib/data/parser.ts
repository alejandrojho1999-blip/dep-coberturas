import * as XLSX from 'xlsx'

export interface ParsedColumn {
  originalName: string
  mappedTo: string | null
  confidence: 'exact' | 'alias' | 'fuzzy' | 'unknown'
  values: number[]
  dates: string[]
}

export interface ParseResult {
  columns: ParsedColumn[]
  rowCount: number
  dateColumn: string | null
  warnings: string[]
}

export const COLUMN_ALIASES: Record<string, string[]> = {
  CAPEX_Growth: ['CF_CAP_EXPEND_PRPTY_ADD', 'CF_CAP_EXPEND', 'CAPEX', 'capital_expenditure'],
  GROSS_MARGIN: ['GROSS_MARGIN', 'EBIT_MARGIN', 'gross_margin', 'margen_bruto'],
  RETURN_COM_EQY: ['RETURN_COM_EQY', 'ROE', 'return_on_equity'],
  PE_RATIO: ['PE_RATIO', 'P/E', 'PER', 'price_earnings'],
  PX_TO_BOOK_RATIO: ['PX_TO_BOOK_RATIO', 'P/B', 'price_to_book'],
  TRAIL_12M_EPS: ['TRAIL_12M_EPS', 'EPS_12M', 'EPS_TTM', 'EPS'],
  NET_INCOME: ['NET_INCOME', 'net_income'],
}

// All known canonical names (keys of COLUMN_ALIASES)
const CANONICAL_NAMES = Object.keys(COLUMN_ALIASES)

// Flatten: alias → canonical mapping
const ALIAS_TO_CANONICAL: Map<string, string> = new Map()
for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL.set(alias.toLowerCase(), canonical)
  }
  // Also map canonical itself
  ALIAS_TO_CANONICAL.set(canonical.toLowerCase(), canonical)
}

function normalize(s: string): string {
  return s.toUpperCase().replace(/[\s_/\.]/g, '')
}

export function mapColumnName(
  header: string
): { mappedTo: string | null; confidence: ParsedColumn['confidence'] } {
  // 1. Exact match (case-sensitive) against canonical names
  const headerLower = header.toLowerCase()
  for (const canonical of CANONICAL_NAMES) {
    if (canonical === header) {
      return { mappedTo: canonical, confidence: 'exact' }
    }
  }

  // 2. Alias match (case-insensitive) — includes canonical names matched case-insensitively
  const aliasMatch = ALIAS_TO_CANONICAL.get(headerLower)
  if (aliasMatch !== undefined) {
    return { mappedTo: aliasMatch, confidence: 'alias' }
  }

  // 3. Fuzzy: normalize and check all known names and aliases
  const headerNorm = normalize(header)
  for (const canonical of CANONICAL_NAMES) {
    if (normalize(canonical) === headerNorm) {
      return { mappedTo: canonical, confidence: 'fuzzy' }
    }
    for (const alias of COLUMN_ALIASES[canonical]) {
      if (normalize(alias) === headerNorm) {
        return { mappedTo: canonical, confidence: 'fuzzy' }
      }
    }
  }

  return { mappedTo: null, confidence: 'unknown' }
}

function isDateLike(value: unknown): boolean {
  if (typeof value === 'string') {
    return /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(value) || /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(value)
  }
  if (value instanceof Date) return true
  return false
}

function formatDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }
  return String(value)
}

export function parseUploadedFile(buffer: Buffer, mimeType: string): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const warnings: string[] = []

  if (workbook.SheetNames.length === 0) {
    return { columns: [], rowCount: 0, dateColumn: null, warnings: ['No sheets found in file'] }
  }

  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  // Convert to array of arrays
  const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })

  if (rawData.length < 2) {
    return {
      columns: [],
      rowCount: 0,
      dateColumn: null,
      warnings: ['File has no data rows'],
    }
  }

  const headers = (rawData[0] as unknown[]).map((h) => (h != null ? String(h) : ''))
  const dataRows = rawData.slice(1) as unknown[][]

  // Detect date column: name contains 'date' (case-insensitive) OR first col with date-like values
  let dateColumnName: string | null = null
  let dateColumnIndex = -1

  for (let i = 0; i < headers.length; i++) {
    if (headers[i].toLowerCase().includes('date')) {
      dateColumnName = headers[i]
      dateColumnIndex = i
      break
    }
  }

  if (dateColumnIndex === -1) {
    // Check first column for date-like values
    const firstColValues = dataRows.map((row) => row[0])
    const dateLikeCount = firstColValues.filter(isDateLike).length
    if (dateLikeCount > firstColValues.length / 2) {
      dateColumnName = headers[0]
      dateColumnIndex = 0
    }
  }

  // Extract dates from date column
  const allDates: string[] = dataRows.map((row) => {
    if (dateColumnIndex >= 0 && row[dateColumnIndex] != null) {
      return formatDate(row[dateColumnIndex])
    }
    return ''
  })

  // Build columns for non-date headers
  const columns: ParsedColumn[] = []

  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    if (colIdx === dateColumnIndex) continue

    const header = headers[colIdx]
    if (!header) continue

    const rawValues = dataRows.map((row) => row[colIdx])

    // Extract numeric values and corresponding dates
    const values: number[] = []
    const dates: string[] = []

    for (let rowIdx = 0; rowIdx < rawValues.length; rowIdx++) {
      const v = rawValues[rowIdx]
      const num = v != null ? Number(v) : NaN

      if (!isNaN(num)) {
        values.push(num)
        dates.push(allDates[rowIdx] ?? '')
      }
    }

    // Skip rows where all numeric values are NaN (already filtered above)
    if (values.length === 0) {
      warnings.push(`Column "${header}" has no numeric values and was skipped`)
      continue
    }

    const { mappedTo, confidence } = mapColumnName(header)

    columns.push({
      originalName: header,
      mappedTo,
      confidence,
      values,
      dates,
    })
  }

  // rowCount = number of data rows that had at least one non-NaN numeric value
  const validRowCount = dataRows.filter((row) => {
    return headers.some((_, colIdx) => {
      if (colIdx === dateColumnIndex) return false
      const v = row[colIdx]
      return v != null && !isNaN(Number(v))
    })
  }).length

  if (mimeType && !mimeType.includes('spreadsheet') && !mimeType.includes('csv') && !mimeType.includes('excel')) {
    warnings.push(`Unexpected MIME type: ${mimeType}`)
  }

  return {
    columns,
    rowCount: validRowCount,
    dateColumn: dateColumnName,
    warnings,
  }
}
