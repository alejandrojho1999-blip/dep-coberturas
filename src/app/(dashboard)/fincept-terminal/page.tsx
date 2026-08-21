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
      <div className="relative rounded-xl border border-border bg-surface p-6 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent/0 via-accent/50 to-accent/0" />
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-accent/10 border border-accent/20 shrink-0">
            <Terminal size={26} className="text-text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-text-primary uppercase">
                Fincept Corporation
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-positive/10 text-positive border border-positive/20">
                Open Source
              </span>
            </div>
            <h1 className="text-2xl font-bold font-mono text-text-primary tracking-tight">
              Fincept Terminal
            </h1>
            <p className="text-sm text-text-secondary mt-1.5 leading-relaxed max-w-2xl">
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
            className="flex items-center gap-2 rounded-lg bg-accent hover:bg-accent-hover px-4 py-2 text-sm font-mono font-bold text-on-accent transition-colors"
          >
            <Code2 size={15} />
            Ver en GitHub
            <ExternalLink size={12} />
          </a>
          <a
            href="https://github.com/Fincept-Corporation/FinceptTerminal/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised hover:border-border px-4 py-2 text-sm font-mono text-text-secondary hover:text-text-primary transition-colors"
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
          <div key={title} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} className="text-text-primary" />
              <span className="text-xs font-mono font-bold text-text-primary">{title}</span>
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Download */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-surface-raised">
          <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-text-muted uppercase">
            Instalación
          </span>
        </div>
        <div className="p-5 space-y-5">
          {/* Windows */}
          <div className="rounded-lg border border-border bg-surface-raised p-4">
            <div className="flex items-center gap-2 mb-3">
              <Monitor size={16} className="text-info" />
              <span className="text-sm font-mono font-bold text-text-primary">Windows</span>
              <span className="text-[9px] font-mono text-text-muted ml-1">10 / 11</span>
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-xs text-text-secondary">Opción 1 — Instalador (.exe):</p>
              <p className="text-[11px] text-text-muted">Descarga el instalador desde la página de releases y ejecútalo como administrador.</p>
              <p className="text-xs text-text-secondary mt-2">Opción 2 — pip (requiere Python 3.10+):</p>
              <code className="block text-xs font-mono text-positive bg-surface rounded px-3 py-2 border border-border">
                pip install fincept-terminal
              </code>
            </div>
            <a
              href="https://github.com/Fincept-Corporation/FinceptTerminal/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-info/30 bg-info/10 hover:bg-info/20 px-3 py-1.5 text-xs font-mono text-info transition-colors"
            >
              <Download size={12} />
              Descargar para Windows
              <ExternalLink size={10} />
            </a>
          </div>

          {/* macOS */}
          <div className="rounded-lg border border-border bg-surface-raised p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cpu size={16} className="text-text-secondary" />
              <span className="text-sm font-mono font-bold text-text-primary">macOS</span>
              <span className="text-[9px] font-mono text-text-muted ml-1">12+ / Apple Silicon & Intel</span>
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-xs text-text-secondary">Opción 1 — pip (requiere Python 3.10+):</p>
              <code className="block text-xs font-mono text-positive bg-surface rounded px-3 py-2 border border-border">
                pip install fincept-terminal
              </code>
              <p className="text-xs text-text-secondary mt-2">Opción 2 — Homebrew (si está disponible):</p>
              <code className="block text-xs font-mono text-positive bg-surface rounded px-3 py-2 border border-border">
                brew install fincept-terminal
              </code>
            </div>
            <a
              href="https://github.com/Fincept-Corporation/FinceptTerminal/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border/30 bg-surface-hover/10 hover:bg-surface-hover/20 px-3 py-1.5 text-xs font-mono text-text-secondary hover:text-text-primary transition-colors"
            >
              <Download size={12} />
              Descargar para macOS
              <ExternalLink size={10} />
            </a>
          </div>

          {/* Linux */}
          <div className="rounded-lg border border-border bg-surface-raised p-4">
            <div className="flex items-center gap-2 mb-3">
              <Terminal size={16} className="text-positive" />
              <span className="text-sm font-mono font-bold text-text-primary">Linux</span>
              <span className="text-[9px] font-mono text-text-muted ml-1">Ubuntu, Debian, Fedora, Arch…</span>
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-xs text-text-secondary">pip (método universal):</p>
              <code className="block text-xs font-mono text-positive bg-surface rounded px-3 py-2 border border-border">
                pip install fincept-terminal
              </code>
              <p className="text-xs text-text-secondary mt-2">Ejecutar tras instalar:</p>
              <code className="block text-xs font-mono text-positive bg-surface rounded px-3 py-2 border border-border">
                fincept
              </code>
            </div>
            <a
              href="https://github.com/Fincept-Corporation/FinceptTerminal/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-positive/30 bg-positive/10 hover:bg-positive/20 px-3 py-1.5 text-xs font-mono text-positive transition-colors"
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
        <Code2 size={11} className="text-text-muted shrink-0 mt-0.5" />
        <p className="text-[10px] font-mono text-text-muted leading-relaxed">
          Fincept Terminal es un proyecto open-source mantenido por Fincept Corporation.
          Para reportar bugs, solicitar funcionalidades o contribuir, visita el repositorio en GitHub:
          {' '}
          <a
            href="https://github.com/Fincept-Corporation/FinceptTerminal?sfnsn=wa"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-primary hover:underline"
          >
            github.com/Fincept-Corporation/FinceptTerminal
          </a>
        </p>
      </div>
    </div>
  )
}
