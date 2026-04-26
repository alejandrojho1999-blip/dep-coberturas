'use client'

import { useState } from 'react'
import type { OptionInput } from '@/lib/options/types'
import { positionDelta, portfolioDelta, analyzeHedge } from '@/lib/options/hedge'

interface Props {
  defaultOption?: OptionInput
}

type PositionType = 'stock' | 'call' | 'put'

type PositionEntry = {
  id: string
  type: PositionType
  quantity: number
  S: number
  K?: number
  T?: number
  r?: number
  sigma?: number
  label: string
}

function toHedgePosition(p: PositionEntry) {
  return {
    type: p.type,
    quantity: p.quantity,
    S: p.S,
    K: p.K,
    T: p.T,
    r: p.r,
    sigma: p.sigma,
  }
}

function buildLabel(type: PositionType, quantity: number, S: number, K?: number, T?: number): string {
  if (type === 'stock') {
    return `${quantity > 0 ? quantity : quantity} acciones (S=${S})`
  }
  return `${quantity}× ${type} K=${K ?? '?'} T=${T ?? '?'} S=${S}`
}

const DEFAULT_FORM = {
  type: 'stock' as PositionType,
  quantity: 1,
  S: 100,
  K: 100,
  T: 0.25,
  r: 0.05,
  sigma: 0.25,
}

