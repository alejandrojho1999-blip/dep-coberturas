import YahooFinance from 'yahoo-finance2'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QuoteAny = Record<string, any>

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const tickers = (searchParams.get('tickers') ?? '')
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 100)

  if (!tickers.length) return Response.json({})

  const result: Record<string, number> = {}

  await Promise.allSettled(
    tickers.map(async (ticker) => {
      try {
        const yf = new YahooFinance()
        // El signal va dentro de `fetchOptions`: es el único campo que la
        // librería reenvía a fetch(), un `signal` suelto se descarta.
        const q = await yf.quote(ticker, {}, {
          fetchOptions: { signal: AbortSignal.timeout(8_000) },
        }) as QuoteAny
        const price = q?.regularMarketPrice as number | undefined
        if (price != null) result[ticker] = price
      } catch { /* skip failed tickers */ }
    })
  )

  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
