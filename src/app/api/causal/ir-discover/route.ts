import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance()

const IR_URL_PATTERNS = [
  (domain: string) => `https://investors.${domain}`,
  (domain: string) => `https://ir.${domain}`,
  (domain: string) => `https://www.${domain}/investors`,
  (domain: string) => `https://www.${domain}/ir`,
  (domain: string) => `https://www.${domain}/investor-relations`,
]

async function probeUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(4000) })
    return res.ok
  } catch {
    return false
  }
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return Response.json({ error: 'Missing ticker' }, { status: 400 })

  let quote: { longName?: string; shortName?: string; sector?: string; website?: string } = {}
  try {
    quote = await yahooFinance.quote(ticker, {
      fields: ['longName', 'shortName', 'sector', 'website'],
    }) as typeof quote
  } catch {
    return Response.json({ error: `Ticker ${ticker} not found` }, { status: 404 })
  }

  const companyName = quote.longName ?? quote.shortName ?? ticker
  const sector = quote.sector ?? 'Unknown'
  const website = quote.website ?? ''

  let irUrl = ''

  if (website) {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`)
    const domain = url.hostname.replace(/^www\./, '')

    for (const pattern of IR_URL_PATTERNS) {
      const candidate = pattern(domain)
      if (await probeUrl(candidate)) {
        irUrl = candidate
        break
      }
    }
  }

  // Fallback: Google search URL (not fetched, just provided as reference)
  if (!irUrl) {
    const q = encodeURIComponent(`${companyName} investor relations`)
    irUrl = `https://www.google.com/search?q=${q}`
  }

  return Response.json({ irUrl, companyName, sector, website })
}
