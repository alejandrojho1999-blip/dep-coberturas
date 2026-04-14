'use client'

import type { HedgeAnalysis, OptionInput } from '@/lib/options/types'

interface Props {
  analysis: HedgeAnalysis
  hedgingOption: OptionInput
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? '+' : ''
  return `${sign}$${pnl.toFixed(2)}`
}

function pnlColor(pnl: number): string {
  if (pnl > 0) return 'text-[#00ff88]'
  if (pnl < 0) return 'text-red-400'
  return 'text-[#64748b]'
}

export default function HedgeAnalyzer({ analysis, hedgingOption }: Props) {
  const { portfolioDelta, contractsToHedge, scenarios } = analysis

  const action = contractsToHedge >= 0 ? 'comprar' : 'vender'
  const absContracts = Math.abs(contractsToHedge)
  const optionLabel = `${hedgingOption.type} strike ${hedgingOption.K}`

  return (
    <div className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] p-5 space-y-4">
      <h2 className="text-sm font-semibold text-[#e2e8f0]">Análisis de Cobertura</h2>

      <div className="border-t border-[#1e1e2e]" />

      {/* Portfolio delta */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#64748b]">Delta total del portafolio</span>
        <span className={`font-mono font-semibold text-sm ${portfolioDelta >= 0 ? 'text-[#00ff88]' : 'text-red-400'}`}>
          {portfolioDelta.toFixed(2)}
        </span>
      </div>

      {/* Recommendation */}
      <div className="rounded-lg bg-[#12121a] border border-[#1e1e2e] px-4 py-3 text-xs text-[#64748b] leading-relaxed">
        Para delta-neutral:{' '}
        <span className="text-[#e2e8f0] font-medium">
          {action} {absContracts.toFixed(2)} contratos de {optionLabel}
        </span>
      </div>

      {/* Scenarios table */}
      <div>
        <p className="text-xs font-medium text-[#64748b] mb-2">Escenarios de P&amp;L</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[#64748b]">
              <th className="pb-2 text-left font-normal">Cambio en precio</th>
              <th className="pb-2 text-right font-normal">P&amp;L estimado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e2e]">
            {scenarios.map((s) => (
              <tr key={s.priceChange}>
                <td className="py-2 text-[#e2e8f0]">
                  {s.priceChange > 0 ? '+' : ''}
                  {(s.priceChange * 100).toFixed(0)}%
                </td>
                <td className={`py-2 text-right font-mono font-medium ${pnlColor(s.pnl)}`}>
                  {formatPnl(s.pnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
