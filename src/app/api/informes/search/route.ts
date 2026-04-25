export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 1) return Response.json([])

  try {
    const url =
      `https://query1.finance.yahoo.com/v1/finance/search` +
      `?q=${encodeURIComponent(q)}&quotesCount=7&newsCount=0&listsCount=0` +
      `&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`

    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })

    if (!res.ok) return Response.json([])

    const data = await res.json() as {
      quotes?: Array<{
        symbol: string
        longname?: string
        shortname?: string
        exchDisp?: string
        typeDisp?: string
      }>
    }

    const ALLOWED_TYPES = new Set(['equity', 'etf', 'fund', 'mutualfund'])

    const results = (data.quotes ?? [])
      .filter((q) => ALLOWED_TYPES.has(q.typeDisp?.toLowerCase() ?? ''))
      .map((q) => ({
        symbol: q.symbol,
        name: q.longname ?? q.shortname ?? q.symbol,
        exchange: q.exchDisp ?? '',
        type: q.typeDisp ?? '',
      }))

    return Response.json(results)
  } catch {
    return Response.json([])
  }
}
