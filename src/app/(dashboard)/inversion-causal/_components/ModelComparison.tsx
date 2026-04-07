'use client'
import type { ModelComparison } from '@/lib/causal/types'

interface Props { models: ModelComparison }

export default function ModelComparisonPanel({ models }: Props) {
  const rows = [
    { label: 'Naive OLS', result: models.naive, showFlip: false },
    { label: '+ Colisionadores', result: models.withColliders, showFlip: true },
    { label: 'Causal (correcto)', result: models.causal, showFlip: false },
  ]

  return (
    <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
      <h3 className="text-[#e2e8f0] font-semibold text-base mb-1">Comparación de Modelos</h3>
      <p className="text-[#64748b] text-xs mb-4">
        Detecta collider bias: incluir PE_RATIO invierte el signo de β
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e2e]">
              <th className="text-left py-2 pr-4 text-[#64748b] font-medium">Modelo</th>
              <th className="text-right py-2 px-4 text-[#64748b] font-medium">β_treatment</th>
              <th className="text-right py-2 px-4 text-[#64748b] font-medium">p-value</th>
              <th className="text-right py-2 px-4 text-[#64748b] font-medium">R²_adj</th>
              <th className="text-right py-2 pl-4 text-[#64748b] font-medium">Sign_flip</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, result, showFlip }) => {
              const beta = result.coefficients['treatment'] ?? Object.values(result.coefficients)[0] ?? 0
              const pVal = result.pValues['treatment'] ?? Object.values(result.pValues)[0] ?? 1
              const isHighP = pVal > 0.05
              return (
                <tr key={label} className="border-b border-[#1e1e2e]/50 last:border-0">
                  <td className="py-3 pr-4 text-[#e2e8f0]">{label}</td>
                  <td className="py-3 px-4 text-right text-[#3b82f6] font-mono">
                    {beta.toFixed(4)}
                  </td>
                  <td className={`py-3 px-4 text-right font-mono ${isHighP ? 'text-red-400' : 'text-[#e2e8f0]'}`}>
                    {pVal.toFixed(3)}
                  </td>
                  <td className="py-3 px-4 text-right text-[#e2e8f0] font-mono">
                    {result.r2adj.toFixed(3)}
                  </td>
                  <td className="py-3 pl-4 text-right">
                    {showFlip && models.signFlipDetected ? (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-400">
                        ⚠ FLIP!
                      </span>
                    ) : (
                      <span className="text-[#64748b]">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
