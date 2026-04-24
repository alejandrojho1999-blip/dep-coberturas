'use client'

interface Props {
  onStart: () => void
}

const steps = [
  {
    num: '01',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
        <path d="M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M5.64 18.36l2.12-2.12M16.24 7.76l2.12-2.12" strokeLinecap="round" />
      </svg>
    ),
    color: 'text-[#3b82f6]',
    bg: 'bg-[#3b82f6]/10',
    border: 'border-[#3b82f6]/30',
    title: 'Identifica el Ticker',
    desc: 'Busca cualquier activo. La IA extrae las variables causales relevantes del informe IR.',
  },
  {
    num: '02',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4z" strokeLinejoin="round" />
        <path d="M6 8v4M12 8v4M18 8v4" strokeLinecap="round" />
        <path d="M6 12h12" strokeLinecap="round" />
        <path d="M12 12v4" strokeLinecap="round" />
        <rect x="8" y="16" width="8" height="4" strokeLinejoin="round" />
      </svg>
    ),
    color: 'text-[#f59e0b]',
    bg: 'bg-[#f59e0b]/10',
    border: 'border-[#f59e0b]/30',
    title: 'Construye el DAG',
    desc: 'Define relaciones causales entre variables. Controla confusores, excluye colisionadores.',
  },
  {
    num: '03',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 17l4-8 4 4 4-6 4 10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 21h18" strokeLinecap="round" />
      </svg>
    ),
    color: 'text-[#00ff88]',
    bg: 'bg-[#00ff88]/10',
    border: 'border-[#00ff88]/30',
    title: 'Obtén la Señal Causal',
    desc: 'OLS ajustado por backdoor criterion. Score 0–100 con señal AUMENTAR / MANTENER / REDUCIR.',
  },
]

export default function EmptyState({ onStart }: Props) {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative rounded-2xl border border-[#1e1e2e] bg-[#0d0d14] overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#3b82f6]/5 via-transparent to-[#00ff88]/5 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-[#3b82f6]/10 blur-3xl pointer-events-none" />

        <div className="relative px-8 py-12 text-center max-w-2xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/20 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
            <span className="text-xs font-medium text-[#00ff88] tracking-wide uppercase">Causal Inference · Portfolio Management</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-[#e2e8f0] mb-4 leading-tight">
            Inversión basada en{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3b82f6] to-[#00ff88]">
              Causalidad Real
            </span>
          </h1>

          <p className="text-[#94a3b8] text-base leading-relaxed mb-8">
            La mayoría de los modelos cuantitativos correlacionan. Este detecta{' '}
            <span className="text-[#e2e8f0] font-medium">efectos causales reales</span> usando el criterio
            backdoor, control de confusores y permutation tests — el mismo marco de{' '}
            <span className="text-[#e2e8f0] font-medium">López de Prado (2025)</span>.
          </p>

          <button
            onClick={onStart}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white font-semibold text-base shadow-lg shadow-[#3b82f6]/25 hover:shadow-[#3b82f6]/40 hover:from-[#2563eb] hover:to-[#1d4ed8] transition-all duration-200 cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
            Agregar mi primer activo
          </button>

          <p className="text-[#475569] text-xs mt-4">
            Busca por ticker (AAPL, MSFT, GOOG…) · La IA extrae variables automáticamente
          </p>
        </div>
      </div>

      {/* Mini DAG illustration */}
      <div className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] p-6">
        <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-5 text-center">
          Ejemplo de estructura causal — Apple Inc. (AAPL)
        </p>
        <div className="flex items-center justify-center gap-0 overflow-x-auto">
          <MiniDag />
        </div>
        <p className="text-xs text-[#475569] text-center mt-4">
          YIELD_10Y y VIX son confusores: afectan tanto al tratamiento (FED_RATE) como al resultado futuro.
          Controlarlos elimina el sesgo de variable omitida.
        </p>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.num}
            className={`rounded-xl border ${step.border} bg-[#0a0a0f] p-5 space-y-3 hover:bg-[#0d0d14] transition-colors`}
          >
            <div className="flex items-center justify-between">
              <div className={`w-10 h-10 rounded-lg ${step.bg} ${step.color} flex items-center justify-center`}>
                {step.icon}
              </div>
              <span className="text-2xl font-bold text-[#1e1e2e]">{step.num}</span>
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${step.color} mb-1`}>{step.title}</h3>
              <p className="text-xs text-[#64748b] leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Ghost metrics preview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Score Causal', value: '—', unit: '/ 100' },
          { label: 'Señal', value: '—', unit: '' },
          { label: 'p-valor placebo', value: '—', unit: '' },
          { label: 'β ajustado', value: '—', unit: '' },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] p-4 text-center">
            <div className="text-2xl font-bold text-[#1e1e2e] mb-1">{m.value}<span className="text-sm ml-1">{m.unit}</span></div>
            <div className="text-xs text-[#334155]">{m.label}</div>
          </div>
        ))}
      </div>

      {/* CTA footer */}
      <div className="text-center pb-4">
        <button
          onClick={onStart}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] text-[#64748b] text-sm hover:border-[#3b82f6] hover:text-[#e2e8f0] transition-all duration-200 cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
          Comenzar ahora — es gratis
        </button>
      </div>
    </div>
  )
}

function MiniDag() {
  const nodes = [
    { id: 'YIELD', x: 40, y: 30, label: 'YIELD_10Y', color: '#f59e0b' },
    { id: 'VIX', x: 40, y: 100, label: 'VIX', color: '#f59e0b' },
    { id: 'FED', x: 200, y: 65, label: 'FED_RATE', color: '#3b82f6' },
    { id: 'RETURN', x: 360, y: 65, label: 'FutureReturn', color: '#00ff88' },
  ]

  const edges = [
    { x1: 120, y1: 38, x2: 178, y2: 60 },
    { x1: 120, y1: 100, x2: 178, y2: 75 },
    { x1: 278, y1: 65, x2: 340, y2: 65 },
    { x1: 120, y1: 38, x2: 340, y2: 60 },
    { x1: 120, y1: 100, x2: 340, y2: 70 },
  ]

  return (
    <svg width="460" height="140" viewBox="0 0 460 140" className="max-w-full">
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#334155" />
        </marker>
      </defs>

      {/* Edges */}
      {edges.map((e, i) => (
        <line
          key={i}
          x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
          stroke="#334155"
          strokeWidth="1.5"
          markerEnd="url(#arrow)"
          strokeDasharray={i >= 3 ? '4 3' : undefined}
        />
      ))}

      {/* Nodes */}
      {nodes.map((n) => (
        <g key={n.id}>
          <rect
            x={n.x} y={n.y - 14}
            width={n.label.length * 7.2 + 16}
            height={28}
            rx="6"
            fill="#0a0a0f"
            stroke={n.color}
            strokeWidth="1.5"
          />
          <text
            x={n.x + (n.label.length * 7.2 + 16) / 2}
            y={n.y + 5}
            textAnchor="middle"
            fill={n.color}
            fontSize="10"
            fontFamily="monospace"
            fontWeight="600"
          >
            {n.label}
          </text>
        </g>
      ))}

      {/* Labels */}
      <text x="80" y="135" textAnchor="middle" fill="#475569" fontSize="9" fontFamily="sans-serif">Confusores</text>
      <text x="220" y="100" textAnchor="middle" fill="#475569" fontSize="9" fontFamily="sans-serif">Tratamiento</text>
      <text x="395" y="100" textAnchor="middle" fill="#475569" fontSize="9" fontFamily="sans-serif">Resultado</text>
    </svg>
  )
}
