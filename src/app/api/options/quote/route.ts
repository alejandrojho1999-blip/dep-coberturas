import yahooFinance from 'yahoo-finance2'
import { NextRequest, NextResponse } from 'next/server'

export interface QuoteResponse {
  ticker: string
  price: number
  currency: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const ticker = searchParams.get('ticker')

  // Validate ticker parameter
  if (!ticker) {
    return NextResponse.json(
      { error: 'Missing required parameter: ticker' },
      { status: 400 }
    )
  }

  try {
    // Fetch quote from Yahoo Finance
    const quote = await yahooFinance.quote(ticker) as { regularMarketPrice?: number; symbol?: string; currency?: string } | null

    // Check if quote was found and has a valid price
    if (!quote || quote.regularMarketPrice === null || quote.regularMarketPrice === undefined) {
      return NextResponse.json(
        { error: `Ticker not found: ${ticker}` },
        { status: 404 }
      )
    }

    return NextResponse.json<QuoteResponse>({
      ticker: quote.symbol || ticker.toUpperCase(),
      price: quote.regularMarketPrice,
      currency: quote.currency || 'USD',
    })
  } catch (error) {
    console.error(`Error fetching quote for ${ticker}:`, error)

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('Not Found') || error.message.includes('404')) {
        return NextResponse.json(
          { error: `Ticker not found: ${ticker}` },
          { status: 404 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch quote from Yahoo Finance' },
      { status: 500 }
    )
  }
}
