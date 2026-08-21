'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Briefcase,
  LineChart,
  FileText,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Settings2,
  Terminal,
  Cpu,
} from 'lucide-react'

const NAV_ITEMS = [
  { icon: Briefcase, label: 'Portafolios',       href: '/portafolios' },
  { icon: Cpu,       label: 'Agentes',           href: '/agentes' },
  { icon: LineChart, label: 'Estrategias',       href: '/estrategias' },
  { icon: FileText,  label: 'Recomendaciones',   href: '/recomendaciones' },
] as const

const STORAGE_KEY = 'sidebar-collapsed'

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
  const isSettingsRoute = pathname === '/perfil' || pathname === '/fincept-terminal'
  const [settingsOpen, setSettingsOpen] = useState(isSettingsRoute)

  // Al navegar a una ruta de Configuración se despliega su submenú. Se ajusta
  // durante el render en vez de en un efecto para no encadenar re-renders;
  // el usuario puede seguir plegándolo a mano después.
  const [lastPathname, setLastPathname] = useState(pathname)
  if (lastPathname !== pathname) {
    setLastPathname(pathname)
    if (isSettingsRoute) setSettingsOpen(true)
  }

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
        onClick={() => {
          if (isActive) document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
        }}
        title={collapsed ? label : undefined}
        className={[
          'mx-2 my-0.5 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors relative',
          isActive
            ? 'bg-accent text-on-accent font-semibold border-l-2 border-white/70 pl-[10px]'
            : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary border-l-2 border-transparent pl-[10px]',
        ].join(' ')}
      >
        <Icon size={18} className="shrink-0" />
        {showLabels && <span className="truncate">{label}</span>}
        {isActive && showLabels && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/70" />
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
          'fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col border-r border-border-subtle bg-surface',
          'transition-transform duration-200 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:relative md:inset-auto md:z-auto md:h-screen md:translate-x-0',
          desktopWidth,
        ].join(' ')}
      >
        {/* Header — logotipo de marca */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-3">
          {showLabels ? (
            <Link href="/portafolios" className="flex items-center" aria-label="SynerGy">
              <Image
                src="/brand/logo-hrz-blanco.png"
                alt="SynerGy"
                width={112}
                height={36}
                priority
                className="h-7 w-auto"
              />
            </Link>
          ) : (
            <Link href="/portafolios" className="flex items-center" aria-label="SynerGy">
              <Image
                src="/brand/isotipo-blanco.png"
                alt="SynerGy"
                width={24}
                height={24}
                priority
                className="h-6 w-6"
              />
            </Link>
          )}

          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            className="ml-auto hidden rounded p-1 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:flex"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          <button
            onClick={onMobileClose}
            aria-label="Cerrar menú"
            className="ml-auto flex rounded p-1 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:hidden"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {showLabels && (
            <p className="mb-1 px-4 font-brand text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              Módulos
            </p>
          )}
          {NAV_ITEMS.map(({ icon, label, href }) => navItem(icon, label, href))}
        </nav>

        {/* Settings — pinned bottom */}
        <div className="shrink-0 border-t border-border-subtle py-3 space-y-0.5">
          {/* Toggle button */}
          <button
            onClick={() => setSettingsOpen(v => !v)}
            title={collapsed && !mobileOpen ? 'Configuración' : undefined}
            className={[
              'mx-2 flex w-[calc(100%-16px)] items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors border-l-2 pl-[10px]',
              settingsOpen
                ? 'bg-accent text-on-accent font-semibold border-white/70'
                : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary border-transparent',
            ].join(' ')}
          >
            <Settings2 size={18} className="shrink-0" />
            {showLabels && <span className="flex-1 truncate text-left">Configuración</span>}
            {showLabels && (
              <ChevronRight
                size={14}
                className={`shrink-0 transition-transform duration-150 ${settingsOpen ? 'rotate-90' : ''}`}
              />
            )}
          </button>

          {/* Submenu */}
          {settingsOpen && (
            <div className="space-y-0.5">
              <Link
                href="/perfil"
                onClick={() => {
                  if (pathname === '/perfil') document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                title={collapsed && !mobileOpen ? 'Mi Perfil' : undefined}
                className={[
                  'mx-2 flex items-center gap-3 rounded-md pl-[22px] pr-3 py-2 text-xs transition-colors border-l-2',
                  pathname === '/perfil'
                    ? 'bg-accent text-on-accent font-semibold border-white/70'
                    : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary border-transparent',
                ].join(' ')}
              >
                <UserCircle size={15} className="shrink-0" />
                {showLabels && <span className="truncate">Mi Perfil</span>}
              </Link>

              <Link
                href="/fincept-terminal"
                onClick={() => {
                  if (pathname === '/fincept-terminal') document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                title={collapsed && !mobileOpen ? 'Fincept Terminal' : undefined}
                className={[
                  'mx-2 flex items-center gap-3 rounded-md pl-[22px] pr-3 py-2 text-xs transition-colors border-l-2',
                  pathname === '/fincept-terminal'
                    ? 'bg-accent text-on-accent font-semibold border-white/70'
                    : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary border-transparent',
                ].join(' ')}
              >
                <Terminal size={15} className="shrink-0" />
                {showLabels && <span className="truncate">Fincept Terminal</span>}
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
