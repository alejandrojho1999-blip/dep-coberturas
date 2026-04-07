'use client'
import type { BacktestResult } from '@/lib/causal/types'

interface Props { backtest: BacktestResult }

export default function BacktestPanelComponent({ backtest }: Props) {
  const signCorrectCount = backtest.folds.filter((f) => f.signCorrect).length
  const totalFolds = backtest.folds.length

  return (
    <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
      <h3 className="text-[#e2e8f0] font-semibold text-base mb-4">Backtest (Walk-Forward)</h3>

      {/* Summary row */}
      <div className="flex flex-wrap gap-4 mb-4 p-3 bg-[#0a0a0f] rounded-lg text-sm font-mono">
        <span className="text-[#64748b]">
          β promedio: <span className="text-[#3b82f6]">{backtest.avgBeta.toFixed(4)}</span>
        </span>
        <span className="text-[#64748b]">
          R²_OOS: <span className="text-[#e2e8f0]">{backtest.avgR2oos.toFixed(3)}</span>
        </span>
        <span className="text-[#64748b]">
          IC: <span className="text-[#e2e8f0]">{backtest.avgIC.toFixed(3)}</span>
        </span>
        <span className="text-[#64748b]">
          Signo correcto: <span className="text-[#00ff88]">{signCorrectCount}/{totalFolds}</span>
        </span>
      </div>

      {/* Folds table */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e2e]">
              <th className="text-left py-2 pr-4 text-[#64748b] font-medium">Fold</th>
              <th className="text-right py-2 px-4 text-[#64748b] font-medium">β</th>
              <th className="text-right py-2 px-4 text-[#64748b] font-medium">R²_OOS</th>
              <th className="text-right py-2 px-4 text-[#64748b] font-medium">IC (Spearman)</th>
              <th className="text-right py-2 pl-4 text-[#64748b] font-medium">Signo</th>
            </tr>
          </thead>
          <tbody>
            {backtest.folds.map((fold) => (
              <tr key={fold.fold} className="border-b border-[#1e1e2e]/50 last:border-0">
                <td className="py-2 pr-4 text-[#64748b] font-mono">{fold.fold}</td>
                <td className="py-2 px-4 text-right text-[#3b82f6] font-mono">{fold.beta.toFixed(4)}</td>
                <td className={`py-2 px-4 text-right font-mono ${fold.r2oos < 0 ? 'text-[#64748b]' : 'text-[#e2e8f0]'}`}>
                  {fold.r2oos.toFixed(3)}
                </td>
                <td className={`py-2 px-4 text-right font-mono ${fold.ic > 0 ? 'text-[#00ff88]' : 'text-red-400'}`}>
                  {fold.ic.toFixed(3)}
                </td>
                <td className="py-2 pl-4 text-right font-mono">
                  {fold.signCorrect ? (
                    <span className="text-[#00ff88]">✓</span>
                  ) : (
                    <span className="text-red-400">✗</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Note */}
      <p className="text-[#64748b] text-xs italic">
        R² OOS negativo es normal para señales débiles — IC &gt; 0 es lo que importa
      </p>
    </div>
  )
}
