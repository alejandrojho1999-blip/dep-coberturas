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
  Terminal,
} from 'lucide-react'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',            href: '/dashboard' },
  { icon: TrendingUp,      label: 'Inversión Causal',     href: '/inversion-causal' },
  { icon: BarChart2,       label: 'Portafolios Híbridos', href: '/portafolios' },
  { icon: Bot,             label: 'Agente PPO',           href: '/agente-ppo' },
  { icon: Shield,          label: 'Coberturas',           href: '/coberturas' },
  { icon: FileText,        label: 'Informes',             href: '/informes' },
] as const

const INTEGRATION_ITEMS = [
  { icon: Terminal, label: 'EQF Terminal', href: '/eqf-terminal' },
] as const

const PROFILE_ITEM = { icon: UserCircle, label: 'Mi Perfil', href: '/perfil' }
const STORAGE_KEY  = 'sidebar-collapsed'

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })

  useEffect(() => {
    onMobileClose()
  }, [pathname, onMobileClose])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  const desktopWidth = collapsed ? 'md:w-[60px]' : 'md:w-[240px]'
  const showLabels = !collapsed || mobileOpen

  function navItem(icon: React.ElementType, label: string, href: string) {
    const Icon = icon
    const isActive = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link
        key={href}
        href={href}
        title={collapsed ? label : undefined}
        className={[
          'mx-2 my-0.5 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors relative',
          isActive
            ? 'bg-[#161622] text-[#F59E0B] border-l-2 border-[#F59E0B] pl-[10px]'
            : 'text-[#64748b] hover:bg-[#161622] hover:text-[#F0EFE8] border-l-2 border-transparent pl-[10px]',
        ].join(' ')}
      >
        <Icon size={18} className="shrink-0" />
        {showLabels && <span className="truncate">{label}</span>}
        {isActive && showLabels && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
        )}
      </Link>
    )
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col border-r border-[#1e2035] bg-[#0f0f17]',
          'transition-transform duration-200 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:relative md:inset-auto md:z-auto md:h-screen md:translate-x-0',
          desktopWidth,
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#1e2035] px-3">
          {showLabels && (
            <div className="flex items-center gap-2 truncate">
              <span className="text-xs font-bold tracking-[0.15em] text-[#F59E0B] font-mono uppercase">
                EQF
              </span>
              <span className="h-3 w-px bg-[#1e2035]" />
              <span className="truncate text-xs font-medium tracking-wide text-[#64748b] uppercase">
                Coberturas
              </span>
            </div>
          )}

          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            className="ml-auto hidden rounded p-1 text-[#64748b] transition-colors hover:bg-[#161622] hover:text-[#F0EFE8] md:flex"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          <button
            onClick={onMobileClose}
            aria-label="Cerrar menú"
            className="ml-auto flex rounded p-1 text-[#64748b] transition-colors hover:bg-[#161622] hover:text-[#F0EFE8] md:hidden"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {showLabels && (
            <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#374151]">
              Módulos
            </p>
          )}
          {NAV_ITEMS.map(({ icon, label, href }) => navItem(icon, label, href))}

          <div className="my-3 mx-4 h-px bg-[#1e2035]" />

          {showLabels && (
            <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#374151]">
              Integraciones
            </p>
          )}
          {INTEGRATION_ITEMS.map(({ icon, label, href }) => navItem(icon, label, href))}
        </nav>

        {/* Mi Perfil — pinned bottom */}
        <div className="shrink-0 border-t border-[#1e2035] py-3">
          <Link
            href={PROFILE_ITEM.href}
            title={collapsed ? PROFILE_ITEM.label : undefined}
            className={[
              'mx-2 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors border-l-2 pl-[10px]',
              pathname === PROFILE_ITEM.href
                ? 'bg-[#161622] text-[#F59E0B] border-[#F59E0B]'
                : 'text-[#64748b] hover:bg-[#161622] hover:text-[#F0EFE8] border-transparent',
            ].join(' ')}
          >
            <PROFILE_ITEM.icon size={18} className="shrink-0" />
            {showLabels && <span className="truncate">{PROFILE_ITEM.label}</span>}
          </Link>
        </div>
      </aside>
    </>
  )
}
