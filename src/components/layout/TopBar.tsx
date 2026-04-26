'use client'

import { useRouter } from 'next/navigation'
import { LogOut, Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MarketTicker } from './MarketTicker'

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
      {/* Market ticker strip — live data */}
      <MarketTicker />

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
