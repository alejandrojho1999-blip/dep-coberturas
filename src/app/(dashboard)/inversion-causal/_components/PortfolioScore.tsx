'use client'
import type { PortfolioScore } from '@/lib/causal/types'

interface Props { portfolio: PortfolioScore }

function scoreColor(score: number): string {
  if (score < 40) return '#f87171'
  if (score < 60) return '#fbbf24'
  return '#00ff88'
}

function signalStyle(signal: PortfolioScore['signal']): string {
  if (signal === 'REDUCIR') return 'bg-red-500/20 text-red-400'
  if (signal === 'MANTENER') return 'bg-yellow-500/20 text-yellow-400'
  return 'bg-[#00ff88]/20 text-[#00ff88]'
}

export default function PortfolioScorePanel({ portfolio }: Props) {
  const color = scoreColor(portfolio.score)
  const pct = Math.min(100, Math.max(0, portfolio.score))

  return (
    <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
      <h3 className="text-[#e2e8f0] font-semibold text-base mb-4">Score de Portafolio</h3>

      {/* Score + badge + weight */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-4xl font-bold font-mono" style={{ color }}>
          {portfolio.score.toFixed(1)}
        </span>
        <span className="text-[#64748b] text-2xl font-light">/ 100</span>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${signalStyle(portfolio.signal)}`}>
          {portfolio.signal}
        </span>
        <div className="ml-auto text-right">
          <p className="text-[#64748b] text-xs">Peso sugerido</p>
          <p className="text-[#e2e8f0] font-semibold font-mono">{portfolio.suggestedWeight.toFixed(1)}%</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="w-full h-2 bg-[#1e1e2e] rounded-full mb-5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>

      {/* Components breakdown */}
      <div className="mb-4">
        <p className="text-[#64748b] text-xs font-medium uppercase tracking-wide mb-2">Componentes</p>
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(portfolio.components).map(([variable, contribution]) => (
              <tr key={variable} className="border-b border-[#1e1e2e]/50 last:border-0">
                <td className="py-1.5 pr-4 text-[#64748b] font-mono text-xs">{variable}</td>
                <td className="py-1.5 text-right text-[#e2e8f0] font-mono text-xs">
                  {contribution.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stress tests */}
      {portfolio.stressTests.length > 0 && (
        <div>
          <p className="text-[#64748b] text-xs font-medium uppercase tracking-wide mb-2">Stress Tests</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e2e]">
                <th className="text-left py-1.5 pr-4 text-[#64748b] font-medium text-xs">Variable</th>
                <th className="text-right py-1.5 px-4 text-[#64748b] font-medium text-xs">Shock</th>
                <th className="text-right py-1.5 pl-4 text-[#64748b] font-medium text-xs">Impacto</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.stressTests.map((st, i) => (
                <tr key={i} className="border-b border-[#1e1e2e]/50 last:border-0">
                  <td className="py-1.5 pr-4 text-[#64748b] font-mono text-xs">{st.variable}</td>
                  <td className="py-1.5 px-4 text-right text-[#e2e8f0] font-mono text-xs">
                    {st.shockBps > 0 ? '+' : ''}{st.shockBps}bps
                  </td>
                  <td className={`py-1.5 pl-4 text-right font-mono text-xs ${st.impact >= 0 ? 'text-[#00ff88]' : 'text-red-400'}`}>
                    {st.impact >= 0 ? '+' : ''}{st.impact.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
