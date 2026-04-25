'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { BarChart2, Download, FileText, Loader2, Search, Trash2 } from 'lucide-react'
import type { HistoryEntry } from '@/lib/informes/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SearchResult {
  symbol: string
  name: string
  exchange: string
  type: string
}

interface Toast {
  id: number
  message: string
  variant: 'success' | 'error'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function InformesPage() {
  const [ticker, setTicker]           = useState('')
  const [solicitante, setSolicitante] = useState('')
  const [loading, setLoading]         = useState(false)
  const [history, setHistory]         = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [toasts, setToasts]           = useState<Toast[]>([])
  const toastId                       = useRef(0)

  // Autocomplete state
  const [suggestions, setSuggestions]       = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown]     = useState(false)
  const [selectedIdx, setSelectedIdx]       = useState(-1)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const debounceRef                         = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef                         = useRef<HTMLDivElement>(null)

  // ── Toast helpers ──────────────────────────────────────────────────────────

  const addToast = useCallback((message: string, variant: 'success' | 'error') => {
    const id = ++toastId.current
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  // ── History ────────────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/informes/history')
      if (res.ok) {
        const data = await res.json() as HistoryEntry[]
        setHistory(data)
      }
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  // ── Autocomplete ───────────────────────────────────────────────────────────

  const handleTickerChange = (value: string) => {
    setTicker(value.toUpperCase())
    setSelectedResult(null)
    setSelectedIdx(-1)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) { setSuggestions([]); setShowDropdown(false); return }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/informes/search?q=${encodeURIComponent(value)}`)
        const data = await res.json() as SearchResult[]
        setSuggestions(data)
        setShowDropdown(data.length > 0)
      } catch { setSuggestions([]); setShowDropdown(false) }
    }, 280)
  }

  const selectSuggestion = (s: SearchResult) => {
    setTicker(s.symbol)
    setSelectedResult(s)
    setShowDropdown(false)
    setSuggestions([])
    setSelectedIdx(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && selectedIdx >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[selectedIdx])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Delete history entry ────────────────────────────────────────────────────

  const deleteEntry = async (id: string) => {
    try {
      await fetch('/api/informes/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setHistory((prev) => prev.filter((h) => h.id !== id))
    } catch {
      addToast('Error al eliminar el registro', 'error')
    }
  }

  // ── Re-download history entry ───────────────────────────────────────────────

  const redownload = async (entry: HistoryEntry) => {
    try {
      const res = await fetch('/api/informes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: entry.ticker, solicitante: entry.solicitante }),
      })
      if (!res.ok) { addToast('Error al regenerar el informe', 'error'); return }
      const blob = await res.blob()
      triggerDownload(blob, entry.filename)
    } catch {
      addToast('Error de red al regenerar', 'error')
    }
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ticker.trim() || loading) return
    setLoading(true)

    try {
      const res = await fetch('/api/informes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: ticker.trim(), solicitante: solicitante.trim() }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { detail?: string }
        throw new Error(err.detail ?? `Error ${res.status}`)
      }

      const metaHeader = res.headers.get('X-Informe-Meta')
      const blob       = await res.blob()

      let filename = `${ticker.trim()}_Informe.docx`
      if (metaHeader) {
        try {
          const meta = JSON.parse(atob(metaHeader)) as { filename?: string; ticker?: string; empresa?: string }
          if (meta.filename) filename = meta.filename
        } catch { /* use default */ }
      }

      triggerDownload(blob, filename)
      addToast(`Informe de ${ticker.trim()} generado correctamente.`, 'success')

      await fetchHistory()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      addToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full">
      {/* Page header */}
      <div className="mb-6 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)' }}
        >
          <BarChart2 size={20} style={{ color: '#00ff88' }} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-[#e2e8f0]">Informes de Inversión</h1>
          <p className="text-sm text-[#64748b]">Emporium Quality Funds — Generador de Informes</p>
        </div>
      </div>

      {/* 2-column grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[320px_1fr]">

        {/* ── LEFT: Generar informe ─────────────────────────────── */}
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-[#e2e8f0]">Generar Informe</h2>
              <p className="mt-0.5 text-xs text-[#64748b]">Analiza cualquier acción, ETF o fondo global</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Ticker input + autocomplete */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#94a3b8]">Ticker / Nombre</label>
                <div className="relative" ref={dropdownRef}>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
                    <input
                      type="text"
                      value={ticker}
                      onChange={(e) => handleTickerChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                      placeholder="Ej: AAPL, NVDA, Apple…"
                      autoComplete="off"
                      className="w-full rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] py-2.5 pl-9 pr-3 text-sm text-[#e2e8f0] placeholder-[#475569] transition-colors focus:border-[#00ff88] focus:outline-none"
                      style={{ textTransform: 'uppercase' }}
                    />
                  </div>

                  {showDropdown && suggestions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-[#1e1e2e] bg-[#12121a] py-1 shadow-xl"
                         style={{ maxHeight: '220px', overflowY: 'auto' }}>
                      {suggestions.map((s, idx) => (
                        <button
                          key={s.symbol}
                          type="button"
                          onMouseDown={() => selectSuggestion(s)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                            idx === selectedIdx ? 'bg-[#1e1e2e]' : 'hover:bg-[#1a1a28]'
                          }`}
                        >
                          <span className="font-semibold text-[#00ff88]">{s.symbol}</span>
                          <span className="flex-1 truncate text-[#94a3b8]">{s.name}</span>
                          <span className="shrink-0 text-[#475569]">{s.exchange}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedResult && (
                  <p className="text-xs text-[#64748b]">
                    {selectedResult.name} · {selectedResult.exchange}
                  </p>
                )}
              </div>

