'use client'

import { useRouter } from 'next/navigation'
import { LogOut, Menu, TrendingUp, TrendingDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Marquee } from '@/components/ui/marquee'

const TICKER_DATA = [
  { symbol: 'S&P 500', value: '5,892.40', change: '+0.34%', up: true },
  { symbol: 'NDX',     value: '21,045.10', change: '+0.51%', up: true },
  { symbol: 'DJI',     value: '43,628.80', change: '-0.12%', up: false },
  { symbol: 'VIX',     value: '14.22',    change: '-1.85%', up: false },
  { symbol: 'BTC/USD', value: '97,340',   change: '+1.23%', up: true },
  { symbol: 'GOLD',    value: '2,641.50',  change: '+0.18%', up: true },
  { symbol: 'WTI',     value: '71.84',    change: '-0.44%', up: false },
  { symbol: 'EUR/USD', value: '1.0832',   change: '+0.09%', up: true },
]

function TickerItem({ symbol, value, change, up }: (typeof TICKER_DATA)[number]) {
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className="flex items-center gap-1.5 px-4">
      <span className="text-[10px] font-semibold tracking-wide text-[#64748b] uppercase">
        {symbol}
      </span>
      <span className="text-[10px] font-mono text-[#F0EFE8]">{value}</span>
      <span className={`flex items-center gap-0.5 text-[10px] font-mono ${up ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
        <Icon size={10} />
        {change}
      </span>
      <span className="text-[#1e2035]">|</span>
    </span>
  )
}

interface TopBarProps {
  userName?: string
  onMobileMenuOpen: () => void
}

export function TopBar({ userName, onMobileMenuOpen }: TopBarProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="shrink-0">
      {/* Market ticker strip */}
      <div className="border-b border-[#1e2035] bg-[#0f0f17] overflow-hidden h-7 flex items-center">
        <Marquee className="[--duration:40s]" pauseOnHover>
          {TICKER_DATA.map((item) => (
            <TickerItem key={item.symbol} {...item} />
          ))}
        </Marquee>
      </div>

      {/* Main header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#1e2035] bg-[#0f0f17] px-4">
        {/* Mobile hamburger */}
        <button
          onClick={onMobileMenuOpen}
          aria-label="Abrir menú"
          className="flex items-center justify-center rounded p-1.5 text-[#64748b] transition-colors hover:bg-[#161622] hover:text-[#F0EFE8] md:hidden"
        >
          <Menu size={20} />
        </button>

        {/* Desktop brand */}
        <div className="hidden md:flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-[0.2em] text-[#F59E0B] font-mono uppercase">
            EQF Terminal
          </span>
          <span className="h-3 w-px bg-[#1e2035]" />
          <span className="text-[10px] tracking-wide text-[#374151] uppercase font-mono">
            Sistema de Análisis de Riesgos
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {userName && (
            <span className="hidden text-xs text-[#64748b] sm:inline font-mono tracking-wide">
              {userName}
            </span>
          )}
          <button
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-[#64748b] transition-colors hover:bg-[#161622] hover:text-red-400"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>
    </div>
  )
}