export default function PositionBuilder({ defaultOption }: Props) {
  const [positions, setPositions] = useState<PositionEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...DEFAULT_FORM })

  function handleAddFromDefault() {
    if (!defaultOption) return
    setForm({
      type: defaultOption.type,
      quantity: 1,
      S: defaultOption.S,
      K: defaultOption.K,
      T: defaultOption.T,
      r: defaultOption.r,
      sigma: defaultOption.sigma,
    })
    setShowForm(true)
  }

  function handleAdd() {
    const { type, quantity, S, K, T, r, sigma } = form
    const entry: PositionEntry = {
      id: crypto.randomUUID(),
      type,
      quantity,
      S,
      label: buildLabel(type, quantity, S, K, T),
      ...(type !== 'stock' ? { K, T, r, sigma } : {}),
    }
    setPositions((prev) => [...prev, entry])
    setShowForm(false)
    setForm({ ...DEFAULT_FORM })
  }

  function handleRemove(id: string) {
    setPositions((prev) => prev.filter((p) => p.id !== id))
  }

  const hedgePositions = positions.map(toHedgePosition)
  const totalDelta = positions.length > 0 ? portfolioDelta(hedgePositions) : null

  // For "contratos para neutralizar": use defaultOption or a fallback ATM call
  const hedgingOption: OptionInput = defaultOption ?? {
    type: 'call',
    S: positions.length > 0 ? positions[0].S : 100,
    K: positions.length > 0 ? positions[0].S : 100,
    T: 0.25,
    r: 0.05,
    sigma: 0.25,
  }

  const analysis =
    positions.length > 0 ? analyzeHedge(hedgePositions, hedgingOption) : null

  return (
    <div className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] p-5 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-[#e2e8f0]">Portafolio de posiciones</h2>
        {defaultOption && (
          <button
            onClick={handleAddFromDefault}
            className="text-xs text-[#00ff88] hover:text-[#00cc66] transition-colors border border-[#00ff88]/30 hover:border-[#00ff88]/60 rounded px-2 py-1 shrink-0"
          >
            + Agregar opción analizada
          </button>
        )}
      </div>

      <div className="border-t border-[#1e1e2e]" />

      {/* Position list */}
      {positions.length === 0 ? (
        <p className="text-xs text-[#64748b] text-center py-4">
          Agrega posiciones para ver el análisis
        </p>
      ) : (
        <ul className="space-y-2">
          {positions.map((pos) => {
            const hp = toHedgePosition(pos)
            const delta = positionDelta(hp)
            return (
              <li
                key={pos.id}
                className="flex items-center justify-between rounded-lg bg-[#12121a] border border-[#1e1e2e] px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-[#e2e8f0] truncate block">{pos.label}</span>
                  <span className={`text-xs font-mono ${delta >= 0 ? 'text-[#00ff88]' : 'text-red-400'}`}>
                    Δ {delta.toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => handleRemove(pos.id)}
                  aria-label="Eliminar posición"
                  className="ml-3 text-[#64748b] hover:text-red-400 transition-colors text-sm leading-none"
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Add position form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full text-xs text-[#64748b] hover:text-[#e2e8f0] border border-dashed border-[#1e1e2e] hover:border-[#64748b] rounded-lg py-2 transition-colors"
        >
          + Agregar posición
        </button>
      ) : (
        <div className="rounded-lg bg-[#12121a] border border-[#1e1e2e] p-4 space-y-3">
          {/* Type toggle */}
          <div>
            <p className="text-xs text-[#64748b] mb-1">Tipo</p>
            <div className="flex gap-2">
              {(['stock', 'call', 'put'] as PositionType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  className={`px-3 py-1 text-xs rounded border transition-colors capitalize ${
                    form.type === t
                      ? 'bg-[#00ff88]/10 border-[#00ff88]/50 text-[#00ff88]'
                      : 'border-[#1e1e2e] text-[#64748b] hover:border-[#64748b] hover:text-[#e2e8f0]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity + S */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#64748b]">Cantidad</span>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                className="bg-[#0a0a0f] border border-[#1e1e2e] rounded px-2 py-1 text-xs text-[#e2e8f0] focus:outline-none focus:border-[#00ff88]/50"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#64748b]">Precio subyacente S</span>
              <input
                type="number"
                value={form.S}
                step="0.01"
                onChange={(e) => setForm((f) => ({ ...f, S: Number(e.target.value) }))}
                className="bg-[#0a0a0f] border border-[#1e1e2e] rounded px-2 py-1 text-xs text-[#e2e8f0] focus:outline-none focus:border-[#00ff88]/50"
              />
            </label>
          </div>

          {/* Option-specific fields */}
          {form.type !== 'stock' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b]">Strike K</span>
                <input
                  type="number"
                  value={form.K}
                  step="0.01"
                  onChange={(e) => setForm((f) => ({ ...f, K: Number(e.target.value) }))}
                  className="bg-[#0a0a0f] border border-[#1e1e2e] rounded px-2 py-1 text-xs text-[#e2e8f0] focus:outline-none focus:border-[#00ff88]/50"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b]">Tiempo T (años)</span>
                <input
                  type="number"
                  value={form.T}
                  step="0.01"
                  onChange={(e) => setForm((f) => ({ ...f, T: Number(e.target.value) }))}
                  className="bg-[#0a0a0f] border border-[#1e1e2e] rounded px-2 py-1 text-xs text-[#e2e8f0] focus:outline-none focus:border-[#00ff88]/50"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b]">Tasa r</span>
                <input
                  type="number"
                  value={form.r}
                  step="0.001"
                  onChange={(e) => setForm((f) => ({ ...f, r: Number(e.target.value) }))}
                  className="bg-[#0a0a0f] border border-[#1e1e2e] rounded px-2 py-1 text-xs text-[#e2e8f0] focus:outline-none focus:border-[#00ff88]/50"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b]">Volatilidad σ</span>
                <input
                  type="number"
                  value={form.sigma}
                  step="0.01"
                  onChange={(e) => setForm((f) => ({ ...f, sigma: Number(e.target.value) }))}
                  className="bg-[#0a0a0f] border border-[#1e1e2e] rounded px-2 py-1 text-xs text-[#e2e8f0] focus:outline-none focus:border-[#00ff88]/50"
                />
              </label>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              className="flex-1 text-xs bg-[#00ff88]/10 hover:bg-[#00ff88]/20 border border-[#00ff88]/40 hover:border-[#00ff88]/70 text-[#00ff88] rounded px-3 py-1.5 transition-colors"
            >
              Agregar
            </button>
            <button
              onClick={() => { setShowForm(false); setForm({ ...DEFAULT_FORM }) }}
              className="text-xs border border-[#1e1e2e] text-[#64748b] hover:text-[#e2e8f0] hover:border-[#64748b] rounded px-3 py-1.5 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Aggregate metrics */}
      {analysis && totalDelta !== null && (
        <>
          <div className="border-t border-[#1e1e2e]" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#64748b]">Delta total del portafolio</span>
              <span
                className={`font-mono font-semibold text-sm ${totalDelta >= 0 ? 'text-[#00ff88]' : 'text-red-400'}`}
              >
                {totalDelta.toFixed(2)}
              </span>
            </div>
            <div className="rounded-lg bg-[#12121a] border border-[#1e1e2e] px-4 py-3 text-xs text-[#64748b] leading-relaxed">
              Para neutralizar:{' '}
              <span className="text-[#e2e8f0] font-medium">
                {analysis.contractsToHedge >= 0 ? 'comprar' : 'vender'}{' '}
                {Math.abs(analysis.contractsToHedge).toFixed(2)} contratos
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