              {/* Solicitante */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#94a3b8]">Solicitante</label>
                <input
                  type="text"
                  value={solicitante}
                  onChange={(e) => setSolicitante(e.target.value)}
                  placeholder="Nombre de quien solicita"
                  className="w-full rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#475569] transition-colors focus:border-[#00ff88] focus:outline-none"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!ticker.trim() || loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: '#00ff88', color: '#0a0a0f' }}
                onMouseEnter={(e) => { if (!loading && ticker.trim()) (e.currentTarget as HTMLButtonElement).style.background = '#00cc6a' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#00ff88' }}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileText size={16} />
                )}
                {loading ? 'Generando…' : 'Generar Informe'}
              </button>
            </form>

            {/* Status box */}
            {loading && (
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] p-3">
                <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-[#00ff88]" />
                <p className="text-xs text-[#94a3b8]">
                  Generando informe con IA… puede tardar 30–60 segundos.
                </p>
              </div>
            )}

            {/* Footer note */}
            <p className="mt-4 text-xs text-[#475569]">
              Incluye resumen ejecutivo, modelo de negocio, análisis financiero, factores de inversión y recomendación. Generado con DeepSeek via OpenRouter.
            </p>
          </div>
        </div>

        {/* ── RIGHT: Historial ─────────────────────────────────── */}
        <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#1e1e2e] px-5 py-3.5">
            <h2 className="text-sm font-semibold text-[#e2e8f0]">Historial de Informes</h2>
            {history.length > 0 && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: 'rgba(0,255,136,0.1)', color: '#00ff88' }}>
                {history.length}
              </span>
            )}
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-[#475569]" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl"
                   style={{ background: 'rgba(30,30,46,0.6)' }}>
                <FileText size={22} className="text-[#475569]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#64748b]">Sin informes generados</p>
                <p className="mt-1 text-xs text-[#475569]">Ingresa un ticker para comenzar.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1e1e2e]" style={{ background: '#0d0d14' }}>
                    <th className="px-4 py-3 text-left font-medium text-[#64748b]">Ticker</th>
                    <th className="px-4 py-3 text-left font-medium text-[#64748b]">Empresa</th>
                    <th className="px-4 py-3 text-left font-medium text-[#64748b]">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium text-[#64748b]">Responsable</th>
                    <th className="px-4 py-3 text-right font-medium text-[#64748b]">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry, i) => (
                    <tr
                      key={entry.id}
                      className="border-b border-[#1e1e2e] transition-colors hover:bg-[#1a1a28]"
                      style={{ background: i % 2 === 0 ? '#12121a' : '#0f0f17' }}
                    >
                      <td className="px-4 py-3">
                        <span className="font-semibold text-[#00ff88]">{entry.ticker}</span>
                        <span className="ml-1.5 text-[#475569]">#{entry.informe_numero}</span>
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-[#94a3b8]">
                        {entry.empresa ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-[#64748b]">
                        {formatDate(entry.fecha_generacion)}
                      </td>
                      <td className="max-w-[140px] truncate px-4 py-3 text-[#64748b]">
                        {entry.solicitante ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="Descargar .docx"
                            onClick={() => redownload(entry)}
                            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-[#1e1e2e]"
                            style={{ color: '#00ff88' }}
                          >
                            <Download size={13} />
                            .docx
                          </button>
                          <button
                            title="Eliminar"
                            onClick={() => deleteEntry(entry.id)}
                            className="rounded-md p-1.5 text-[#475569] transition-colors hover:bg-[#1e1e2e] hover:text-red-400"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Toasts ─────────────────────────────────────────────── */}
      <div className="fixed bottom-5 left-4 right-4 z-[999] flex flex-col gap-2 md:left-auto md:right-5 md:w-auto">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2.5 rounded-lg border px-4 py-3 shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2 duration-200"
            style={{
              background: t.variant === 'success' ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
              borderColor: t.variant === 'success' ? 'rgba(22,163,74,0.4)' : 'rgba(220,38,38,0.4)',
              color: t.variant === 'success' ? '#4ade80' : '#f87171',
              minWidth: '280px',
              maxWidth: '400px',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
