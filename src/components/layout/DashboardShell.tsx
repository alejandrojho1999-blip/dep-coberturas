'use client'

import { useState, useCallback } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

interface DashboardShellProps {
  userName?: string
  children: React.ReactNode
}

export function DashboardShell({ userName, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const openMobile  = useCallback(() => setMobileOpen(true), [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  return (
    <div className="flex h-screen bg-background">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={closeMobile} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar userName={userName} onMobileMenuOpen={openMobile} />
        <main className="bg-patronaje flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
