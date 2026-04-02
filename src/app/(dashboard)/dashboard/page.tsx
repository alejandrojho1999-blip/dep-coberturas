import { LayoutDashboard, TrendingUp, Shield, BookOpen } from 'lucide-react'
import Link from 'next/link'

const STAT_CARDS = [
  { label: 'Tickers analizados', value: '—', icon: TrendingUp, href: '/inversion-causal' },
  { label: 'Portafolios activos', value: '—', icon: LayoutDashboard, href: '/portafolios' },
  { label: 'Cobertura activa', value: '—', icon: Shield, href: '/coberturas' },
  { label: 'Track record del mes', value: '—', icon: BookOpen, href: '/coberturas' },
] as const

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#e2e8f0]">Dashboard</h1>
        <p className="mt-1 text-sm text-[#64748b]">
          Sistema de Análisis de Riesgos — Departamento de Coberturas
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ label, value, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="group rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5 transition-colors hover:border-[#00ff88]/30"
          >
            <div className="flex items-center justify-between">
              <Icon size={18} className="text-[#64748b] group-hover:text-[#00ff88] transition-colors" />
            </div>
            <p className="mt-4 text-3xl font-bold text-[#e2e8f0]">{value}</p>
            <p className="mt-1 text-sm text-[#64748b]">{label}</p>
          </Link>
        ))}
      </div>

      {/* Accesos rápidos */}
      <div>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[#64748b]">
          Módulos
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Inversión Causal', description: 'Análisis de hipótesis y catalizadores', href: '/inversion-causal' },
            { label: 'Portafolios Híbridos', description: 'Construcción y ponderación de portafolios', href: '/portafolios' },
            { label: 'Agente PPO', description: 'Monitoreo continuo y rebalanceo automatizado', href: '/agente-ppo' },
            { label: 'Coberturas', description: 'Opciones financieras y futuros', href: '/coberturas' },
          ].map(({ label, description, href }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4 transition-colors hover:border-[#00ff88]/30 hover:bg-[#1e1e2e]"
            >
              <p className="font-medium text-[#e2e8f0]">{label}</p>
              <p className="mt-1 text-xs text-[#64748b]">{description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
