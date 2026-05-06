import YahooFinance from 'yahoo-finance2'

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 1) return Response.json([])
  try {
    const yf = new YahooFinance()
    const res = await yf.search(q, { newsCount: 0, quotesCount: 8 })
    const results = (res.quotes ?? [])
      .filter((item) => item.isYahooFinance && 'symbol' in item)
      .map((item) => ({
        ticker: (item as { symbol: string }).symbol,
        name:
          ('longname' in item && item.longname ? (item.longname as string) : '') ||
          ('shortname' in item && item.shortname ? (item.shortname as string) : '') ||
          '',
      }))
      .slice(0, 8)
    return Response.json(results)
  } catch {
    return Response.json([])
  }
}
