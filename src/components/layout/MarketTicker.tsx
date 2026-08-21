'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Marquee } from '@/components/ui/marquee'
import type { QuoteItem } from '@/app/api/market/quotes/route'

const FALLBACK: QuoteItem[] = [
  { symbol: 'S&P 500', value: '—',   change: '—',     up: true },
  { symbol: 'NDX',     value: '—',   change: '—',     up: true },
  { symbol: 'BTC/USD', value: '—',   change: '—',     up: true },
  { symbol: 'GOLD',    value: '—',   change: '—',     up: true },
  { symbol: 'EUR/USD', value: '—',   change: '—',     up: true },
]

function TickerItem({ symbol, value, change, up }: QuoteItem) {
  const Icon = up ? TrendingUp : TrendingDown
  const isPlaceholder = value === '—'
  return (
    <span className="flex items-center gap-1.5 px-4">
      <span className="text-[10px] font-semibold tracking-wide text-text-secondary uppercase">
        {symbol}
      </span>
      <span className={`text-[10px] font-mono ${isPlaceholder ? 'text-text-muted' : 'text-text-primary'}`}>
        {value}
      </span>
      {!isPlaceholder && (
        <span className={`flex items-center gap-0.5 text-[10px] font-mono ${up ? 'text-positive' : 'text-negative'}`}>
          <Icon size={10} />
          {change}
        </span>
      )}
      <span className="text-border">|</span>
    </span>
  )
}

export function MarketTicker() {
  const [items, setItems] = useState<QuoteItem[]>(FALLBACK)

  useEffect(() => {
    // `cancelled` evita que una respuesta tardía escriba estado después de
    // desmontar el componente.
    let cancelled = false

    async function fetchQuotes() {
      try {
        const res = await fetch('/api/market/quotes', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json() as QuoteItem[]
        if (!cancelled && Array.isArray(data) && data.length > 0) setItems(data)
      } catch {
        // keep showing previous data silently
      }
    }

    void fetchQuotes()
    const id = setInterval(() => void fetchQuotes(), 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return (
    <div className="border-b border-border bg-surface overflow-hidden h-7 flex items-center">
      <Marquee className="[--duration:40s]" pauseOnHover>
        {items.map((item) => (
          <TickerItem key={item.symbol} {...item} />
        ))}
      </Marquee>
    </div>
  )
}
