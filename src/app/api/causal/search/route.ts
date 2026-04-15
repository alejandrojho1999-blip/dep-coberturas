import { NextRequest, NextResponse } from 'next/server'

interface YahooQuote {
  symbol?: string
  shortname?: string
  longname?: string
  exchange?: string
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
  }

  try {
    // Llamada directa al endpoint de Yahoo Finance — más confiable en serverless
    // que yahoo-finance2, que requiere cookies/crumb que no persisten entre
    // invocaciones frías de Vercel.
    const url = new URL('https://query1.finance.yahoo.com/v1/finance/search')
    url.searchParams.set('q', query.trim())
    url.searchParams.set('quotesCount', '8')
    url.searchParams.set('newsCount', '0')
    url.searchParams.set('enableFuzzyQuery', 'false')
    url.searchParams.set('lang', 'en-US')

    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      console.error(`Yahoo Finance search HTTP ${res.status}`)
      return NextResponse.json({ results: [] })
    }

    const data = (await res.json()) as {
      finance?: { result?: Array<{ quotes?: YahooQuote[] }> }
    }

    const quotes: YahooQuote[] = data?.finance?.result?.[0]?.quotes ?? []

    const results = quotes
      .filter((quote): quote is YahooQuote & { symbol: string } => Boolean(quote.symbol))
      .map((quote) => ({
        symbol: quote.symbol,
        name: quote.shortname ?? quote.longname ?? quote.symbol,
        exchange: quote.exchange ?? '',
      }))
      .slice(0, 8)

    return NextResponse.json({ results })
  } catch (err) {
    console.error('Yahoo Finance search error:', err)
    return NextResponse.json({ results: [] })
  }
}
