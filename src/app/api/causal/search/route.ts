import { NextRequest, NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'
import type { SearchResult } from 'yahoo-finance2/modules/search'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
  }

  try {
    const result = await yahooFinance.search(q.trim(), { quotesCount: 8, newsCount: 0 }) as SearchResult

    const results = (result.quotes ?? [])
      .filter((quote) => 'symbol' in quote && quote.symbol)
      .map((quote) => ({
        symbol: (quote as { symbol: string }).symbol,
        name:
          (quote as { shortname?: string; longname?: string }).shortname ??
          (quote as { longname?: string }).longname ??
          '',
        exchange: (quote as { exchange?: string }).exchange ?? '',
      }))
      .filter((r) => r.name)
      .slice(0, 8)

    return NextResponse.json({ results })
  } catch (err) {
    console.error('Yahoo Finance search error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
