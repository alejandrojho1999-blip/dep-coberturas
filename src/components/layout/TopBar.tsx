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
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-surface px-4">
        {/* Mobile hamburger */}
        <button
          onClick={onMobileMenuOpen}
          aria-label="Abrir menú"
          className="flex items-center justify-center rounded p-1.5 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:hidden"
        >
          <Menu size={20} />
        </button>

        {/* Desktop brand — slogan de comunicación interna del manual */}
        <div className="hidden md:flex items-center gap-2">
          <span className="font-brand whitespace-nowrap text-[11px] font-extrabold tracking-[0.2em] text-text-primary uppercase">
            When SynerGy Happens
          </span>
          <span className="hidden h-3 w-px bg-border lg:block" />
          <span className="hidden whitespace-nowrap text-[10px] tracking-wide text-text-muted uppercase lg:block">
            Emporium Quant Desk
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {userName && (
            <span className="hidden text-xs text-text-secondary sm:inline font-mono tracking-wide">
              {userName}
            </span>
          )}
          <button
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-raised hover:text-negative"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>
    </div>
  )
}
