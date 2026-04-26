import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()
import { NextResponse } from 'next/server'

export const revalidate = 60 // cache 60 seconds

interface TickerConfig {
  ticker: string
  label: string
  decimals: number
}

const TICKERS: TickerConfig[] = [
  { ticker: '^GSPC',    label: 'S&P 500', decimals: 2 },
  { ticker: '^NDX',     label: 'NDX',     decimals: 2 },
  { ticker: '^DJI',     label: 'DJI',     decimals: 2 },
  { ticker: '^VIX',     label: 'VIX',     decimals: 2 },
  { ticker: 'BTC-USD',  label: 'BTC/USD', decimals: 0 },
  { ticker: 'GC=F',     label: 'GOLD',    decimals: 2 },
  { ticker: 'CL=F',     label: 'WTI',     decimals: 2 },
  { ticker: 'EURUSD=X', label: 'EUR/USD', decimals: 4 },
]

export interface QuoteItem {
  symbol: string
  value: string
  change: string
  up: boolean
}

export async function GET() {
  try {
    const settled = await Promise.allSettled(
      TICKERS.map(async ({ ticker, label, decimals }) => {
        const q = await yahooFinance.quote(ticker) as {
          regularMarketPrice?: number
          regularMarketChangePercent?: number
        } | null

        const price = q?.regularMarketPrice
        const changePct = q?.regularMarketChangePercent ?? 0

        if (!price) throw new Error(`No price for ${ticker}`)

        const formatted = price >= 1000
          ? price.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
          : price.toFixed(decimals)

        const up = changePct >= 0
        const absChange = Math.abs(changePct)
        const changeStr = `${up ? '+' : '-'}${absChange.toFixed(2)}%`

        return { symbol: label, value: formatted, change: changeStr, up } satisfies QuoteItem
      })
    )

    const items: QuoteItem[] = settled
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<QuoteItem>).value)

    if (items.length === 0) {
      return NextResponse.json({ error: 'No market data available' }, { status: 503 })
    }

    return NextResponse.json(items)
  } catch (err) {
    console.error('[market/quotes]', err)
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 })
  }
}
