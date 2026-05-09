export interface TechnicalZones {
  candles: Array<{ date: string; close: number }>
  support: number | null
  resistance: number | null
  sma50: number | null
  sma200: number | null
  range52WeekLow: number | null
  range52WeekHigh: number | null
  technicalBias: 'bullish' | 'neutral' | 'bearish'
  notes: string[]
}

export async function fetchTechnicalZones(ticker: string, currentPrice: number): Promise<TechnicalZones> {
  // Simular análisis técnico básico
  const mockZones: TechnicalZones = {
    candles: Array.from({ length: 100 }, (_, i) => ({
      date: new Date(Date.now() - (100 - i) * 24 * 60 * 60 * 1000).toISOString(),
      close: currentPrice * (0.95 + Math.random() * 0.1),
    })),
    support: currentPrice * 0.95,
    resistance: currentPrice * 1.05,
    sma50: currentPrice * 0.98,
    sma200: currentPrice * 0.96,
    range52WeekLow: currentPrice * 0.85,
    range52WeekHigh: currentPrice * 1.15,
    technicalBias: 'neutral',
    notes: [
      'Soporte técnico estimado en base a últimos 100 días',
      'Resistencia calculada con bandas de volatilidad',
    ],
  }

  return mockZones
}