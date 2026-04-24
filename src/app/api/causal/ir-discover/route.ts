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

  // Fetch quote (name) and asset profile (sector, website) in parallel
  // sector and website are NOT in quote() — they live in quoteSummary assetProfile
  const [quoteResult, summaryResult] = await Promise.allSettled([
    yahooFinance.quote(ticker),
    yahooFinance.quoteSummary(ticker, { modules: ['assetProfile'] }),
  ])

  if (quoteResult.status === 'rejected') {
    return Response.json({ error: `Ticker ${ticker} not found` }, { status: 404 })
  }

  const q = quoteResult.value as { longName?: string; shortName?: string }
  const profile =
    summaryResult.status === 'fulfilled'
      ? (summaryResult.value.assetProfile as { sector?: string; website?: string } | null)
      : null

  const companyName = q.longName ?? q.shortName ?? ticker
  const sector = profile?.sector ?? 'Unknown'
  const website = profile?.website ?? ''

  let irUrl = ''

  if (website) {
    try {
      const url = new URL(website.startsWith('http') ? website : `https://${website}`)
      const domain = url.hostname.replace(/^www\./, '')

      for (const pattern of IR_URL_PATTERNS) {
        const candidate = pattern(domain)
        if (await probeUrl(candidate)) {
          irUrl = candidate
          break
        }
      }
    } catch {
      // invalid URL — skip pattern probing
    }
  }

  // Fallback: Google search URL as reference
  if (!irUrl) {
    const q = encodeURIComponent(`${companyName} investor relations`)
    irUrl = `https://www.google.com/search?q=${q}`
  }

  return Response.json({ irUrl, companyName, sector, website })
}
