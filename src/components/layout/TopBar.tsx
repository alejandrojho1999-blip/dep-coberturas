'use client'

import { useRouter } from 'next/navigation'
import { LogOut, Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#1e1e2e] bg-[#12121a] px-4">
      {/* Mobile hamburger */}
      <button
        onClick={onMobileMenuOpen}
        aria-label="Abrir menú"
        className="flex items-center justify-center rounded p-1.5 text-[#64748b] transition-colors hover:bg-[#1e1e2e] hover:text-[#e2e8f0] md:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Desktop spacer */}
      <div className="hidden md:block" />

      {/* Right side */}
      <div className="flex items-center gap-3">
        {userName && (
          <span className="hidden text-sm text-[#64748b] sm:inline">{userName}</span>
        )}
        <button
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-[#64748b] transition-colors hover:bg-[#1e1e2e] hover:text-red-400"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  )
}
