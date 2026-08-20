import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance()

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get('q')?.trim()
    if (!query || query.length < 2) return NextResponse.json([])

    console.log(`🔍 Buscando tickers para: ${query}`)
    
    // Usar Yahoo Finance para búsqueda real con timeout.
    // El signal va dentro de `fetchOptions`: es el único campo que la librería
    // reenvía a fetch(), un `signal` suelto se descarta en silencio.
    const searchResult = await yahooFinance.search(query, {}, {
      fetchOptions: { signal: AbortSignal.timeout(10000) },
    })
    
    console.log(`✅ Resultados encontrados: ${searchResult?.quotes?.length || 0}`)
    
    const suggestions = (searchResult.quotes || [])
      .filter(quote => quote.symbol && quote.longname)
      .slice(0, 10)
      .map(quote => ({
        ticker: quote.symbol!,
        name: quote.longname!,
        exchange: quote.exchDisp || quote.exchange || 'N/A',
      }))

    console.log(`📋 Sugerencias procesadas: ${suggestions.length}`)
    return NextResponse.json(suggestions)
  } catch (err) {
    console.error('❌ Error searching tickers:', err)
    
    const query = req.nextUrl.searchParams.get('q')?.trim() || ''
    
    // Fallback a datos de ejemplo si Yahoo Finance falla
    const fallbackSuggestions = [
      { ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
      { ticker: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
      { ticker: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ' },
      { ticker: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ' },
      { ticker: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ' },
      { ticker: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ' },
      { ticker: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
      { ticker: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE' },
      { ticker: 'BAC', name: 'Bank of America Corp', exchange: 'NYSE' },
      { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', exchange: 'NYSE' },
    ].filter(s => 
      query && (
        s.ticker.includes(query.toUpperCase()) || 
        s.name.toLowerCase().includes(query.toLowerCase())
      )
    ).slice(0, 10)

    console.log(`🔄 Usando fallback: ${fallbackSuggestions.length} sugerencias`)
    return NextResponse.json(fallbackSuggestions)
  }
}