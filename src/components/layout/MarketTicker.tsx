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
      <span className="text-[10px] font-semibold tracking-wide text-[#64748b] uppercase">
        {symbol}
      </span>
      <span className={`text-[10px] font-mono ${isPlaceholder ? 'text-[#374151]' : 'text-[#F0EFE8]'}`}>
        {value}
      </span>
      {!isPlaceholder && (
        <span className={`flex items-center gap-0.5 text-[10px] font-mono ${up ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          <Icon size={10} />
          {change}
        </span>
      )}
      <span className="text-[#1e2035]">|</span>
    </span>
  )
}

export function MarketTicker() {
  const [items, setItems] = useState<QuoteItem[]>(FALLBACK)

  async function fetchQuotes() {
    try {
      const res = await fetch('/api/market/quotes', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json() as QuoteItem[]
      if (Array.isArray(data) && data.length > 0) setItems(data)
    } catch {
      // keep showing previous data silently
    }
  }

  useEffect(() => {
    fetchQuotes()
    const id = setInterval(fetchQuotes, 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="border-b border-[#1e2035] bg-[#0f0f17] overflow-hidden h-7 flex items-center">
      <Marquee className="[--duration:40s]" pauseOnHover>
        {items.map((item) => (
          <TickerItem key={item.symbol} {...item} />
        ))}
      </Marquee>
    </div>
  )
}
