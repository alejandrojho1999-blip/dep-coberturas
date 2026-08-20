/**
 * Construcción del símbolo OCC de un contrato de opción.
 *
 * Formato: TICKER + YYMMDD + C|P + strike * 1000 con padding a 8 dígitos.
 * Ejemplo: AAPL 2025-12-19 CALL 150 → "AAPL251219C00150000"
 *
 * Es el mismo formato que Yahoo Finance devuelve en `contractSymbol` y que
 * acepta como símbolo cotizable, lo que permite pedir la prima actual de un
 * contrato con una sola llamada a `quote()`.
 */

export type OccOptionType = 'CALL' | 'PUT'

export interface OptionContractRef {
  ticker: string
  /** Fecha de vencimiento en formato ISO `YYYY-MM-DD`. */
  expiration: string
  strike: number
  type: OccOptionType
}

/**
 * Devuelve el símbolo OCC del contrato, o `null` si los datos no permiten
 * construirlo (ticker vacío, fecha con formato inesperado, strike no positivo).
 */
export function buildOccSymbol(contract: OptionContractRef): string | null {
  const ticker = contract.ticker?.trim().toUpperCase()
  if (!ticker) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(contract.expiration?.trim() ?? '')
  if (!match) return null
  const [, year, month, day] = match

  const strike = Number(contract.strike)
  if (!Number.isFinite(strike) || strike <= 0) return null

  // Los strikes se expresan en milésimas: 150 → 00150000, 12.5 → 00012500.
  const strikeThousandths = Math.round(strike * 1000)
  if (strikeThousandths <= 0) return null

  const letter = contract.type === 'PUT' ? 'P' : 'C'

  return `${ticker}${year.slice(2)}${month}${day}${letter}${String(strikeThousandths).padStart(8, '0')}`
}

/**
 * Clave estable para indexar precios de contratos en el cliente.
 * Independiente del símbolo OCC para que la UI no dependa de su formato.
 */
export function contractKey(contract: OptionContractRef): string {
  return `${contract.ticker.trim().toUpperCase()}|${contract.expiration}|${contract.type}|${contract.strike}`
}
