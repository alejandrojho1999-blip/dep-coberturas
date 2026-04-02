'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface TopBarProps {
  userName?: string
}

export function TopBar({ userName }: TopBarProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-[#1e1e2e] bg-[#12121a] px-4">
      <div />
      <div className="flex items-center gap-3">
        {userName && (
          <span className="text-sm text-[#64748b]">{userName}</span>
        )}
        <button
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-[#64748b] hover:bg-[#1e1e2e] hover:text-red-400 transition-colors"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  )
}
