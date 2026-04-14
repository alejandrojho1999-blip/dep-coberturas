'use client'

import type { PricingResult } from '@/lib/options/types'

interface Props {
  result: PricingResult
}

interface GreekRow {
  name: string
  key: keyof PricingResult['greeks']
  interpretation: string
  colorRule: 'positive-green' | 'always-red' | 'signed'
}

const GREEK_ROWS: GreekRow[] = [
  {
    name: 'Delta',
    key: 'delta',
    interpretation: 'Cambio en precio por $1 en subyacente',
    colorRule: 'positive-green',
  },
  {
    name: 'Gamma',
    key: 'gamma',
    interpretation: 'Cambio en delta por $1 en subyacente',
    colorRule: 'positive-green',
  },
  {
    name: 'Theta',
    key: 'theta',
    interpretation: 'Pérdida de valor por día',
    colorRule: 'always-red',
  },
  {
    name: 'Vega',
    key: 'vega',
    interpretation: 'Cambio en precio por 1% en volatilidad',
    colorRule: 'positive-green',
  },
  {
    name: 'Rho',
    key: 'rho',
    interpretation: 'Cambio en precio por 1% en tasa',
    colorRule: 'signed',
  },
]

function valueColor(value: number, rule: GreekRow['colorRule']): string {
  if (rule === 'always-red') return 'text-red-400'
  if (rule === 'positive-green') return value >= 0 ? 'text-[#00ff88]' : 'text-red-400'
  // signed
  return value >= 0 ? 'text-[#00ff88]' : 'text-red-400'
}

export default function GreeksPanel({ result }: Props) {
  return (
    <div className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] p-5 space-y-4">
      {/* Option price — prominent */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#64748b]">Precio de la opción</span>
        <span className="text-2xl font-bold text-[#00ff88]">
          ${result.price.toFixed(4)}
        </span>
      </div>

      <div className="border-t border-[#1e1e2e]" />

      {/* Greeks table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[#64748b] text-xs">
            <th className="pb-2 text-left font-normal">Griega</th>
            <th className="pb-2 text-right font-normal">Valor</th>
            <th className="pb-2 pl-4 text-left font-normal hidden sm:table-cell">Interpretación</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e1e2e]">
          {GREEK_ROWS.map((row) => {
            const value = result.greeks[row.key]
            return (
              <tr key={row.key}>
                <td className="py-2.5 pr-4">
                  <span className="font-medium text-[#e2e8f0]">{row.name}</span>
                </td>
                <td className={`py-2.5 text-right font-mono font-medium ${valueColor(value, row.colorRule)}`}>
                  {value.toFixed(4)}
                </td>
                <td className="py-2.5 pl-4 text-[#64748b] text-xs hidden sm:table-cell">
                  {row.interpretation}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
