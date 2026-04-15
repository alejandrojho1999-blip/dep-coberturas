import { NextRequest, NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'
import type { SearchResult } from 'yahoo-finance2/modules/search'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
  }

  try {
    // validateResult: false evita FailedYahooValidationError en producción cuando
    // Yahoo Finance devuelve campos extra o esquema ligeramente diferente al esperado.
    // Cast explícito a SearchResult porque el overload con validateResult:false
    // resuelve a `never` en TypeScript.
    const result = (await yahooFinance.search(
      q.trim(),
      { quotesCount: 8, newsCount: 0 },
      { validateResult: false }
    )) as unknown as SearchResult

    const results = (result.quotes ?? [])
      .filter((quote) => 'symbol' in quote && quote.symbol)
      .map((quote) => ({
        symbol: (quote as { symbol: string }).symbol,
        name:
          (quote as { shortname?: string }).shortname ??
          (quote as { longname?: string }).longname ??
          (quote as { symbol: string }).symbol, // usar symbol como fallback, nunca ''
        exchange: (quote as { exchange?: string }).exchange ?? '',
      }))
      .slice(0, 8)

    return NextResponse.json({ results })
  } catch (err) {
    console.error('Yahoo Finance search error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
