import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  Terminal,
  Download,
  Monitor,
  ExternalLink,
  BookOpen,
  Zap,
  BarChart2,
  Globe,
  Code2,
  Cpu,
} from 'lucide-react'

export default async function FinceptTerminalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="relative rounded-xl border border-[#1e2035] bg-[#0f0f17] p-6 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#F59E0B]/0 via-[#F59E0B]/50 to-[#F59E0B]/0" />
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 shrink-0">
            <Terminal size={26} className="text-[#F59E0B]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-[#F59E0B] uppercase">
                Fincept Corporation
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20">
                Open Source
              </span>
            </div>
            <h1 className="text-2xl font-bold font-mono text-[#F0EFE8] tracking-tight">
              Fincept Terminal
            </h1>
            <p className="text-sm text-[#64748b] mt-1.5 leading-relaxed max-w-2xl">
              Terminal financiera profesional de código abierto para análisis de mercados, datos económicos en tiempo real, noticias financieras y herramientas de inversión avanzadas — todo en una interfaz de línea de comandos.
            </p>
          </div>
        </div>

        {/* Quick action */}
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="https://github.com/Fincept-Corporation/FinceptTerminal?sfnsn=wa"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] px-4 py-2 text-sm font-mono font-bold text-[#07070b] transition-colors"
          >
            <Code2 size={15} />
            Ver en GitHub
            <ExternalLink size={12} />
          </a>
          <a
            href="https://github.com/Fincept-Corporation/FinceptTerminal/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-[#1e2035] bg-[#161622] hover:border-[#374151] px-4 py-2 text-sm font-mono text-[#64748b] hover:text-[#F0EFE8] transition-colors"
          >
            <Download size={15} />
            Releases
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { icon: BarChart2, title: 'Datos de Mercado', desc: 'Cotizaciones en tiempo real de acciones, ETFs, criptomonedas, divisas y materias primas.' },
          { icon: Globe,     title: 'Noticias Financieras', desc: 'Agregador de noticias de fuentes globales con filtros por mercado y sector.' },
          { icon: BookOpen,  title: 'Datos Económicos', desc: 'Indicadores macroeconómicos, informes de bancos centrales y calendarios económicos.' },
          { icon: Zap,       title: 'Alto Rendimiento', desc: 'Construido en Python con interfaz TUI (Textual) — ligero, rápido y extensible.' },
          { icon: Terminal,  title: 'CLI Poderosa', desc: 'Navega por módulos, filtra datos y exporta resultados directamente desde la terminal.' },
          { icon: Code2,     title: 'Open Source', desc: 'Licencia MIT. Contribuye, personaliza o integra en tus propios proyectos.' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-xl border border-[#1e2035] bg-[#0f0f17] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} className="text-[#F59E0B]" />
              <span className="text-xs font-mono font-bold text-[#F0EFE8]">{title}</span>
            </div>
            <p className="text-[11px] text-[#64748b] leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Download */}
      <div className="rounded-xl border border-[#1e2035] bg-[#0f0f17] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1e2035] bg-[#161622]">
          <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-[#374151] uppercase">
            Instalación
          </span>
        </div>
        <div className="p-5 space-y-5">
          {/* Windows */}
          <div className="rounded-lg border border-[#1e2035] bg-[#161622] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Monitor size={16} className="text-[#3b82f6]" />
              <span className="text-sm font-mono font-bold text-[#F0EFE8]">Windows</span>
              <span className="text-[9px] font-mono text-[#374151] ml-1">10 / 11</span>
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-xs text-[#64748b]">Opción 1 — Instalador (.exe):</p>
              <p className="text-[11px] text-[#374151]">Descarga el instalador desde la página de releases y ejecútalo como administrador.</p>
              <p className="text-xs text-[#64748b] mt-2">Opción 2 — pip (requiere Python 3.10+):</p>
              <code className="block text-xs font-mono text-[#22c55e] bg-[#0f0f17] rounded px-3 py-2 border border-[#1e2035]">
                pip install fincept-terminal
              </code>
            </div>
            <a
              href="https://github.com/Fincept-Corporation/FinceptTerminal/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[#3b82f6]/30 bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 px-3 py-1.5 text-xs font-mono text-[#3b82f6] transition-colors"
            >
              <Download size={12} />
              Descargar para Windows
              <ExternalLink size={10} />
            </a>
          </div>

          {/* macOS */}
          <div className="rounded-lg border border-[#1e2035] bg-[#161622] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cpu size={16} className="text-[#64748b]" />
              <span className="text-sm font-mono font-bold text-[#F0EFE8]">macOS</span>
              <span className="text-[9px] font-mono text-[#374151] ml-1">12+ / Apple Silicon & Intel</span>
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-xs text-[#64748b]">Opción 1 — pip (requiere Python 3.10+):</p>
              <code className="block text-xs font-mono text-[#22c55e] bg-[#0f0f17] rounded px-3 py-2 border border-[#1e2035]">
                pip install fincept-terminal
              </code>
              <p className="text-xs text-[#64748b] mt-2">Opción 2 — Homebrew (si está disponible):</p>
              <code className="block text-xs font-mono text-[#22c55e] bg-[#0f0f17] rounded px-3 py-2 border border-[#1e2035]">
                brew install fincept-terminal
              </code>
            </div>
            <a
              href="https://github.com/Fincept-Corporation/FinceptTerminal/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[#64748b]/30 bg-[#64748b]/10 hover:bg-[#64748b]/20 px-3 py-1.5 text-xs font-mono text-[#64748b] hover:text-[#F0EFE8] transition-colors"
            >
              <Download size={12} />
              Descargar para macOS
              <ExternalLink size={10} />
            </a>
          </div>

          {/* Linux */}
          <div className="rounded-lg border border-[#1e2035] bg-[#161622] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Terminal size={16} className="text-[#22c55e]" />
              <span className="text-sm font-mono font-bold text-[#F0EFE8]">Linux</span>
              <span className="text-[9px] font-mono text-[#374151] ml-1">Ubuntu, Debian, Fedora, Arch…</span>
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-xs text-[#64748b]">pip (método universal):</p>
              <code className="block text-xs font-mono text-[#22c55e] bg-[#0f0f17] rounded px-3 py-2 border border-[#1e2035]">
                pip install fincept-terminal
              </code>
              <p className="text-xs text-[#64748b] mt-2">Ejecutar tras instalar:</p>
              <code className="block text-xs font-mono text-[#22c55e] bg-[#0f0f17] rounded px-3 py-2 border border-[#1e2035]">
                fincept
              </code>
            </div>
            <a
              href="https://github.com/Fincept-Corporation/FinceptTerminal/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 hover:bg-[#22c55e]/20 px-3 py-1.5 text-xs font-mono text-[#22c55e] transition-colors"
            >
              <Download size={12} />
              Descargar para Linux
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div className="flex items-start gap-2 px-1 pb-4">
        <Code2 size={11} className="text-[#374151] shrink-0 mt-0.5" />
        <p className="text-[10px] font-mono text-[#374151] leading-relaxed">
          Fincept Terminal es un proyecto open-source mantenido por Fincept Corporation.
          Para reportar bugs, solicitar funcionalidades o contribuir, visita el repositorio en GitHub:
          {' '}
          <a
            href="https://github.com/Fincept-Corporation/FinceptTerminal?sfnsn=wa"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#F59E0B] hover:underline"
          >
            github.com/Fincept-Corporation/FinceptTerminal
          </a>
        </p>
      </div>
    </div>
  )
}
