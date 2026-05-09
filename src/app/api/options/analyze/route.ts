import { NextRequest, NextResponse } from 'next/server'
import { analyzeOptionsTicker } from '@/lib/options/analyzer'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const ticker = req.nextUrl.searchParams.get('ticker')?.trim().toUpperCase()
    if (!ticker) return NextResponse.json({ error: 'ticker es requerido' }, { status: 400 })
    if (!/^[A-Z0-9.-]{1,12}$/.test(ticker)) return NextResponse.json({ error: 'ticker invalido' }, { status: 400 })

    const data = await analyzeOptionsTicker(ticker)
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al analizar opciones'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}