'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  TrendingUp,
  BarChart2,
  Bot,
  Shield,
  UserCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: TrendingUp, label: 'Inversión Causal', href: '/inversion-causal' },
  { icon: BarChart2, label: 'Portafolios Híbridos', href: '/portafolios' },
  { icon: Bot, label: 'Agente PPO', href: '/agente-ppo' },
  { icon: Shield, label: 'Coberturas', href: '/coberturas' },
] as const

const PROFILE_ITEM = { icon: UserCircle, label: 'Mi Perfil', href: '/perfil' }

const STORAGE_KEY = 'sidebar-collapsed'

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setCollapsed(stored === 'true')
    }
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  const width = collapsed ? 'w-[60px]' : 'w-[240px]'

  return (
    <aside
      className={`${width} flex h-screen flex-col border-r border-[#1e1e2e] bg-[#12121a] transition-all duration-200`}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between px-3 border-b border-[#1e1e2e]">
        {!collapsed && (
          <span className="text-sm font-semibold text-[#00ff88] truncate">
            Dep. Coberturas
          </span>
        )}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          className="ml-auto rounded p-1 text-[#64748b] hover:bg-[#1e1e2e] hover:text-[#e2e8f0] transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav principal */}
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`
                flex items-center gap-3 px-3 py-2.5 mx-2 my-0.5 rounded-md text-sm transition-colors
                ${isActive
                  ? 'bg-[#1e1e2e] text-[#00ff88]'
                  : 'text-[#64748b] hover:bg-[#1e1e2e] hover:text-[#e2e8f0]'
                }
              `}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
              {isActive && !collapsed && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#00ff88]" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Mi Perfil — fijo al fondo */}
      <div className="border-t border-[#1e1e2e] py-3">
        <Link
          href={PROFILE_ITEM.href}
          title={collapsed ? PROFILE_ITEM.label : undefined}
          className={`
            flex items-center gap-3 px-3 py-2.5 mx-2 rounded-md text-sm transition-colors
            ${pathname === PROFILE_ITEM.href
              ? 'bg-[#1e1e2e] text-[#00ff88]'
              : 'text-[#64748b] hover:bg-[#1e1e2e] hover:text-[#e2e8f0]'
            }
          `}
        >
          <PROFILE_ITEM.icon size={18} className="shrink-0" />
          {!collapsed && <span className="truncate">{PROFILE_ITEM.label}</span>}
        </Link>
      </div>
    </aside>
  )
}
