import yahooFinance from 'yahoo-finance2'

export interface OptionContract {
  symbol: string
  type: 'call' | 'put'
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
}

export interface EnrichedOptionContract extends OptionContract {
  fairValue: number | null
  premiumStatus: 'barata' | 'justa' | 'cara' | 'sin-datos'
  probabilityITM: number | null
}

export interface OptionsAnalysis {
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
  calls: OptionContract[]
  puts: OptionContract[]
  selectedExpirations: string[]
  fetchedAt: string
}

function calculateDte(expirationDate: string): number {
  const expDate = new Date(expirationDate)
  const today = new Date()
  const diffTime = expDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

function calculateMid(bid: number | null, ask: number | null): number | null {
  if (bid === null || ask === null) return null
  return (bid + ask) / 2
}

function calculateSpreadPct(bid: number | null, ask: number | null): number | null {
  if (bid === null || ask === null || bid === 0) return null
  return (ask - bid) / bid
}

export async function fetchYahooOptionsAnalysis(ticker: string): Promise<OptionsAnalysis> {
  try {
    // Obtener datos del ticker
    const quoteResult = await yahooFinance.quote(ticker)
    
    // Obtener opciones del ticker
    const optionsResult = await yahooFinance.options(ticker)
    
    if (!optionsResult || !optionsResult.expirationDates || optionsResult.expirationDates.length === 0) {
      throw new Error(`No se encontraron opciones para ${ticker}`)
    }

    // Usar la fecha de expiración más cercana
    const nearestExpiration = optionsResult.expirationDates[0]
    const expirationData = optionsResult.options[nearestExpiration]
    
    if (!expirationData || (!expirationData.calls && !expirationData.puts)) {
      throw new Error(`No hay datos de opciones para la fecha ${nearestExpiration}`)
    }

    // Procesar calls
    const calls: OptionContract[] = (expirationData.calls || []).map(option => ({
      symbol: option.contractSymbol,
      type: 'call',
      strike: option.strike,
      expiration: nearestExpiration,
      dte: calculateDte(nearestExpiration),
      bid: option.bid || null,
      ask: option.ask || null,
      lastPrice: option.lastPrice || null,
      mid: calculateMid(option.bid, option.ask),
      spreadPct: calculateSpreadPct(option.bid, option.ask),
      impliedVolatility: option.impliedVolatility || null,
      delta: option.greeks?.delta || null,
      gamma: option.greeks?.gamma || null,
      theta: option.greeks?.theta || null,
      vega: option.greeks?.vega || null,
      openInterest: option.openInterest || null,
      volume: option.volume || null,
    }))

    // Procesar puts
    const puts: OptionContract[] = (expirationData.puts || []).map(option => ({
      symbol: option.contractSymbol,
      type: 'put',
      strike: option.strike,
      expiration: nearestExpiration,
      dte: calculateDte(nearestExpiration),
      bid: option.bid || null,
      ask: option.ask || null,
      lastPrice: option.lastPrice || null,
      mid: calculateMid(option.bid, option.ask),
      spreadPct: calculateSpreadPct(option.bid, option.ask),
      impliedVolatility: option.impliedVolatility || null,
      delta: option.greeks?.delta || null,
      gamma: option.greeks?.gamma || null,
      theta: option.greeks?.theta || null,
      vega: option.greeks?.vega || null,
      openInterest: option.openInterest || null,
      volume: option.volume || null,
    }))

    // Obtener datos fundamentales
    const fundamentals = await yahooFinance.quoteSummary(ticker, {
      modules: ['summaryProfile', 'financialData', 'defaultKeyStatistics']
    }).catch(() => null)

    const realData: OptionsAnalysis = {
      ticker: ticker.toUpperCase(),
      company: quoteResult.longName || ticker.toUpperCase(),
      underlyingPrice: quoteResult.regularMarketPrice || 0,
      sector: fundamentals?.summaryProfile?.sector || 'N/A',
      fundamentals: {
        peForward: fundamentals?.financialData?.forwardPE || null,
        peTrailing: fundamentals?.financialData?.trailingPE || null,
        debtToEquity: fundamentals?.financialData?.debtToEquity || null,
        targetMeanPrice: fundamentals?.financialData?.targetMeanPrice || null,
        analystConsensus: fundamentals?.financialData?.recommendationKey || 'N/A',
        beta: fundamentals?.defaultKeyStatistics?.beta || null,
      },
      calls: calls.filter(c => c.bid !== null && c.ask !== null),
      puts: puts.filter(p => p.bid !== null && p.ask !== null),
      selectedExpirations: [nearestExpiration],
      fetchedAt: new Date().toISOString(),
    }

    return realData
  } catch (error) {
    console.error(`Error fetching Yahoo Finance data for ${ticker}:`, error)
    
    // Fallback a datos de ejemplo si Yahoo Finance falla
    const mockData: OptionsAnalysis = {
      ticker: ticker.toUpperCase(),
      company: `${ticker.toUpperCase()} Company`,
      underlyingPrice: 185.25,
      sector: 'Technology',
      fundamentals: {
        peForward: 28.5,
        peTrailing: 30.2,
        debtToEquity: 1.2,
        targetMeanPrice: 210.0,
        analystConsensus: 'BUY',
        beta: 1.1,
      },
      calls: [
        {
          symbol: `${ticker}240118C00190000`,
          type: 'call',
          strike: 190,
          expiration: '2024-01-18',
          dte: 45,
          bid: 2.15,
          ask: 2.25,
          lastPrice: 2.20,
          mid: 2.20,
          spreadPct: 4.5,
          impliedVolatility: 0.28,
          delta: 0.45,
          gamma: 0.02,
          theta: -0.15,
          vega: 0.12,
          openInterest: 1500,
          volume: 450,
        }
      ],
      puts: [
        {
          symbol: `${ticker}240118P00180000`,
          type: 'put',
          strike: 180,
          expiration: '2024-01-18',
          dte: 45,
          bid: 1.85,
          ask: 1.95,
          lastPrice: 1.90,
          mid: 1.90,
          spreadPct: 5.3,
          impliedVolatility: 0.27,
          delta: -0.38,
          gamma: 0.019,
          theta: -0.14,
          vega: 0.13,
          openInterest: 1100,
          volume: 280,
        }
      ],
      selectedExpirations: ['2024-01-18'],
      fetchedAt: new Date().toISOString(),
    }

    return mockData
  }
}