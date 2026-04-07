'use client'

import { useState } from 'react'
import type { ParseResult } from '@/lib/data/parser'
import { COLUMN_ALIASES } from '@/lib/data/parser'

interface Props {
  parseResult: ParseResult
  onMappingConfirmed: (mapping: Record<string, string>) => void
}

const KNOWN_VARIABLES = Object.keys(COLUMN_ALIASES)
const IGNORE_VALUE = '__ignore__'

function confidenceBadgeClass(confidence: string): string {
  switch (confidence) {
    case 'exact':
      return 'bg-[#00ff88]/10 text-[#00ff88]'
    case 'alias':
      return 'bg-blue-500/10 text-blue-400'
    case 'fuzzy':
      return 'bg-yellow-500/10 text-yellow-400'
    default:
      return 'bg-red-500/10 text-red-400'
  }
}

export default function ColumnMapper({ parseResult, onMappingConfirmed }: Props) {
  const initialMapping: Record<string, string> = {}
  for (const col of parseResult.columns) {
    initialMapping[col.originalName] = col.mappedTo ?? IGNORE_VALUE
  }

  const [mapping, setMapping] = useState<Record<string, string>>(initialMapping)

  function handleChange(originalName: string, value: string) {
    setMapping((prev) => ({ ...prev, [originalName]: value }))
  }

  function handleConfirm() {
    // Remove ignored columns
    const finalMapping: Record<string, string> = {}
    for (const [orig, mapped] of Object.entries(mapping)) {
      if (mapped !== IGNORE_VALUE) {
        finalMapping[orig] = mapped
      }
    }
    onMappingConfirmed(finalMapping)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[#64748b]">
        {parseResult.rowCount} filas detectadas. Verifica o corrige el mapeo de columnas.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[#64748b] border-b border-[#1e1e2e]">
              <th className="pb-2 pr-4 font-medium">Columna original</th>
              <th className="pb-2 pr-4 font-medium">Detectada como</th>
              <th className="pb-2 pr-4 font-medium">Confianza</th>
              <th className="pb-2 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {parseResult.columns.map((col) => (
              <tr key={col.originalName} className="border-b border-[#1e1e2e]/50">
                <td className="py-2 pr-4 text-[#e2e8f0] font-mono text-xs">
                  {col.originalName}
                </td>
                <td className="py-2 pr-4 text-[#e2e8f0]">
                  {col.mappedTo ?? (
                    <span className="text-[#64748b] italic">No detectado</span>
                  )}
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${confidenceBadgeClass(col.confidence)}`}
                  >
                    {col.confidence}
                  </span>
                </td>
                <td className="py-2">
                  <select
                    value={mapping[col.originalName] ?? IGNORE_VALUE}
                    onChange={(e) => handleChange(col.originalName, e.target.value)}
                    className="bg-[#0a0a0f] border border-[#1e1e2e] text-[#e2e8f0] text-xs rounded-md px-2 py-1 focus:outline-none focus:border-[#3b82f6]"
                  >
                    <option value={IGNORE_VALUE}>Ignorar</option>
                    {KNOWN_VARIABLES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {parseResult.warnings.length > 0 && (
        <ul className="space-y-1">
          {parseResult.warnings.map((w, i) => (
            <li key={i} className="text-xs text-yellow-400">
              ⚠ {w}
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={handleConfirm}
        className="px-4 py-2 rounded-lg bg-[#3b82f6] text-white text-sm font-medium hover:bg-[#3b82f6]/90 transition-colors"
      >
        Confirmar mapeo
      </button>
    </div>
  )
}
