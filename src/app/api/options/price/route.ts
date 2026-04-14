import { NextRequest, NextResponse } from 'next/server'
import { price } from '@/lib/options/blackScholes'
import type { OptionInput } from '@/lib/options/types'

export async function POST(req: NextRequest): Promise<Response> {
  const body = await req.json() as unknown

  // Type guard and validation
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json(
      { error: 'Request body must be a JSON object' },
      { status: 400 }
    )
  }

  const {
    type,
    S,
    K,
    T,
    r,
    sigma,
  } = body as Record<string, unknown>

  // Validate required fields exist
  if (
    type === undefined ||
    S === undefined ||
    K === undefined ||
    T === undefined ||
    r === undefined ||
    sigma === undefined
  ) {
    return NextResponse.json(
      { error: 'Missing required fields: type, S, K, T, r, sigma' },
      { status: 400 }
    )
  }

  // Validate field types
  if (typeof type !== 'string' || !['call', 'put'].includes(type)) {
    return NextResponse.json(
      { error: 'type must be "call" or "put"' },
      { status: 400 }
    )
  }

  if (typeof S !== 'number') {
    return NextResponse.json(
      { error: 'S (spot price) must be a number' },
      { status: 400 }
    )
  }

  if (typeof K !== 'number') {
    return NextResponse.json(
      { error: 'K (strike price) must be a number' },
      { status: 400 }
    )
  }

  if (typeof T !== 'number') {
    return NextResponse.json(
      { error: 'T (time to expiry) must be a number' },
      { status: 400 }
    )
  }

  if (typeof r !== 'number') {
    return NextResponse.json(
      { error: 'r (risk-free rate) must be a number' },
      { status: 400 }
    )
  }

  if (typeof sigma !== 'number') {
    return NextResponse.json(
      { error: 'sigma (volatility) must be a number' },
      { status: 400 }
    )
  }

  // Validate parameter ranges
  if (S <= 0) {
    return NextResponse.json(
      { error: 'S (spot price) must be > 0' },
      { status: 400 }
    )
  }

  if (K <= 0) {
    return NextResponse.json(
      { error: 'K (strike price) must be > 0' },
      { status: 400 }
    )
  }

  if (T < 0) {
    return NextResponse.json(
      { error: 'T (time to expiry) must be >= 0' },
      { status: 400 }
    )
  }

  if (sigma < 0) {
    return NextResponse.json(
      { error: 'sigma (volatility) must be >= 0' },
      { status: 400 }
    )
  }

  // All validations passed, compute pricing
  const input: OptionInput = {
    type: type as 'call' | 'put',
    S,
    K,
    T,
    r,
    sigma,
  }

  const result = price(input)

  return NextResponse.json(result, { status: 200 })
}
