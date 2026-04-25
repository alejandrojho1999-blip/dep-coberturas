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
  FileText,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',          href: '/dashboard' },
  { icon: TrendingUp,      label: 'Inversión Causal',   href: '/inversion-causal' },
  { icon: BarChart2,       label: 'Portafolios Híbridos', href: '/portafolios' },
  { icon: Bot,             label: 'Agente PPO',          href: '/agente-ppo' },
  { icon: Shield,          label: 'Coberturas',          href: '/coberturas' },
  { icon: FileText,        label: 'Informes',            href: '/informes' },
] as const

const PROFILE_ITEM = { icon: UserCircle, label: 'Mi Perfil', href: '/perfil' }
const STORAGE_KEY  = 'sidebar-collapsed'

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) setCollapsed(stored === 'true')
  }, [])

  // Close drawer when the user navigates
  useEffect(() => {
    onMobileClose()
  }, [pathname, onMobileClose])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  const desktopWidth = collapsed ? 'md:w-[60px]' : 'md:w-[240px]'

  return (
    <>
      {/* Backdrop — mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col border-r border-[#1e1e2e] bg-[#12121a]',
          'transition-transform duration-200 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: back to normal flow, respect collapsed width
          'md:relative md:inset-auto md:z-auto md:h-screen md:translate-x-0',
          desktopWidth,
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#1e1e2e] px-3">
          {!collapsed && (
            <span className="truncate text-sm font-semibold text-[#00ff88]">
              Dep. Coberturas
            </span>
          )}

          {/* Desktop: collapse toggle */}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            className="ml-auto hidden rounded p-1 text-[#64748b] transition-colors hover:bg-[#1e1e2e] hover:text-[#e2e8f0] md:flex"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          {/* Mobile: close button */}
          <button
            onClick={onMobileClose}
            aria-label="Cerrar menú"
            className="ml-auto flex rounded p-1 text-[#64748b] transition-colors hover:bg-[#1e1e2e] hover:text-[#e2e8f0] md:hidden"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={[
                  'mx-2 my-0.5 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-[#1e1e2e] text-[#00ff88]'
                    : 'text-[#64748b] hover:bg-[#1e1e2e] hover:text-[#e2e8f0]',
                ].join(' ')}
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

        {/* Mi Perfil — pinned bottom */}
        <div className="shrink-0 border-t border-[#1e1e2e] py-3">
          <Link
            href={PROFILE_ITEM.href}
            title={collapsed ? PROFILE_ITEM.label : undefined}
            className={[
              'mx-2 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
              pathname === PROFILE_ITEM.href
                ? 'bg-[#1e1e2e] text-[#00ff88]'
                : 'text-[#64748b] hover:bg-[#1e1e2e] hover:text-[#e2e8f0]',
            ].join(' ')}
          >
            <PROFILE_ITEM.icon size={18} className="shrink-0" />
            {!collapsed && <span className="truncate">{PROFILE_ITEM.label}</span>}
          </Link>
        </div>
      </aside>
    </>
  )
}
