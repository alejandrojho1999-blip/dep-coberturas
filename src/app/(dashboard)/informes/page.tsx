'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { BarChart2, Download, Eye, FileText, Loader2, Search, Trash2, X } from 'lucide-react'
import type { HistoryEntry, ReportContent } from '@/lib/informes/types'

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

function fmtNum(n: number | null | undefined): string {
  if (n == null) return 'N/D'
  return n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({
  entry,
  onClose,
  onDownload,
}: {
  entry: HistoryEntry
  onClose: () => void
  onDownload: (e: HistoryEntry) => void
}) {
  const content: ReportContent | null = (entry.content_json as ReportContent) ?? null

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 md:p-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative my-auto w-full max-w-3xl rounded-xl border border-[#1e1e2e] bg-[#12121a] shadow-2xl">

        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-[#1e1e2e] px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText size={16} style={{ color: '#00ff88' }} />
              <span className="font-semibold text-[#e2e8f0]">
                {entry.empresa ?? entry.ticker} — Informe #{entry.informe_numero}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#64748b]">
              {entry.bolsa ?? ''} · {formatDate(entry.fecha_generacion)}
              {entry.solicitante ? ` · ${entry.solicitante}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDownload(entry)}
              className="flex items-center gap-1.5 rounded-lg border border-[#1e1e2e] px-3 py-1.5 text-xs font-medium text-[#00ff88] transition-colors hover:bg-[#1e1e2e]"
            >
              <Download size={13} />
              Descargar
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#64748b] transition-colors hover:bg-[#1e1e2e] hover:text-[#e2e8f0]"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: '75vh' }}>
          {!content ? (
            <p className="text-center text-sm text-[#475569] py-8">
              Preview no disponible para informes generados antes de esta actualización.
            </p>
          ) : (
            <div className="space-y-6 text-sm">

              {/* Metadata cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Ticker', value: content.ticker },
                  { label: 'Bolsa', value: content.bolsa },
                  { label: 'Precio Actual', value: `$${fmtNum(content.precio_actual)}` },
                  { label: 'Precio Objetivo', value: `$${fmtNum(content.precio_objetivo)}` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] p-3">
                    <p className="text-xs text-[#64748b]">{label}</p>
                    <p className="mt-0.5 font-semibold text-[#e2e8f0]">{value}</p>
                  </div>
                ))}
              </div>

              {/* Resumen ejecutivo */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#00ff88]">
                  Resumen Ejecutivo
                </h3>
                <p className="leading-relaxed text-[#94a3b8]">{content.resumen}</p>
              </section>

              {/* Modelo de negocio */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#00ff88]">
                  Modelo de Negocio
                </h3>
                <p className="leading-relaxed text-[#94a3b8]">{content.negocio}</p>
              </section>

              {/* Financieros */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#00ff88]">
                  Desempeño Financiero
                </h3>
                <p className="leading-relaxed text-[#94a3b8]">{content.financieros}</p>
              </section>

              {/* Valoración */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#00ff88]">
                  Valoración
                </h3>
                <p className="leading-relaxed text-[#94a3b8]">{content.valoracion}</p>
              </section>

              {/* Factores positivos / riesgo */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#4ade80' }}>
                    Factores Positivos
                  </h3>
                  <ul className="space-y-2">
                    {content.factores_positivos.map((f, i) => (
                      <li key={i} className="rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] p-3">
                        <p className="font-medium text-[#e2e8f0]">{f.titulo}</p>
                        <p className="mt-1 text-xs text-[#64748b]">{f.desc}</p>
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#f87171' }}>
                    Factores de Riesgo
                  </h3>
                  <ul className="space-y-2">
                    {content.factores_riesgo.map((f, i) => (
                      <li key={i} className="rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] p-3">
                        <p className="font-medium text-[#e2e8f0]">{f.titulo}</p>
                        <p className="mt-1 text-xs text-[#64748b]">{f.desc}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              {/* Conclusión */}
              <section className="rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#00ff88]">
                  Conclusión y Recomendación
                </h3>
                <p className="leading-relaxed text-[#e2e8f0]">{content.conclusion}</p>
              </section>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function InformesPage() {
  const [ticker, setTicker]                   = useState('')
  const [solicitante, setSolicitante]         = useState('')
  const [loading, setLoading]                 = useState(false)
  const [history, setHistory]                 = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading]   = useState(true)
  const [filterSolicitante, setFilterSolicitante] = useState('')
  const [previewEntry, setPreviewEntry]       = useState<HistoryEntry | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [toasts, setToasts]                   = useState<Toast[]>([])
  const toastId                               = useRef(0)

  // Autocomplete
  const [suggestions, setSuggestions]         = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown]       = useState(false)
  const [selectedIdx, setSelectedIdx]         = useState(-1)
  const [selectedResult, setSelectedResult]   = useState<SearchResult | null>(null)
  const debounceRef                           = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef                           = useRef<HTMLDivElement>(null)

  // ── Derived ───────────────────────────────────────────────────────────────

  const uniqueSolicitantes = Array.from(
    new Set(history.map((h) => h.solicitante).filter(Boolean) as string[])
  ).sort()

  const displayed = filterSolicitante
    ? history.filter((h) => h.solicitante === filterSolicitante)
    : history

  // ── Toasts ─────────────────────────────────────────────────────────────────

  const addToast = useCallback((message: string, variant: 'success' | 'error') => {
    const id = ++toastId.current
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  // ── History ────────────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/informes/history')
      if (res.ok) setHistory(await res.json() as HistoryEntry[])
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
    setTicker(s.symbol); setSelectedResult(s)
    setShowDropdown(false); setSuggestions([]); setSelectedIdx(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || !suggestions.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && selectedIdx >= 0) { e.preventDefault(); selectSuggestion(suggestions[selectedIdx]) }
    else if (e.key === 'Escape') setShowDropdown(false)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Actions ────────────────────────────────────────────────────────────────

  const deleteEntry = async (id: string) => {
    try {
      await fetch('/api/informes/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setHistory((prev) => prev.filter((h) => h.id !== id))
      if (previewEntry?.id === id) setPreviewEntry(null)
    } catch { addToast('Error al eliminar el registro', 'error') }
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const redownload = async (entry: HistoryEntry) => {
    try {
      const res = await fetch('/api/informes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: entry.ticker, solicitante: entry.solicitante }),
      })
      if (!res.ok) { addToast('Error al regenerar el informe', 'error'); return }
      triggerDownload(await res.blob(), entry.filename)
    } catch { addToast('Error de red al regenerar', 'error') }
  }

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
      const blob = await res.blob()
      let filename = `${ticker.trim()}_Informe.docx`
      if (metaHeader) {
        try { const m = JSON.parse(atob(metaHeader)) as { filename?: string }; if (m.filename) filename = m.filename } catch { /**/ }
      }
      triggerDownload(blob, filename)
      addToast(`Informe de ${ticker.trim()} generado correctamente.`, 'success')
      await fetchHistory()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error desconocido', 'error')
    } finally { setLoading(false) }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full">
      {/* Preview modal */}
      {previewEntry && (
        <PreviewModal
          entry={previewEntry}
          onClose={() => setPreviewEntry(null)}
          onDownload={redownload}
        />
      )}

      {/* Page header */}
      <div className="mb-6 flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
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
              {/* Ticker */}
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
                    <div
                      className="absolute z-50 mt-1 w-full rounded-lg border border-[#1e1e2e] bg-[#12121a] py-1 shadow-xl"
                      style={{ maxHeight: '220px', overflowY: 'auto' }}
                    >
                      {suggestions.map((s, idx) => (
                        <button
                          key={s.symbol}
                          type="button"
                          onMouseDown={() => selectSuggestion(s)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${idx === selectedIdx ? 'bg-[#1e1e2e]' : 'hover:bg-[#1a1a28]'}`}
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
                  <p className="text-xs text-[#64748b]">{selectedResult.name} · {selectedResult.exchange}</p>
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
                className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 hover:brightness-90 active:scale-[0.98]"
                style={{ background: '#00ff88', color: '#0a0a0f' }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                {loading ? 'Generando…' : 'Generar Informe'}
              </button>
            </form>

            {loading && (
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] p-3">
                <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-[#00ff88]" />
                <p className="text-xs text-[#94a3b8]">Generando informe con IA… puede tardar 30–60 segundos.</p>
              </div>
            )}

            <p className="mt-4 text-xs text-[#475569]">
              Incluye resumen ejecutivo, modelo de negocio, análisis financiero, factores de inversión y recomendación. Generado con DeepSeek via OpenRouter.
            </p>
          </div>
        </div>

        {/* ── RIGHT: Historial ─────────────────────────────────── */}
        <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e1e2e] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#e2e8f0]">Historial de Informes</h2>
              {history.length > 0 && (
                <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ background: 'rgba(0,255,136,0.1)', color: '#00ff88' }}>
                  {displayed.length}
                </span>
              )}
            </div>

            {/* Filter by Responsable */}
            {uniqueSolicitantes.length > 0 && (
              <select
                value={filterSolicitante}
                onChange={(e) => setFilterSolicitante(e.target.value)}
                className="rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-2.5 py-1.5 text-xs text-[#e2e8f0] transition-colors focus:border-[#00ff88] focus:outline-none"
              >
                <option value="">Todos los operadores</option>
                {uniqueSolicitantes.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-[#475569]" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'rgba(30,30,46,0.6)' }}>
                <FileText size={22} className="text-[#475569]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#64748b]">
                  {filterSolicitante ? `Sin informes de "${filterSolicitante}"` : 'Sin informes generados'}
                </p>
                <p className="mt-1 text-xs text-[#475569]">
                  {filterSolicitante ? 'Prueba otro filtro.' : 'Ingresa un ticker para comenzar.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1e1e2e]" style={{ background: '#0d0d14' }}>
                    <th className="px-4 py-3 text-left font-medium text-[#64748b]">Ticker</th>
                    <th className="px-4 py-3 text-left font-medium text-[#64748b]">Empresa</th>
                    <th className="hidden px-4 py-3 text-left font-medium text-[#64748b] sm:table-cell">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium text-[#64748b]">Responsable</th>
                    <th className="px-4 py-3 text-right font-medium text-[#64748b]">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((entry, i) => (
                    <tr
                      key={entry.id}
                      className="border-b border-[#1e1e2e] transition-colors hover:bg-[#1a1a28]"
                      style={{ background: i % 2 === 0 ? '#12121a' : '#0f0f17' }}
                    >
                      <td className="px-4 py-3">
                        <span className="font-semibold text-[#00ff88]">{entry.ticker}</span>
                        <span className="ml-1.5 text-[#475569]">#{entry.informe_numero}</span>
                      </td>
                      <td className="max-w-[140px] truncate px-4 py-3 text-[#94a3b8]">
                        {entry.empresa ?? '—'}
                      </td>
                      <td className="hidden px-4 py-3 text-[#64748b] sm:table-cell">
                        {formatDate(entry.fecha_generacion)}
                      </td>
                      <td className="max-w-[120px] truncate px-4 py-3 text-[#64748b]">
                        {entry.solicitante ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {confirmDeleteId === entry.id ? (
                          <div className="flex items-center justify-end gap-1.5 text-xs">
                            <span className="text-[#94a3b8]">¿Eliminar?</span>
                            <button
                              onClick={() => { void deleteEntry(entry.id); setConfirmDeleteId(null) }}
                              className="rounded px-2 py-1 font-medium text-red-400 transition-colors hover:bg-red-400/10"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded px-2 py-1 text-[#64748b] transition-colors hover:bg-[#1e1e2e]"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              title="Ver informe"
                              onClick={() => setPreviewEntry(entry)}
                              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-[#64748b] transition-colors hover:bg-[#1e1e2e] hover:text-[#e2e8f0]"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              title="Descargar .docx"
                              onClick={() => redownload(entry)}
                              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors hover:bg-[#1e1e2e]"
                              style={{ color: '#00ff88' }}
                            >
                              <Download size={13} />
                              .docx
                            </button>
                            <button
                              title="Eliminar"
                              onClick={() => setConfirmDeleteId(entry.id)}
                              className="rounded-md p-1.5 text-[#475569] transition-colors hover:bg-[#1e1e2e] hover:text-red-400"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-5 left-4 right-4 z-[999] flex flex-col gap-2 md:left-auto md:right-5 md:w-auto">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg"
            style={{
              background: t.variant === 'success' ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
              borderColor: t.variant === 'success' ? 'rgba(22,163,74,0.4)' : 'rgba(220,38,38,0.4)',
              color: t.variant === 'success' ? '#4ade80' : '#f87171',
              minWidth: '280px',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
