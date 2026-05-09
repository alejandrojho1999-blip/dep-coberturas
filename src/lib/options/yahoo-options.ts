import { fetchTickerFinancials, getYahooCrumb } from '@/lib/yahoo-financials'
import {
  blackScholes,
  classifyPremium,
  daysToExpiration,
  midPrice,
  probabilityITM,
  yearsToExpiration,
  type OptionType,
} from './pricing'

export interface RawYahooOption {
  contractSymbol?: string
  strike?: number
  currency?: string
  lastPrice?: number
  bid?: number
  ask?: number
  change?: number
  percentChange?: number
  volume?: number
  openInterest?: number
  impliedVolatility?: number
  inTheMoney?: boolean
}

export interface EnrichedOptionContract {
  symbol: string
  type: OptionType
  strike: number
  expiration: string
  dte: number
  bid: number | null
  ask: number | null
  lastPrice: number | null
  mid: number | null
  spreadPct: number | null
  impliedVolatility: number | null
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
  openInterest: number | null
  volume: number | null
  fairValue: number | null
  premiumStatus: 'barata' | 'justa' | 'cara' | 'sin-datos'
  probabilityITM: number | null
  inTheMoney: boolean
}

export interface OptionsChainData {
  ticker: string
  company: string
  underlyingPrice: number
  sector: string
  fundamentals: {
    peForward: number | null
    peTrailing: number | null
    debtToEquity: number | null
    targetMeanPrice: number | null
    analystConsensus: string
    beta: number | null
  }
  expirations: string[]
  selectedExpirations: string[]
  calls: EnrichedOptionContract[]
  puts: EnrichedOptionContract[]
  fetchedAt: string
}

interface YahooOptionsResponse {
  optionChain?: {
    result?: Array<{
      expirationDates?: number[]
      quote?: { regularMarketPrice?: number; shortName?: string; longName?: string }
      options?: Array<{ calls?: RawYahooOption[]; puts?: RawYahooOption[]; expirationDate?: number }>
    }>
  }
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

export async function fetchYahooOptionsAnalysis(ticker: string): Promise<OptionsChainData> {
  const symbol = ticker.toUpperCase().trim()
  const first = await fetchYahooOptions(symbol)
  const result = first.optionChain?.result?.[0]
  if (!result) throw new Error(`No hay cadena de opciones disponible para ${symbol}`)

  const financials = await fetchTickerFinancials(symbol).catch(() => null)

  const expirations = (result.expirationDates ?? [])
    .map((ts) => new Date(ts * 1000).toISOString().slice(0, 10))
    .filter((date) => daysToExpiration(date) >= 7)
  const selectedExpirations = chooseExpirations(expirations)

  const chains = await Promise.all(selectedExpirations.map(async (expiration) => {
    const dateUnix = Math.floor(new Date(`${expiration}T00:00:00.000Z`).getTime() / 1000)
    const data = await fetchYahooOptions(symbol, dateUnix)
    return data.optionChain?.result?.[0]?.options?.[0]
  }))

  const underlyingPrice = financials?.precioActual || result.quote?.regularMarketPrice || 0
  const calls = chains.flatMap((chain, i) => enrichContracts(chain?.calls ?? [], 'call', selectedExpirations[i], underlyingPrice))
  const puts = chains.flatMap((chain, i) => enrichContracts(chain?.puts ?? [], 'put', selectedExpirations[i], underlyingPrice))

  return {
    ticker: financials?.ticker ?? symbol,
    company: financials?.empresa ?? result.quote?.longName ?? result.quote?.shortName ?? symbol,
    underlyingPrice,
    sector: financials?.sector ?? 'N/D',
    fundamentals: {
      peForward: financials?.peForward ?? null,
      peTrailing: financials?.peTrailing ?? null,
      debtToEquity: financials?.debtToEquity ?? null,
      targetMeanPrice: financials?.precioObjetivoMedio ?? null,
      analystConsensus: financials?.consenso ?? 'N/D',
      beta: financials?.beta ?? null,
    },
    expirations,
    selectedExpirations,
    calls,
    puts,
    fetchedAt: new Date().toISOString(),
  }
}

async function fetchYahooOptions(ticker: string, expirationUnix?: number): Promise<YahooOptionsResponse> {
  const { crumb, cookie } = await getYahooCrumb()
  const params = new URLSearchParams({ crumb })
  if (expirationUnix) params.set('date', String(expirationUnix))
  const url = `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(ticker)}?${params.toString()}`
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`Yahoo options returned ${res.status} for ${ticker}`)
  return res.json()
}

function chooseExpirations(expirations: string[]): string[] {
  const preferred = expirations.filter((date) => {
    const dte = daysToExpiration(date)
    return dte >= 21 && dte <= 75
  })
  return (preferred.length ? preferred : expirations).slice(0, 4)
}

function enrichContracts(raw: RawYahooOption[], type: OptionType, expiration: string, spot: number): EnrichedOptionContract[] {
  const contracts: EnrichedOptionContract[] = []
  for (const option of raw) {
      const strike = safeNumber(option.strike)
      if (strike == null) continue
      const iv = normalizeIv(option.impliedVolatility)
      const dte = daysToExpiration(expiration)
      const timeToExpiryYears = yearsToExpiration(expiration)
      const marketMid = midPrice({
        bid: safeNumber(option.bid),
        ask: safeNumber(option.ask),
        lastPrice: safeNumber(option.lastPrice),
      })
      const greeks = blackScholes({
        type,
        spot,
        strike,
        timeToExpiryYears,
        volatility: iv ?? 0.35,
      })
      const fairValue = greeks.fairValue
      const bid = safeNumber(option.bid)
      const ask = safeNumber(option.ask)
      contracts.push({
        symbol: option.contractSymbol ?? `${type}-${expiration}-${strike}`,
        type,
        strike,
        expiration,
        dte,
        bid,
        ask,
        lastPrice: safeNumber(option.lastPrice),
        mid: marketMid,
        spreadPct: bid != null && ask != null && bid > 0 && ask > 0 ? (ask - bid) / ((ask + bid) / 2) : null,
        impliedVolatility: iv,
        delta: greeks.delta,
        gamma: greeks.gamma,
        theta: greeks.theta,
        vega: greeks.vega,
        openInterest: safeNumber(option.openInterest),
        volume: safeNumber(option.volume),
        fairValue,
        premiumStatus: classifyPremium(marketMid, fairValue),
        probabilityITM: probabilityITM(type, greeks.delta),
        inTheMoney: Boolean(option.inTheMoney),
      })
  }
  return contracts
}

function safeNumber(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeIv(value: unknown): number | null {
  const n = safeNumber(value)
  if (n == null || n <= 0) return null
  return n > 3 ? n / 100 : n
}
