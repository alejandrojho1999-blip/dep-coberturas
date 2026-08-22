'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { BarChart2, Cpu, Download, Eye, FileText, Loader2, Search, Trash2, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { HistoryEntry, ReportContent } from '@/lib/informes/types'
import { contractKey, type OptionContractRef } from '@/lib/options/occ-symbol'
import { daysToExpiration } from '@/lib/options/pricing'
import { hasFabricatedEntryPrice, FABRICATED_ENTRY_WARNING } from '@/lib/agentes/legacy-entry-price'
import type { AgentRec } from '@/lib/agentes/types'
import { optionOutcome, optionRefFromRec } from '@/lib/options/mark'

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

/**
 * Interpreta lo que el usuario dejó en un campo numérico editable.
 *
 * Un campo vacío significa "borrar el dato", no "ignorar el cambio": es lo que
 * permite deshacer un precio de venta escrito por error y volver a dejar el
 * rendimiento corriendo contra el precio de mercado.
 */
function parseNullableNumber(raw: string): { valid: boolean; value: number | null } {
  const trimmed = raw.trim()
  if (trimmed === '') return { valid: true, value: null }
  const n = parseFloat(trimmed)
  if (!Number.isFinite(n) || n < 0) return { valid: false, value: null }
  return { valid: true, value: n }
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({
  entry,
  onClose,
  onDownload,
  downloadingId,
}: {
  entry: HistoryEntry
  onClose: () => void
  onDownload: (e: HistoryEntry) => void
  downloadingId: string | null
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
      <div className="relative my-auto w-full max-w-3xl rounded-xl border border-border-subtle bg-surface shadow-2xl">

        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText size={16} style={{ color: 'var(--color-text-primary)' }} />
              <span className="font-semibold text-text-primary">
                {entry.empresa ?? entry.ticker} — Informe #{entry.informe_numero}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-text-secondary">
              {entry.bolsa ?? ''} · {formatDate(entry.fecha_generacion)}
              {entry.solicitante ? ` · ${entry.solicitante}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDownload(entry)}
              disabled={downloadingId === entry.id}
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-positive transition-colors hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloadingId === entry.id
                ? <Loader2 size={13} className="animate-spin" />
                : <Download size={13} />}
              {downloadingId === entry.id ? 'Descargando…' : 'Descargar'}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: '75vh' }}>
          {!content ? (
            <p className="text-center text-sm text-text-muted py-8">
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
                  <div key={label} className="rounded-lg border border-border-subtle bg-background p-3">
                    <p className="text-xs text-text-secondary">{label}</p>
                    <p className="mt-0.5 font-semibold text-text-primary">{value}</p>
                  </div>
                ))}
              </div>

              {/* Resumen ejecutivo */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-positive">
                  Resumen Ejecutivo
                </h3>
                <p className="leading-relaxed text-text-secondary">{content.resumen}</p>
              </section>

              {/* Modelo de negocio */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-positive">
                  Modelo de Negocio
                </h3>
                <p className="leading-relaxed text-text-secondary">{content.negocio}</p>
              </section>

              {/* Financieros */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-positive">
                  Desempeño Financiero
                </h3>
                <p className="leading-relaxed text-text-secondary">{content.financieros}</p>
              </section>

              {/* Valoración */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-positive">
                  Valoración
                </h3>
                <p className="leading-relaxed text-text-secondary">{content.valoracion}</p>
              </section>

              {/* Factores positivos / riesgo */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-positive)' }}>
                    Factores Positivos
                  </h3>
                  <ul className="space-y-2">
                    {content.factores_positivos.map((f, i) => (
                      <li key={i} className="rounded-lg border border-border-subtle bg-background p-3">
                        <p className="font-medium text-text-primary">{f.titulo}</p>
                        <p className="mt-1 text-xs text-text-secondary">{f.desc}</p>
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-negative)' }}>
                    Factores de Riesgo
                  </h3>
                  <ul className="space-y-2">
                    {content.factores_riesgo.map((f, i) => (
                      <li key={i} className="rounded-lg border border-border-subtle bg-background p-3">
                        <p className="font-medium text-text-primary">{f.titulo}</p>
                        <p className="mt-1 text-xs text-text-secondary">{f.desc}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              {/* Conclusión */}
              <section className="rounded-lg border border-border-subtle bg-background p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-positive">
                  Conclusión y Recomendación
                </h3>
                <p className="leading-relaxed text-text-primary">{content.conclusion}</p>
              </section>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RecomendacionesPage() {
  const [ticker, setTicker]                   = useState('')
  const [loading, setLoading]                 = useState(false)
  const [history, setHistory]                 = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading]   = useState(true)
  const [filterUserId, setFilterUserId]       = useState('')
  const [currentUserId, setCurrentUserId]     = useState<string | null>(null)
  const [previewEntry, setPreviewEntry]       = useState<HistoryEntry | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [downloadingId,   setDownloadingId]   = useState<string | null>(null)
  const [uploadingId,     setUploadingId]     = useState<string | null>(null)
  const fileInputRef                          = useRef<HTMLInputElement>(null)
  const uploadTargetRef                       = useRef<HistoryEntry | null>(null)
  const [livePrices,    setLivePrices]        = useState<Record<string, number>>({})
  const [pricesLoading, setPricesLoading]     = useState(false)
  const [optionPrices,  setOptionPrices]      = useState<Record<string, number>>({})
  const [rowEdits,      setRowEdits]          = useState<Record<string, Record<string, string>>>({})
  const [toasts, setToasts]                   = useState<Toast[]>([])
  const toastId                               = useRef(0)
  const [pendingDuplicate, setPendingDuplicate] = useState<string | null>(null)
  const [comisionPct, setComisionPct]           = useState(20)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [agentRecs, setAgentRecs]               = useState<AgentRec[]>([])
  const [agentRecsLoading, setAgentRecsLoading] = useState(true)
  const [agentRowEdits, setAgentRowEdits]       = useState<Record<string, Record<string, string>>>({})
  const [confirmDeleteAgentId, setConfirmDeleteAgentId] = useState<string | null>(null)

  // Autocomplete
  const [suggestions, setSuggestions]         = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown]       = useState(false)
  const [selectedIdx, setSelectedIdx]         = useState(-1)
  const [selectedResult, setSelectedResult]   = useState<SearchResult | null>(null)
  const debounceRef                           = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef                           = useRef<HTMLDivElement>(null)

  // ── Derived ───────────────────────────────────────────────────────────────

  const uniqueUsers = (() => {
    const seen = new Map<string, { user_id: string; user_email: string | null }>()
    history.forEach((h) => {
      if (!seen.has(h.user_id)) seen.set(h.user_id, { user_id: h.user_id, user_email: h.user_email })
    })
    return Array.from(seen.values()).sort((a, b) =>
      (a.user_email ?? a.user_id).localeCompare(b.user_email ?? b.user_id)
    )
  })()

  const displayed = filterUserId
    ? history.filter((h) => h.user_id === filterUserId)
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

  const fetchAgentRecs = useCallback(async () => {
    try {
      const res = await fetch('/api/agentes/picks')
      if (res.ok) setAgentRecs(await res.json() as AgentRec[])
    } finally { setAgentRecsLoading(false) }
  }, [])

  useEffect(() => { fetchAgentRecs() }, [fetchAgentRecs])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id)
        setFilterUserId(data.user.id)
        setCurrentUserEmail(data.user.email ?? null)
      }
    })
  }, [])

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
    if (downloadingId) { addToast('Ya hay una descarga en progreso', 'error'); return }
    setDownloadingId(entry.id)
    try {
      // If user uploaded a custom version, download that from Storage
      if (entry.custom_docx_path) {
        const supabase = createClient()
        const { data } = await supabase.storage.from('informes-docx').download(entry.custom_docx_path)
        if (data) { triggerDownload(data, entry.filename); return }
      }
      // Regenerate DOCX from existing content_json (no new DB record created)
      const res = await fetch('/api/informes/redownload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id }),
      })
      if (!res.ok) { addToast('Error al regenerar el informe', 'error'); return }
      triggerDownload(await res.blob(), entry.filename)
    } catch { addToast('Error de red al regenerar', 'error') }
    finally { setDownloadingId(null) }
  }

  const triggerUpload = (entry: HistoryEntry) => {
    uploadTargetRef.current = entry
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const entry = uploadTargetRef.current
    if (!file || !entry || !currentUserId) return
    // Reset input so same file can be re-selected
    e.target.value = ''
    setUploadingId(entry.id)
    try {
      const supabase = createClient()
      const storagePath = `${currentUserId}/${entry.id}.docx`
      const { error: upErr } = await supabase.storage
        .from('informes-docx')
        .upload(storagePath, file, { upsert: true, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      if (upErr) { addToast(`Error al subir: ${upErr.message}`, 'error'); return }
      const { error: dbErr } = await supabase
        .from('informes_history')
        .update({ custom_docx_path: storagePath })
        .eq('id', entry.id)
      if (dbErr) { addToast(`Error actualizando registro: ${dbErr.message}`, 'error'); return }
      addToast('Archivo Word actualizado. Al descargar obtendrás tu versión.', 'success')
      await fetchHistory()
    } catch { addToast('Error inesperado al subir el archivo', 'error') }
    finally { setUploadingId(null); uploadTargetRef.current = null }
  }

  // ── Live prices ────────────────────────────────────────────────────────────

  const fetchLivePrices = useCallback(async (tickerList: string[]) => {
    const tickers = tickerList.join(',')
    if (!tickers) return
    setPricesLoading(true)
    try {
      const res = await fetch(`/api/informes/live-prices?tickers=${encodeURIComponent(tickers)}`)
      if (res.ok) setLivePrices(await res.json() as Record<string, number>)
    } finally { setPricesLoading(false) }
  }, [])

  // Tickers a cotizar: portafolio del operador + recomendaciones de todos los agentes.
  const trackedTickers = useMemo(
    () => [...new Set([
      ...history.map((h) => h.ticker),
      ...agentRecs.map((r) => r.ticker),
    ])].filter(Boolean),
    [history, agentRecs]
  )

  useEffect(() => {
    if (trackedTickers.length > 0) void fetchLivePrices(trackedTickers)
  }, [trackedTickers, fetchLivePrices])

  useEffect(() => {
    const id = setInterval(() => {
      if (trackedTickers.length > 0) void fetchLivePrices(trackedTickers)
    }, 60_000)
    return () => clearInterval(id)
  }, [trackedTickers, fetchLivePrices])

  // ── Live option premiums (GAMMA / THETA) ───────────────────────────────────

  // Contratos derivados de las recomendaciones de opciones. Se serializa a JSON
  // para que el efecto solo se dispare cuando cambian los contratos en sí.
  const trackedContracts = useMemo(() => {
    const refs: OptionContractRef[] = []
    for (const rec of agentRecs) {
      if (rec.category !== 'OPTIONS_GAMMA' && rec.category !== 'OPTIONS_THETA') continue
      const ref = optionRefFromRec(rec)
      if (ref) refs.push(ref)
    }
    return refs
  }, [agentRecs])

  const contractsKey = useMemo(
    () => trackedContracts.map(contractKey).sort().join(','),
    [trackedContracts]
  )

  const fetchOptionPrices = useCallback(async (contracts: OptionContractRef[]) => {
    if (!contracts.length) return
    try {
      const res = await fetch('/api/informes/option-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contracts }),
      })
      if (res.ok) setOptionPrices(await res.json() as Record<string, number>)
    } catch { /* la tabla cae al guion si falla */ }
  }, [])

  useEffect(() => {
    if (trackedContracts.length > 0) void fetchOptionPrices(trackedContracts)
    // trackedContracts se recalcula en cada render de agentRecs; contractsKey
    // evita repetir la petición cuando el conjunto de contratos no cambió.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractsKey, fetchOptionPrices])

  useEffect(() => {
    const id = setInterval(() => {
      if (trackedContracts.length > 0) void fetchOptionPrices(trackedContracts)
    }, 60_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractsKey, fetchOptionPrices])

  // ── Portfolio inline editing ────────────────────────────────────────────────

  const setRowEdit = (id: string, field: string, val: string) =>
    setRowEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: val } }))

  const clearRowEdit = (id: string, field: string) =>
    setRowEdits((prev) => {
      const copy = { ...prev }
      if (copy[id]) { const f = { ...copy[id] }; delete f[field]; copy[id] = f }
      return copy
    })

  const getEditVal = (entry: HistoryEntry, field: 'precio_compra' | 'cantidad_acciones' | 'precio_objetivo_personal' | 'precio_venta'): string => {
    const inFlight = rowEdits[entry.id]?.[field]
    if (inFlight !== undefined) return inFlight
    const v = entry[field]
    return v != null ? String(v) : ''
  }

  const saveField = async (id: string, updates: Record<string, unknown>) => {
    const res = await fetch('/api/informes/history', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })
    if (res.ok) {
      setHistory((prev) => prev.map((h) => h.id === id ? { ...h, ...updates } as HistoryEntry : h))
    } else {
      addToast('Error al guardar', 'error')
    }
  }

  const handleEstadoChange = async (entry: HistoryEntry, newEstado: string) => {
    const updates: Record<string, unknown> = { estado: newEstado }
    if (newEstado === 'Vender') {
      updates.precio_venta = livePrices[entry.ticker] ?? null
    }
    await saveField(entry.id, updates)
  }

  function calcRendimiento(entry: HistoryEntry): number | null {
    const compra = entry.precio_compra
    if (compra == null || compra === 0) return null
    const ref = entry.precio_venta != null
      ? entry.precio_venta
      : (livePrices[entry.ticker] ?? null)
    if (ref == null) return null
    return ((ref - compra) / compra) * 100
  }

  function calcGananciaUSD(entry: HistoryEntry): number | null {
    const compra = entry.precio_compra
    const cantidad = entry.cantidad_acciones
    if (compra == null || compra === 0 || cantidad == null) return null
    const ref = entry.precio_venta != null
      ? entry.precio_venta
      : (livePrices[entry.ticker] ?? null)
    if (ref == null) return null
    return (ref - compra) * cantidad
  }

  function calcAgentGanancia(rec: AgentRec): number | null {
    const entrada = rec.precio_entrada
    const cantidad = rec.cantidad_acciones
    if (entrada == null || entrada === 0 || cantidad == null) return null
    const ref = rec.precio_venta != null ? rec.precio_venta : (livePrices[rec.ticker] ?? null)
    if (ref == null) return null
    return (ref - entrada) * cantidad
  }

  /**
   * Un cierre manual también tiene que dejar constancia de la fecha: los
   * portafolios reconstruyen su curva con `closed_at` y sin ella tendrían que
   * inferirla. Reabrir la posición la vuelve a limpiar.
   */
  const withClosedAt = (rec: AgentRec | undefined, updates: Record<string, unknown>): Record<string, unknown> => {
    if (!rec) return updates
    if (!('estado' in updates) && !('precio_venta' in updates)) return updates
    const merged = { ...rec, ...updates } as AgentRec
    const cerrada = merged.estado === 'Vender' || merged.precio_venta != null
    if (cerrada && rec.closed_at == null) return { ...updates, closed_at: new Date().toISOString() }
    if (!cerrada && rec.closed_at != null) return { ...updates, closed_at: null }
    return updates
  }

  const saveAgentField = async (id: string, rawUpdates: Record<string, unknown>) => {
    const updates = withClosedAt(agentRecs.find(r => r.id === id), rawUpdates)
    const res = await fetch('/api/agentes/picks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })
    if (res.ok) {
      setAgentRecs(prev => prev.map(r => r.id === id ? { ...r, ...updates } as AgentRec : r))
    } else { addToast('Error al guardar', 'error') }
  }

  const deleteAgentRec = async (id: string) => {
    await fetch('/api/agentes/picks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setAgentRecs(prev => prev.filter(r => r.id !== id))
  }

  const getAgentEditVal = (rec: AgentRec, field: 'precio_venta' | 'cantidad_acciones'): string => {
    const inFlight = agentRowEdits[rec.id]?.[field]
    if (inFlight !== undefined) return inFlight
    const v = rec[field]
    return v != null ? String(v) : ''
  }

  function estadoBadge(estado: string | null) {
    switch (estado) {
      case 'Comprar':  return { bg: 'rgba(16, 185, 129,0.15)',  border: 'rgba(16, 185, 129,0.35)',  text: 'var(--color-positive)' }
      case 'Mantener': return { bg: 'rgba(245, 165, 36,0.15)',  border: 'rgba(245, 165, 36,0.35)',  text: 'var(--color-warning)' }
      case 'Vender':   return { bg: 'rgba(240, 68, 56,0.15)', border: 'rgba(240, 68, 56,0.35)', text: 'var(--color-negative)' }
      default:         return { bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)',  text: 'var(--color-text-secondary)' }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const generateReport = async (tickerVal: string, force = false) => {
    setLoading(true)
    try {
      const res = await fetch('/api/informes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: tickerVal, force }),
      })
      if (res.status === 409) {
        const body = await res.json().catch(() => ({})) as { detail?: string; code?: string }
        if (body.code === 'DUPLICATE') {
          setPendingDuplicate(tickerVal)
          return
        }
        throw new Error(body.detail ?? `Error ${res.status}`)
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { detail?: string }
        throw new Error(err.detail ?? `Error ${res.status}`)
      }
      const metaHeader = res.headers.get('X-Informe-Meta')
      const blob = await res.blob()
      let filename = `${tickerVal}_Informe.docx`
      if (metaHeader) {
        try { const m = JSON.parse(atob(metaHeader)) as { filename?: string }; if (m.filename) filename = m.filename } catch { /**/ }
      }
      triggerDownload(blob, filename)
      addToast(`Informe de ${tickerVal} generado correctamente.`, 'success')
      setPendingDuplicate(null)
      await fetchHistory()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error desconocido', 'error')
    } finally { setLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ticker.trim() || loading) return
    await generateReport(ticker.trim())
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full">
      {/* Hidden file input for Word upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleFileSelected}
      />
      {/* Duplicate confirmation dialog */}
      {pendingDuplicate && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-border-subtle bg-surface p-6 space-y-4 shadow-2xl">
            <p className="text-sm font-semibold text-text-primary">Ya existe un informe reciente</p>
            <p className="text-xs text-text-secondary">
              Generaste un informe de <span className="font-mono text-positive">{pendingDuplicate}</span> en las últimas 24 horas. ¿Deseas regenerarlo de todas formas?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPendingDuplicate(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-text-secondary border border-border-subtle hover:bg-surface-raised transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => void generateReport(pendingDuplicate, true)}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg text-xs bg-accent text-on-accent font-semibold hover:bg-accent-hover/90 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Generando...' : 'Regenerar de todas formas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewEntry && (
        <PreviewModal
          entry={previewEntry}
          onClose={() => setPreviewEntry(null)}
          onDownload={redownload}
          downloadingId={downloadingId}
        />
      )}

      {/* Page header */}
      <div className="mb-6 flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'rgba(0, 61, 102,0.1)', border: '1px solid rgba(0, 61, 102,0.2)' }}
        >
          <BarChart2 size={20} style={{ color: 'var(--color-text-primary)' }} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Recomendaciones</h1>
          <p className="text-sm text-text-secondary">SynerGy — Panel de Recomendaciones</p>
        </div>
      </div>

      {/* Vertical stack: compact form top, full-width table below */}
      <div className="flex flex-col gap-5">

        {/* ── TOP: Generar informe (compact bar) ────────────────── */}
        <div className="rounded-xl border border-border-subtle bg-surface px-5 py-4">
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
            {/* Ticker input */}
            <div className="relative min-w-[200px] flex-1 max-w-sm" ref={dropdownRef}>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => handleTickerChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                  placeholder="Ej: AAPL, NVDA, Apple…"
                  autoComplete="off"
                  className="w-full rounded-lg border border-border-subtle bg-background py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder-text-muted transition-colors focus:border-accent focus:outline-none"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              {showDropdown && suggestions.length > 0 && (
                <div
                  className="absolute z-50 mt-1 w-full rounded-lg border border-border-subtle bg-surface py-1 shadow-xl"
                  style={{ maxHeight: '220px', overflowY: 'auto' }}
                >
                  {suggestions.map((s, idx) => (
                    <button
                      key={s.symbol}
                      type="button"
                      onMouseDown={() => selectSuggestion(s)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${idx === selectedIdx ? 'bg-surface-raised' : 'hover:bg-surface-raised'}`}
                    >
                      <span className="font-semibold text-positive">{s.symbol}</span>
                      <span className="flex-1 truncate text-text-secondary">{s.name}</span>
                      <span className="shrink-0 text-text-muted">{s.exchange}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedResult && (
                <p className="mt-1 text-xs text-text-secondary">{selectedResult.name} · {selectedResult.exchange}</p>
              )}
            </div>
            {/* Submit button */}
            <button
              type="submit"
              disabled={!ticker.trim() || loading}
              className="flex shrink-0 items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 hover:brightness-90 active:scale-[0.98]"
              style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              {loading ? 'Generando…' : 'Generar Informe'}
            </button>
            {/* Inline loading indicator */}
            {loading && (
              <span className="self-center text-xs text-text-secondary">Generando con IA… 30–60s</span>
            )}
          </form>
        </div>

        {/* ── BOTTOM: Historial (full width) ───────────────────── */}
        <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-3.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary">
                {(() => {
                  const activeUser = filterUserId
                    ? uniqueUsers.find((u) => u.user_id === filterUserId)
                    : null
                  const name = activeUser?.user_email ?? currentUserEmail ?? '—'
                  return `RECOMENDACIONES DE ${name.toUpperCase()}`
                })()}
              </h2>
              {history.length > 0 && (
                <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ background: 'rgba(0, 61, 102,0.1)', color: 'var(--color-text-primary)' }}>
                  {displayed.length}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Commission % input + summary stats */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-text-secondary">Comisión operador:</label>
                <input
                  type="number" min="0" max="100" step="0.1"
                  value={comisionPct}
                  onChange={(e) => setComisionPct(parseFloat(e.target.value) || 0)}
                  className="w-14 rounded border border-border-subtle bg-background px-2 py-1 text-xs text-text-primary text-right focus:border-accent focus:outline-none"
                />
                <span className="text-xs text-text-secondary">%</span>
                {/* Summary: total commission and net company gain from closed positions */}
                {(() => {
                  let totalGanancia = 0
                  let totalComision = 0
                  displayed.forEach((entry) => {
                    if (entry.precio_venta == null) return
                    const g = calcGananciaUSD(entry)
                    if (g == null) return
                    totalGanancia += g
                    if (g > 0) totalComision += g * (comisionPct / 100)
                  })
                  const netoEmpresa = totalGanancia - totalComision
                  return (
                    <>
                      <div
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                        style={{ background: 'rgba(245, 165, 36,0.08)', border: '1px solid rgba(245, 165, 36,0.2)' }}
                        title="Suma de comisiones cobradas (operaciones cerradas con precio de venta)"
                      >
                        <span className="text-[10px] text-text-secondary">Comisión total</span>
                        <span className="text-xs font-semibold font-mono" style={{ color: 'var(--color-warning)' }}>
                          ${fmtNum(totalComision)}
                        </span>
                      </div>
                      <div
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                        style={{
                          background: netoEmpresa >= 0 ? 'rgba(16, 185, 129,0.08)' : 'rgba(240, 68, 56,0.08)',
                          border: netoEmpresa >= 0 ? '1px solid rgba(16, 185, 129,0.2)' : '1px solid rgba(240, 68, 56,0.2)',
                        }}
                        title="Ganancia neta de la empresa = suma total de operaciones cerradas − comisión del operador"
                      >
                        <span className="text-[10px] text-text-secondary">Neto empresa</span>
                        <span className="text-xs font-semibold font-mono" style={{ color: netoEmpresa >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                          {netoEmpresa >= 0 ? '+' : ''}${fmtNum(netoEmpresa)}
                        </span>
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* Filter by operator/user */}
              {uniqueUsers.length > 1 && (
                <select
                  value={filterUserId}
                  onChange={(e) => setFilterUserId(e.target.value)}
                  className="rounded-lg border border-border-subtle bg-background px-2.5 py-1.5 text-xs text-text-primary transition-colors focus:border-accent focus:outline-none"
                >
                  <option value="">Todos los operadores</option>
                  {uniqueUsers.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.user_email ?? u.user_id}
                      {u.user_id === currentUserId ? ' (yo)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-text-muted" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'rgba(30,30,46,0.6)' }}>
                <FileText size={22} className="text-text-muted" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-secondary">
                  {filterUserId ? 'Sin informes para este operador' : 'Sin informes generados'}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {filterUserId ? 'Prueba otro filtro.' : 'Ingresa un ticker para comenzar.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-xs">
                <thead>
                  <tr className="border-b border-border-subtle" style={{ background: 'var(--color-background)' }}>
                    <th className="px-3 py-2.5 text-left font-medium text-text-secondary">Ticker</th>
                    <th className="hidden px-3 py-2.5 text-left font-medium text-text-secondary md:table-cell">Empresa</th>
                    <th className="hidden px-3 py-2.5 text-left font-medium text-text-secondary lg:table-cell">Fecha</th>
                    <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">P.Compra</th>
                    <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">P.Venta</th>
                    <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">Cant.</th>
                    <th className="px-3 py-2.5 text-right font-medium text-text-secondary">
                      P.Actual
                      {pricesLoading && <Loader2 size={10} className="ml-1 inline animate-spin" />}
                    </th>
                    <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary lg:table-cell">P.Obj.</th>
                    <th className="px-3 py-2.5 text-right font-medium text-text-secondary">Rendim.</th>
                    <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">G/P ($)</th>
                    <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">Comisión</th>
                    <th className="px-3 py-2.5 text-left font-medium text-text-secondary">Estado</th>
                    <th className="px-3 py-2.5 text-right font-medium text-text-secondary">Acc.</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((entry, i) => (
                    <tr
                      key={entry.id}
                      className="border-b border-border-subtle transition-colors hover:bg-surface-raised"
                      style={{ background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface)' }}
                    >
                      <td className="px-3 py-2.5">
                        <span className="font-semibold text-positive">{entry.ticker}</span>
                        <span className="ml-1 text-text-muted">#{i + 1}</span>
                        {entry.custom_docx_path && (
                          <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent" title="Tiene versión personalizada" />
                        )}
                      </td>
                      {/* Empresa */}
                      <td className="hidden max-w-[130px] truncate px-3 py-2.5 text-text-secondary md:table-cell">
                        {entry.empresa ?? '—'}
                      </td>
                      {/* Fecha */}
                      <td className="hidden px-3 py-2.5 text-text-secondary lg:table-cell">
                        {formatDate(entry.fecha_generacion)}
                      </td>
                      {/* P. Compra — inline editable */}
                      <td className="hidden px-3 py-2.5 text-right xl:table-cell">
                        <input
                          type="number" min="0" step="0.01" placeholder="—"
                          value={getEditVal(entry, 'precio_compra')}
                          onChange={(e) => setRowEdit(entry.id, 'precio_compra', e.target.value)}
                          onBlur={(e) => {
                            const { valid, value } = parseNullableNumber(e.target.value)
                            clearRowEdit(entry.id, 'precio_compra')
                            if (valid) void saveField(entry.id, { precio_compra: value })
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          className="w-20 bg-transparent text-right text-xs text-text-primary outline-none placeholder-text-muted border-b border-transparent focus:border-accent transition-colors"
                        />
                      </td>
                      {/* P. Venta — inline editable */}
                      <td className="hidden px-3 py-2.5 text-right xl:table-cell">
                        <input
                          type="number" min="0" step="0.01" placeholder="—"
                          value={getEditVal(entry, 'precio_venta')}
                          onChange={(e) => setRowEdit(entry.id, 'precio_venta', e.target.value)}
                          onBlur={(e) => {
                            const { valid, value } = parseNullableNumber(e.target.value)
                            clearRowEdit(entry.id, 'precio_venta')
                            // Vaciar el campo borra la venta y libera el rendimiento.
                            if (valid) void saveField(entry.id, { precio_venta: value })
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          title="Vacía el campo para deshacer la venta y reanudar el seguimiento del rendimiento"
                          className="w-20 bg-transparent text-right text-xs text-text-primary outline-none placeholder-text-muted border-b border-transparent focus:border-accent transition-colors"
                        />
                      </td>
                      {/* Cantidad */}
                      <td className="hidden px-3 py-2.5 text-right xl:table-cell">
                        <input
                          type="number" min="0" step="1" placeholder="—"
                          value={getEditVal(entry, 'cantidad_acciones')}
                          onChange={(e) => setRowEdit(entry.id, 'cantidad_acciones', e.target.value)}
                          onBlur={(e) => {
                            const { valid, value } = parseNullableNumber(e.target.value)
                            clearRowEdit(entry.id, 'cantidad_acciones')
                            if (valid) void saveField(entry.id, { cantidad_acciones: value })
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          className="w-16 bg-transparent text-right text-xs text-text-primary outline-none placeholder-text-muted border-b border-transparent focus:border-accent transition-colors"
                        />
                      </td>
                      {/* P. Actual — live */}
                      <td className="px-3 py-2.5 text-right font-mono text-xs">
                        {livePrices[entry.ticker] != null
                          ? <span className="text-text-primary">{livePrices[entry.ticker]!.toFixed(2)}</span>
                          : <span className="text-text-muted">—</span>}
                      </td>
                      {/* P. Objetivo — inline editable */}
                      <td className="hidden px-3 py-2.5 text-right lg:table-cell">
                        <input
                          type="number" min="0" step="0.01" placeholder="—"
                          value={getEditVal(entry, 'precio_objetivo_personal')}
                          onChange={(e) => setRowEdit(entry.id, 'precio_objetivo_personal', e.target.value)}
                          onBlur={(e) => {
                            const { valid, value } = parseNullableNumber(e.target.value)
                            clearRowEdit(entry.id, 'precio_objetivo_personal')
                            if (valid) void saveField(entry.id, { precio_objetivo_personal: value })
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          className="w-20 bg-transparent text-right text-xs text-text-primary outline-none placeholder-text-muted border-b border-transparent focus:border-accent transition-colors"
                        />
                      </td>
                      {/* Rendimiento */}
                      <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold">
                        {(() => {
                          const r = calcRendimiento(entry)
                          const locked = entry.estado === 'Vender'
                          if (r == null) return <span className="text-text-muted">—</span>
                          const pos = r >= 0
                          return (
                            <span className="flex items-center justify-end gap-0.5" style={{ color: pos ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                              {locked && <span title="Rendimiento final al vender" className="text-[10px]">🔒</span>}
                              {pos ? '+' : ''}{r.toFixed(2)}%
                            </span>
                          )
                        })()}
                      </td>
                      {/* G/P ($) */}
                      <td className="hidden px-3 py-2.5 text-right font-mono text-xs font-semibold xl:table-cell">
                        {(() => {
                          const g = calcGananciaUSD(entry)
                          if (g == null) return <span className="text-text-muted">—</span>
                          const pos = g >= 0
                          return <span style={{ color: pos ? 'var(--color-positive)' : 'var(--color-negative)' }}>{pos ? '+' : ''}${fmtNum(g)}</span>
                        })()}
                      </td>
                      {/* Comisión */}
                      <td className="hidden px-3 py-2.5 text-right font-mono text-xs xl:table-cell">
                        {(() => {
                          const g = calcGananciaUSD(entry)
                          if (g == null || g <= 0) return <span className="text-text-muted">—</span>
                          const com = g * (comisionPct / 100)
                          return <span style={{ color: 'var(--color-warning)' }}>${fmtNum(com)}</span>
                        })()}
                      </td>
                      {/* Estado */}
                      <td className="px-3 py-2.5">
                        {(() => {
                          const badge = estadoBadge(entry.estado)
                          return (
                            <select
                              value={entry.estado ?? 'Observacion'}
                              onChange={(e) => void handleEstadoChange(entry, e.target.value)}
                              className="cursor-pointer rounded border px-1.5 py-0.5 text-xs font-medium outline-none transition-colors"
                              style={{ background: badge.bg, borderColor: badge.border, color: badge.text }}
                            >
                              <option value="Comprar">Comprar</option>
                              <option value="Mantener">Mantener</option>
                              <option value="Vender">Vender</option>
                              <option value="Observacion">Observar</option>
                            </select>
                          )
                        })()}
                      </td>
                      {/* Acciones */}
                      <td className="px-3 py-2.5">
                        {confirmDeleteId === entry.id ? (
                          <div className="flex items-center justify-end gap-1.5 text-xs">
                            <span className="text-text-secondary">¿Eliminar?</span>
                            <button
                              onClick={() => { void deleteEntry(entry.id); setConfirmDeleteId(null) }}
                              className="rounded px-2 py-1 font-medium text-red-400 transition-colors hover:bg-red-400/10"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded px-2 py-1 text-text-secondary transition-colors hover:bg-surface-raised"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              title="Ver informe"
                              onClick={() => setPreviewEntry(entry)}
                              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              title={downloadingId === entry.id ? 'Descargando…' : entry.custom_docx_path ? 'Descargar versión personalizada' : 'Descargar .docx'}
                              onClick={() => redownload(entry)}
                              disabled={downloadingId !== null}
                              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
                              style={{ color: downloadingId === entry.id ? 'var(--color-text-secondary)' : 'var(--color-text-primary)' }}
                            >
                              {downloadingId === entry.id
                                ? <Loader2 size={13} className="animate-spin" />
                                : <Download size={13} />}
                              {downloadingId === entry.id ? '…' : '.docx'}
                            </button>
                            <button
                              title={uploadingId === entry.id ? 'Subiendo…' : entry.custom_docx_path ? 'Reemplazar Word' : 'Subir Word editado'}
                              onClick={() => triggerUpload(entry)}
                              disabled={uploadingId !== null || downloadingId !== null}
                              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {uploadingId === entry.id
                                ? <Loader2 size={13} className="animate-spin" />
                                : <Upload size={13} />}
                            </button>
                            <button
                              title="Eliminar"
                              onClick={() => setConfirmDeleteId(entry.id)}
                              className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-raised hover:text-red-400"
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

        {/* ── AGENTE PETER recommendations ──────────────────────── */}
        {(() => {
          const peterRecs = agentRecs.filter(r => r.category === 'PETER_LYNCH')
          const dudosas = peterRecs.filter(hasFabricatedEntryPrice).length
          return (
            <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Cpu size={14} style={{ color: 'var(--color-text-primary)' }} />
                  <h2 className="text-sm font-semibold text-text-primary">RECOMENDACIONES AGENTE PETER</h2>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'rgba(0, 61, 102,0.1)', color: 'var(--color-text-primary)' }}>
                    {peterRecs.length}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-text-muted">Lynch score 6/6 · Tendencia alcista · IA confirmada</span>
              </div>
              {dudosas > 0 && (
                <div
                  className="flex items-start gap-2 border-b border-border-subtle px-5 py-2.5"
                  style={{ background: 'rgba(240, 68, 56,0.06)' }}
                >
                  <span className="text-[11px] leading-relaxed" style={{ color: 'var(--color-negative)' }}>
                    <strong>{dudosas} recomendación{dudosas > 1 ? 'es' : ''} con precio de entrada no fiable.</strong>{' '}
                    <span className="text-text-secondary">
                      Se generaron antes de corregir el cálculo y su entrada es un valor que nunca cotizó.
                      Elimínalas con la papelera y vuelve a ejecutar el Agente Peter: al existir una posición
                      activa del mismo ticker, el agente las omite en vez de rehacerlas.
                    </span>
                  </span>
                </div>
              )}
              {agentRecsLoading ? (
                <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-text-muted" /></div>
              ) : peterRecs.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <Cpu size={20} className="text-text-muted" />
                  <p className="text-xs text-text-secondary">Sin recomendaciones del AGENTE PETER aún.</p>
                  <p className="text-[10px] text-text-muted">Ejecuta el agente en la sección Agentes.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-xs">
                    <thead>
                      <tr className="border-b border-border-subtle" style={{ background: 'var(--color-background)' }}>
                        <th className="px-3 py-2.5 text-left font-medium text-text-secondary">Ticker</th>
                        <th className="hidden px-3 py-2.5 text-left font-medium text-text-secondary md:table-cell">Empresa</th>
                        <th className="hidden px-3 py-2.5 text-left font-medium text-text-secondary lg:table-cell">Fecha</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">P.Entrada</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">P.Venta</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">Cant.</th>
                        <th className="px-3 py-2.5 text-right font-medium text-text-secondary">P.Actual{pricesLoading && <Loader2 size={10} className="ml-1 inline animate-spin" />}</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary lg:table-cell">P.Obj.</th>
                        <th className="px-3 py-2.5 text-right font-medium text-text-secondary">Rendim.</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">G/P ($)</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">Comisión</th>
                        <th className="px-3 py-2.5 text-left font-medium text-text-secondary">Estado</th>
                        <th className="px-3 py-2.5 text-right font-medium text-text-secondary">Acc.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {peterRecs.map((rec, i) => {
                        const entradaDudosa = hasFabricatedEntryPrice(rec)
                        return (
                        <tr key={rec.id} className="border-b border-border-subtle transition-colors hover:bg-surface-raised" style={{ background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface)' }}>
                          <td className="px-3 py-2.5">
                            <span className="font-semibold text-positive">{rec.ticker}</span>
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {entradaDudosa && (
                                <span
                                  className="text-[9px] font-mono px-1 py-px rounded font-bold"
                                  style={{ color: 'var(--color-negative)', border: '1px solid rgba(240, 68, 56,0.4)', background: 'rgba(240, 68, 56,0.1)' }}
                                  title={FABRICATED_ENTRY_WARNING}
                                >⚠ ENTRADA NO FIABLE</span>
                              )}
                              {rec.score != null && <span className="text-[9px] font-mono px-1 py-px rounded" style={{ color: 'var(--color-warning)', background: 'rgba(0, 61, 102,0.1)' }}>Lynch {rec.score}/6</span>}
                              {rec.riesgo && <span className="text-[9px] font-mono px-1 py-px rounded" style={{ color: rec.riesgo === 'BAJO' ? 'var(--color-positive)' : rec.riesgo === 'ALTO' ? 'var(--color-negative)' : 'var(--color-warning)', background: rec.riesgo === 'BAJO' ? 'rgba(16, 185, 129,0.08)' : rec.riesgo === 'ALTO' ? 'rgba(240, 68, 56,0.08)' : 'rgba(245, 165, 36,0.08)' }}>{rec.riesgo}</span>}
                              {rec.timeframe && <span className="text-[9px] font-mono text-text-muted">{rec.timeframe}</span>}
                            </div>
                          </td>
                          <td className="hidden max-w-[120px] truncate px-3 py-2.5 text-text-secondary md:table-cell">{rec.empresa ?? '—'}</td>
                          <td className="hidden px-3 py-2.5 text-text-secondary lg:table-cell">{formatDate(rec.created_at)}</td>
                          <td className="hidden px-3 py-2.5 text-right font-mono text-text-secondary xl:table-cell">{rec.precio_entrada != null ? `$${fmtNum(rec.precio_entrada)}` : '—'}</td>
                          {/* P.Venta — solo lectura: lo registra el agente al cerrar */}
                          <td
                            className="hidden px-3 py-2.5 text-right font-mono text-text-secondary xl:table-cell"
                            title={rec.precio_venta != null
                              ? 'Venta ejecutada por el agente al deteriorarse la tesis'
                              : 'Se rellena automáticamente cuando el agente cierre la posición'}
                          >
                            {rec.precio_venta != null ? `$${fmtNum(rec.precio_venta)}` : <span className="text-text-muted">—</span>}
                          </td>
                          <td className="hidden px-3 py-2.5 text-right xl:table-cell">
                            <input type="number" min="0" step="1" placeholder="—"
                              value={getAgentEditVal(rec, 'cantidad_acciones')}
                              onChange={e => setAgentRowEdits(prev => ({ ...prev, [rec.id]: { ...prev[rec.id], cantidad_acciones: e.target.value } }))}
                              onBlur={e => {
                                const val = parseFloat(e.target.value)
                                setAgentRowEdits(prev => { const c = { ...prev }; if (c[rec.id]) { const f = { ...c[rec.id] }; delete f.cantidad_acciones; c[rec.id] = f }; return c })
                                if (!isNaN(val) && val >= 0) void saveAgentField(rec.id, { cantidad_acciones: val })
                              }}
                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                              className="w-16 bg-transparent text-right text-xs text-text-primary outline-none placeholder-text-muted border-b border-transparent focus:border-accent transition-colors"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs">
                            {livePrices[rec.ticker] != null ? <span className="text-text-primary">{livePrices[rec.ticker]!.toFixed(2)}</span> : <span className="text-text-muted">—</span>}
                          </td>
                          <td className="hidden px-3 py-2.5 text-right font-mono text-text-secondary lg:table-cell">
                            {rec.precio_objetivo != null ? `$${fmtNum(rec.precio_objetivo)}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold">
                            {(() => {
                              const ep = rec.precio_entrada
                              // Una vez vendida, el rendimiento se congela en el
                              // precio de salida en vez de seguir al mercado.
                              const cerrada = rec.precio_venta != null
                              const ref = cerrada ? rec.precio_venta! : livePrices[rec.ticker]
                              if (ref == null || ep == null || ep === 0) return <span className="text-text-muted">—</span>
                              const pct = ((ref - ep) / ep) * 100
                              const pos = pct >= 0
                              return (
                                <span className="flex items-center justify-end gap-0.5" style={{ color: pos ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                                  {cerrada && <span title="Posición cerrada por el agente: rendimiento final" className="text-[10px]">🔒</span>}
                                  {pos ? '+' : ''}{pct.toFixed(2)}%
                                </span>
                              )
                            })()}
                          </td>
                          <td className="hidden px-3 py-2.5 text-right font-mono text-xs font-semibold xl:table-cell">
                            {(() => { const g = calcAgentGanancia(rec); if (g == null) return <span className="text-text-muted">—</span>; const pos = g >= 0; return <span style={{ color: pos ? 'var(--color-positive)' : 'var(--color-negative)' }}>{pos ? '+' : ''}${fmtNum(g)}</span> })()}
                          </td>
                          <td className="hidden px-3 py-2.5 text-right font-mono text-xs xl:table-cell">
                            {(() => { const g = calcAgentGanancia(rec); if (g == null || g <= 0) return <span className="text-text-muted">—</span>; return <span style={{ color: 'var(--color-warning)' }}>${fmtNum(g * (comisionPct / 100))}</span> })()}
                          </td>
                          <td className="px-3 py-2.5">
                            {(() => { const badge = estadoBadge(rec.estado); return (
                              <select value={rec.estado ?? 'Observacion'} onChange={e => void saveAgentField(rec.id, { estado: e.target.value })}
                                className="cursor-pointer rounded border px-1.5 py-0.5 text-xs font-medium outline-none transition-colors"
                                style={{ background: badge.bg, borderColor: badge.border, color: badge.text }}>
                                <option value="Comprar">Comprar</option>
                                <option value="Mantener">Mantener</option>
                                <option value="Vender">Vender</option>
                                <option value="Observacion">Observar</option>
                              </select>
                            )})()}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {confirmDeleteAgentId === rec.id ? (
                              <div className="flex items-center justify-end gap-1 text-xs">
                                <span className="text-text-secondary">¿Eliminar?</span>
                                <button onClick={() => { void deleteAgentRec(rec.id); setConfirmDeleteAgentId(null) }} className="rounded px-2 py-1 font-medium text-red-400 hover:bg-red-400/10">Sí</button>
                                <button onClick={() => setConfirmDeleteAgentId(null)} className="rounded px-2 py-1 text-text-secondary hover:bg-surface-raised">No</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDeleteAgentId(rec.id)} className="rounded-md p-1.5 text-text-muted hover:bg-surface-raised hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                            )}
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── AGENTE SMALL recommendations ─────────────────────── */}
        {(() => {
          const smallRecs = agentRecs.filter(r => r.category === 'SMALL_CAPS')
          return (
            <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Cpu size={14} style={{ color: 'var(--color-text-primary)' }} />
                  <h2 className="text-sm font-semibold text-text-primary">RECOMENDACIONES AGENTE SMALL</h2>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'rgba(0, 61, 102,0.1)', color: 'var(--color-text-primary)' }}>
                    {smallRecs.length}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-text-muted">Lynch adaptado ≥4/6 · S&amp;P 600 + Russell 2000 · Tendencia alcista</span>
              </div>
              {agentRecsLoading ? (
                <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-text-muted" /></div>
              ) : smallRecs.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <Cpu size={20} className="text-text-muted" />
                  <p className="text-xs text-text-secondary">Sin recomendaciones del AGENTE SMALL aún.</p>
                  <p className="text-[10px] text-text-muted">Ejecuta el agente en la sección Agentes.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-xs">
                    <thead>
                      <tr className="border-b border-border-subtle" style={{ background: 'var(--color-background)' }}>
                        <th className="px-3 py-2.5 text-left font-medium text-text-secondary">Ticker</th>
                        <th className="hidden px-3 py-2.5 text-left font-medium text-text-secondary md:table-cell">Empresa</th>
                        <th className="hidden px-3 py-2.5 text-left font-medium text-text-secondary lg:table-cell">Fecha</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">P.Entrada</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">P.Venta</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">Cant.</th>
                        <th className="px-3 py-2.5 text-right font-medium text-text-secondary">P.Actual{pricesLoading && <Loader2 size={10} className="ml-1 inline animate-spin" />}</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary lg:table-cell">P.Obj.</th>
                        <th className="px-3 py-2.5 text-right font-medium text-text-secondary">Rendim.</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">G/P ($)</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">Comisión</th>
                        <th className="px-3 py-2.5 text-left font-medium text-text-secondary">Estado</th>
                        <th className="px-3 py-2.5 text-right font-medium text-text-secondary">Acc.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {smallRecs.map((rec, i) => (
                        <tr key={rec.id} className="border-b border-border-subtle transition-colors hover:bg-surface-raised" style={{ background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface)' }}>
                          <td className="px-3 py-2.5">
                            <span className="font-semibold text-positive">{rec.ticker}</span>
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {rec.score != null && <span className="text-[9px] font-mono px-1 py-px rounded" style={{ color: 'var(--color-warning)', background: 'rgba(0, 61, 102,0.1)' }}>Lynch {rec.score}/6</span>}
                              {rec.market_cap_m != null && <span className="text-[9px] font-mono px-1 py-px rounded text-text-secondary" style={{ background: 'rgba(100,116,139,0.1)' }}>${(rec.market_cap_m / 1000).toFixed(1)}B</span>}
                              {rec.riesgo && <span className="text-[9px] font-mono px-1 py-px rounded" style={{ color: rec.riesgo === 'BAJO' ? 'var(--color-positive)' : rec.riesgo === 'ALTO' ? 'var(--color-negative)' : 'var(--color-warning)', background: rec.riesgo === 'BAJO' ? 'rgba(16, 185, 129,0.08)' : rec.riesgo === 'ALTO' ? 'rgba(240, 68, 56,0.08)' : 'rgba(245, 165, 36,0.08)' }}>{rec.riesgo}</span>}
                              {rec.timeframe && <span className="text-[9px] font-mono text-text-muted">{rec.timeframe}</span>}
                            </div>
                          </td>
                          <td className="hidden max-w-[120px] truncate px-3 py-2.5 text-text-secondary md:table-cell">{rec.empresa ?? '—'}</td>
                          <td className="hidden px-3 py-2.5 text-text-secondary lg:table-cell">{formatDate(rec.created_at)}</td>
                          <td className="hidden px-3 py-2.5 text-right font-mono text-text-secondary xl:table-cell">{rec.precio_entrada != null ? `$${fmtNum(rec.precio_entrada)}` : '—'}</td>
                          {/* P.Venta — solo lectura: lo registra el agente al cerrar */}
                          <td
                            className="hidden px-3 py-2.5 text-right font-mono text-text-secondary xl:table-cell"
                            title={rec.precio_venta != null
                              ? 'Venta ejecutada por el agente al deteriorarse la tesis'
                              : 'Se rellena automáticamente cuando el agente cierre la posición'}
                          >
                            {rec.precio_venta != null ? `$${fmtNum(rec.precio_venta)}` : <span className="text-text-muted">—</span>}
                          </td>
                          <td className="hidden px-3 py-2.5 text-right xl:table-cell">
                            <input type="number" min="0" step="1" placeholder="—"
                              value={getAgentEditVal(rec, 'cantidad_acciones')}
                              onChange={e => setAgentRowEdits(prev => ({ ...prev, [rec.id]: { ...prev[rec.id], cantidad_acciones: e.target.value } }))}
                              onBlur={e => {
                                const val = parseFloat(e.target.value)
                                setAgentRowEdits(prev => { const c = { ...prev }; if (c[rec.id]) { const f = { ...c[rec.id] }; delete f.cantidad_acciones; c[rec.id] = f }; return c })
                                if (!isNaN(val) && val >= 0) void saveAgentField(rec.id, { cantidad_acciones: val })
                              }}
                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                              className="w-16 bg-transparent text-right text-xs text-text-primary outline-none placeholder-text-muted border-b border-transparent focus:border-accent transition-colors"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs">
                            {livePrices[rec.ticker] != null ? <span className="text-text-primary">{livePrices[rec.ticker]!.toFixed(2)}</span> : <span className="text-text-muted">—</span>}
                          </td>
                          <td className="hidden px-3 py-2.5 text-right font-mono text-text-secondary lg:table-cell">
                            {rec.precio_objetivo != null ? `$${fmtNum(rec.precio_objetivo)}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold">
                            {(() => {
                              const ep = rec.precio_entrada
                              // Una vez vendida, el rendimiento se congela en el
                              // precio de salida en vez de seguir al mercado.
                              const cerrada = rec.precio_venta != null
                              const ref = cerrada ? rec.precio_venta! : livePrices[rec.ticker]
                              if (ref == null || ep == null || ep === 0) return <span className="text-text-muted">—</span>
                              const pct = ((ref - ep) / ep) * 100
                              const pos = pct >= 0
                              return (
                                <span className="flex items-center justify-end gap-0.5" style={{ color: pos ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                                  {cerrada && <span title="Posición cerrada por el agente: rendimiento final" className="text-[10px]">🔒</span>}
                                  {pos ? '+' : ''}{pct.toFixed(2)}%
                                </span>
                              )
                            })()}
                          </td>
                          <td className="hidden px-3 py-2.5 text-right font-mono text-xs font-semibold xl:table-cell">
                            {(() => { const g = calcAgentGanancia(rec); if (g == null) return <span className="text-text-muted">—</span>; const pos = g >= 0; return <span style={{ color: pos ? 'var(--color-positive)' : 'var(--color-negative)' }}>{pos ? '+' : ''}${fmtNum(g)}</span> })()}
                          </td>
                          <td className="hidden px-3 py-2.5 text-right font-mono text-xs xl:table-cell">
                            {(() => { const g = calcAgentGanancia(rec); if (g == null || g <= 0) return <span className="text-text-muted">—</span>; return <span style={{ color: 'var(--color-warning)' }}>${fmtNum(g * (comisionPct / 100))}</span> })()}
                          </td>
                          <td className="px-3 py-2.5">
                            {(() => { const badge = estadoBadge(rec.estado); return (
                              <select value={rec.estado ?? 'Observacion'} onChange={e => void saveAgentField(rec.id, { estado: e.target.value })}
                                className="cursor-pointer rounded border px-1.5 py-0.5 text-xs font-medium outline-none transition-colors"
                                style={{ background: badge.bg, borderColor: badge.border, color: badge.text }}>
                                <option value="Comprar">Comprar</option>
                                <option value="Mantener">Mantener</option>
                                <option value="Vender">Vender</option>
                                <option value="Observacion">Observar</option>
                              </select>
                            )})()}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {confirmDeleteAgentId === rec.id ? (
                              <div className="flex items-center justify-end gap-1 text-xs">
                                <span className="text-text-secondary">¿Eliminar?</span>
                                <button onClick={() => { void deleteAgentRec(rec.id); setConfirmDeleteAgentId(null) }} className="rounded px-2 py-1 font-medium text-red-400 hover:bg-red-400/10">Sí</button>
                                <button onClick={() => setConfirmDeleteAgentId(null)} className="rounded px-2 py-1 text-text-secondary hover:bg-surface-raised">No</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDeleteAgentId(rec.id)} className="rounded-md p-1.5 text-text-muted hover:bg-surface-raised hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── AGENTE GAMMA recommendations ─────────────────────────── */}
        {(() => {
          const gammaRecs = agentRecs.filter(r => r.category === 'OPTIONS_GAMMA')
          return (
            <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Cpu size={14} style={{ color: '#8b8ff0' }} />
                  <h2 className="text-sm font-semibold text-text-primary">RECOMENDACIONES AGENTE GAMMA</h2>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-mono font-bold"
                    style={{ background: 'rgba(16, 185, 129,0.12)', color: 'var(--color-positive)', border: '1px solid rgba(16, 185, 129,0.35)' }}
                    title="Se paga la prima al abrir: la posición gana si el contrato vale más al cerrar o al vencer"
                  >COMPRA DE OPCIONES</span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'rgba(139, 143, 240,0.1)', color: '#8b8ff0' }}>
                    {gammaRecs.length}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-text-muted">Opciones direccionales · CALL alcista / PUT bajista · Proyección 30d</span>
              </div>
              {agentRecsLoading ? (
                <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-text-muted" /></div>
              ) : gammaRecs.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <Cpu size={20} className="text-text-muted" />
                  <p className="text-xs text-text-secondary">Sin recomendaciones del AGENTE GAMMA aún.</p>
                  <p className="text-[10px] text-text-muted">Ejecuta el agente en la sección Agentes.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-xs">
                    <thead>
                      <tr className="border-b border-border-subtle" style={{ background: 'var(--color-background)' }}>
                        <th className="px-3 py-2.5 text-left font-medium text-text-secondary">Ticker</th>
                        <th className="hidden px-3 py-2.5 text-left font-medium text-text-secondary lg:table-cell">Fecha</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">Prima</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary lg:table-cell">Prima Act.</th>
                        <th className="px-3 py-2.5 text-right font-medium text-text-secondary" title="Resultado en dólares de 1 contrato (100 acciones)">Result. ($)</th>
                        <th className="px-3 py-2.5 text-right font-medium text-text-secondary">Result. (%)</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">Strike</th>
                        <th className="hidden px-3 py-2.5 text-left font-medium text-text-secondary xl:table-cell">Expiry</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary lg:table-cell">P.Subyac.{pricesLoading && <Loader2 size={10} className="ml-1 inline animate-spin" />}</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary lg:table-cell">Breakeven</th>
                        <th
                          className="hidden px-3 py-2.5 text-right font-medium xl:table-cell"
                          style={{ color: '#8b8ff0' }}
                          title="Proyección del subyacente a 30 días (regresión lineal + EWMA) en el momento de recomendar. Es la señal de entrada, NO el resultado de la operación."
                        >Forecast ini.</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">Delta</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">IV</th>
                        <th className="px-3 py-2.5 text-left font-medium text-text-secondary">Estado</th>
                        <th className="px-3 py-2.5 text-right font-medium text-text-secondary">Acc.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gammaRecs.map((rec, i) => {
                        const rpt = rec.ai_report ?? {}
                        const optionType = rpt.optionType as string | undefined
                        const strike = rpt.strike as number | undefined
                        const expiration = rpt.expiration as string | undefined
                        const delta = rpt.delta as number | undefined
                        const iv = rpt.iv as number | undefined
                        const breakeven = rpt.breakeven as number | undefined
                        const forecastReturn = rpt.forecastReturn as number | undefined
                        const typeColor = optionType === 'CALL' ? 'var(--color-positive)' : optionType === 'PUT' ? 'var(--color-negative)' : 'var(--color-text-secondary)'
                        const ref = optionRefFromRec(rec)
                        const primaActual = ref ? optionPrices[contractKey(ref)] : undefined
                        // Gamma compra la prima: gana si sube.
                        const outcome = optionOutcome(rec, primaActual, 'long')
                        const dteActual = expiration ? daysToExpiration(expiration) : null
                        const vencido = expiration != null && dteActual === 0
                        return (
                          <tr key={rec.id} className="border-b border-border-subtle transition-colors hover:bg-surface-raised" style={{ background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface)' }}>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{rec.ticker}</span>
                                {optionType && <span className="text-[9px] font-mono px-1 py-px rounded font-bold" style={{ color: typeColor, border: `1px solid ${typeColor}40`, background: `${typeColor}10` }}>{optionType}</span>}
                                {vencido && <span className="text-[9px] font-mono px-1 py-px rounded" style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }} title={`Venció el ${expiration}`}>VENC.</span>}
                              </div>
                            </td>
                            <td className="hidden px-3 py-2.5 text-text-secondary lg:table-cell">{formatDate(rec.created_at)}</td>
                            <td className="hidden px-3 py-2.5 text-right font-mono text-text-secondary xl:table-cell">
                              {rec.precio_entrada != null ? `$${fmtNum(rec.precio_entrada)}` : '—'}
                            </td>
                            <td className="hidden px-3 py-2.5 text-right font-mono text-xs lg:table-cell">
                              {outcome != null
                                ? <span className="text-text-primary">${fmtNum(outcome.valorActual)}</span>
                                : <span className="text-text-muted">—</span>}
                            </td>
                            {/* Resultado en dólares de 1 contrato = 100 acciones */}
                            <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold" title={outcome?.detalle}>
                              {outcome != null ? (
                                <span className="flex items-center justify-end gap-0.5" style={{ color: outcome.usd >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                                  {outcome.cerrada && <span title="Contrato vencido: resultado definitivo" className="text-[10px]">🔒</span>}
                                  {outcome.usd >= 0 ? '+' : '−'}${fmtNum(Math.abs(outcome.usd))}
                                </span>
                              ) : <span className="text-text-muted">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold" title={outcome?.detalle}>
                              {outcome?.pct != null ? (
                                <span style={{ color: outcome.pct >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>{outcome.pct >= 0 ? '+' : ''}{outcome.pct.toFixed(2)}%</span>
                              ) : <span className="text-text-muted">—</span>}
                            </td>
                            <td className="hidden px-3 py-2.5 text-right font-mono text-text-secondary xl:table-cell">{strike != null ? `$${strike}` : '—'}</td>
                            <td className="hidden px-3 py-2.5 text-text-secondary xl:table-cell">{expiration ?? '—'}</td>
                            <td className="hidden px-3 py-2.5 text-right font-mono text-xs lg:table-cell">
                              {(() => {
                                // En una posición cerrada el precio relevante es el
                                // del vencimiento, no el de hoy: es el que determinó
                                // el resultado de la operación.
                                const alVencer = rpt.underlyingAtExpiry as number | undefined
                                if (alVencer != null) return (
                                  <span className="text-text-primary" title={`Cierre del subyacente el ${expiration}, usado para liquidar el contrato`}>
                                    {alVencer.toFixed(2)}
                                    <span className="ml-1 text-[9px] text-text-muted">al vencer</span>
                                  </span>
                                )
                                const live = livePrices[rec.ticker]
                                return live != null
                                  ? <span className="text-text-primary">{live.toFixed(2)}</span>
                                  : <span className="text-text-muted">—</span>
                              })()}
                            </td>
                            <td className="hidden px-3 py-2.5 text-right font-mono text-text-secondary lg:table-cell">
                              {breakeven != null ? `$${breakeven.toFixed(2)}` : '—'}
                            </td>
                            <td className="hidden px-3 py-2.5 text-right font-mono text-xs font-semibold xl:table-cell">
                              {forecastReturn != null ? (
                                <span style={{ color: forecastReturn >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>{forecastReturn >= 0 ? '+' : ''}{forecastReturn.toFixed(1)}%</span>
                              ) : <span className="text-text-muted">—</span>}
                            </td>
                            <td className="hidden px-3 py-2.5 text-right font-mono text-text-secondary xl:table-cell">{delta != null ? delta.toFixed(2) : '—'}</td>
                            <td className="hidden px-3 py-2.5 text-right font-mono text-text-secondary xl:table-cell">{iv != null ? `${(iv * 100).toFixed(0)}%` : '—'}</td>
                            <td className="px-3 py-2.5">
                              {(() => { const badge = estadoBadge(rec.estado); return (
                                <select value={rec.estado ?? 'Observacion'} onChange={e => void saveAgentField(rec.id, { estado: e.target.value })}
                                  className="cursor-pointer rounded border px-1.5 py-0.5 text-xs font-medium outline-none transition-colors"
                                  style={{ background: badge.bg, borderColor: badge.border, color: badge.text }}>
                                  <option value="Comprar">Comprar</option>
                                  <option value="Mantener">Mantener</option>
                                  <option value="Vender">Vender</option>
                                  <option value="Observacion">Observar</option>
                                </select>
                              )})()}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {confirmDeleteAgentId === rec.id ? (
                                <div className="flex items-center justify-end gap-1 text-xs">
                                  <span className="text-text-secondary">¿Eliminar?</span>
                                  <button onClick={() => { void deleteAgentRec(rec.id); setConfirmDeleteAgentId(null) }} className="rounded px-2 py-1 font-medium text-red-400 hover:bg-red-400/10">Sí</button>
                                  <button onClick={() => setConfirmDeleteAgentId(null)} className="rounded px-2 py-1 text-text-secondary hover:bg-surface-raised">No</button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmDeleteAgentId(rec.id)} className="rounded-md p-1.5 text-text-muted hover:bg-surface-raised hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── AGENTE THETA recommendations ──────────────────────────── */}
        {(() => {
          const thetaRecs = agentRecs.filter(r => r.category === 'OPTIONS_THETA')
          return (
            <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Cpu size={14} style={{ color: '#e0a458' }} />
                  <h2 className="text-sm font-semibold text-text-primary">RECOMENDACIONES AGENTE THETA</h2>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-mono font-bold"
                    style={{ background: 'rgba(224, 164, 88,0.12)', color: '#e0a458', border: '1px solid rgba(224, 164, 88,0.35)' }}
                    title="Se cobra la prima al abrir: la posición gana si el contrato vale menos al cerrar o vence sin valor"
                  >VENTA DE OPCIONES</span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'rgba(224, 164, 88,0.1)', color: '#e0a458' }}>
                    {thetaRecs.length}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-text-muted">Venta de primas · Sell-put / Covered-call · Income</span>
              </div>
              {agentRecsLoading ? (
                <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-text-muted" /></div>
              ) : thetaRecs.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <Cpu size={20} className="text-text-muted" />
                  <p className="text-xs text-text-secondary">Sin recomendaciones del AGENTE THETA aún.</p>
                  <p className="text-[10px] text-text-muted">Ejecuta el agente en la sección Agentes.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-xs">
                    <thead>
                      <tr className="border-b border-border-subtle" style={{ background: 'var(--color-background)' }}>
                        <th className="px-3 py-2.5 text-left font-medium text-text-secondary">Ticker</th>
                        <th className="hidden px-3 py-2.5 text-left font-medium text-text-secondary lg:table-cell">Fecha</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">Prima</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary lg:table-cell">Prima Act.</th>
                        <th className="px-3 py-2.5 text-right font-medium text-text-secondary" title="Resultado en dólares de 1 contrato (100 acciones)">Result. ($)</th>
                        <th className="px-3 py-2.5 text-right font-medium text-text-secondary">Result. (%)</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">Strike</th>
                        <th className="hidden px-3 py-2.5 text-left font-medium text-text-secondary xl:table-cell">Expiry</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary lg:table-cell">P.Subyac.{pricesLoading && <Loader2 size={10} className="ml-1 inline animate-spin" />}</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary lg:table-cell">Breakeven</th>
                        <th className="px-3 py-2.5 text-right font-medium" style={{ color: '#e0a458' }}>DTE</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">|Delta|</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium text-text-secondary xl:table-cell">IV</th>
                        <th className="px-3 py-2.5 text-left font-medium text-text-secondary">Estado</th>
                        <th className="px-3 py-2.5 text-right font-medium text-text-secondary">Acc.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {thetaRecs.map((rec, i) => {
                        const rpt = rec.ai_report ?? {}
                        const strategy = rpt.strategy as string | undefined
                        const strike = rpt.strike as number | undefined
                        const expiration = rpt.expiration as string | undefined
                        const delta = rpt.delta as number | undefined
                        const iv = rpt.iv as number | undefined
                        const breakeven = rpt.breakeven as number | undefined
                        const stratColor = strategy === 'SELL_PUT' ? '#e0a458' : strategy === 'COVERED_CALL' ? '#38bdf8' : 'var(--color-text-secondary)'
                        const stratLabel = strategy === 'SELL_PUT' ? 'SELL-PUT' : strategy === 'COVERED_CALL' ? 'COV-CALL' : '—'
                        // DTE recalculado contra hoy: el valor de ai_report es del día en que corrió el agente.
                        const dteActual = expiration ? daysToExpiration(expiration) : null
                        const vencido = expiration != null && dteActual === 0
                        const ref = optionRefFromRec(rec)
                        const primaActual = ref ? optionPrices[contractKey(ref)] : undefined
                        // Theta cobra la prima al abrir: gana si la prima cae.
                        const outcome = optionOutcome(rec, primaActual, 'short')
                        return (
                          <tr key={rec.id} className="border-b border-border-subtle transition-colors hover:bg-surface-raised" style={{ background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface)' }}>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{rec.ticker}</span>
                                {strategy && <span className="text-[9px] font-mono px-1 py-px rounded font-bold" style={{ color: stratColor, border: `1px solid ${stratColor}40`, background: `${stratColor}10` }}>{stratLabel}</span>}
                              </div>
                            </td>
                            <td className="hidden px-3 py-2.5 text-text-secondary lg:table-cell">{formatDate(rec.created_at)}</td>
                            <td className="hidden px-3 py-2.5 text-right font-mono xl:table-cell">
                              <span className="font-semibold" style={{ color: 'var(--color-positive)' }}>{rec.precio_entrada != null ? `$${fmtNum(rec.precio_entrada)}` : '—'}</span>
                            </td>
                            <td className="hidden px-3 py-2.5 text-right font-mono text-xs lg:table-cell">
                              {outcome != null
                                ? <span className="text-text-primary">${fmtNum(outcome.valorActual)}</span>
                                : <span className="text-text-muted">—</span>}
                            </td>
                            {/* Resultado en dólares de 1 contrato = 100 acciones */}
                            <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold" title={outcome?.detalle}>
                              {outcome != null ? (
                                <span className="flex items-center justify-end gap-0.5" style={{ color: outcome.usd >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                                  {outcome.cerrada && <span title="Contrato vencido: resultado definitivo" className="text-[10px]">🔒</span>}
                                  {outcome.usd >= 0 ? '+' : '−'}${fmtNum(Math.abs(outcome.usd))}
                                </span>
                              ) : <span className="text-text-muted">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold" title={outcome?.detalle}>
                              {outcome?.pct != null ? (
                                <span style={{ color: outcome.pct >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>{outcome.pct >= 0 ? '+' : ''}{outcome.pct.toFixed(2)}%</span>
                              ) : <span className="text-text-muted">—</span>}
                            </td>
                            <td className="hidden px-3 py-2.5 text-right font-mono text-text-secondary xl:table-cell">{strike != null ? `$${strike}` : '—'}</td>
                            <td className="hidden px-3 py-2.5 text-text-secondary xl:table-cell">{expiration ?? '—'}</td>
                            <td className="hidden px-3 py-2.5 text-right font-mono text-xs lg:table-cell">
                              {(() => {
                                // En una posición cerrada el precio relevante es el
                                // del vencimiento, no el de hoy: es el que determinó
                                // el resultado de la operación.
                                const alVencer = rpt.underlyingAtExpiry as number | undefined
                                if (alVencer != null) return (
                                  <span className="text-text-primary" title={`Cierre del subyacente el ${expiration}, usado para liquidar el contrato`}>
                                    {alVencer.toFixed(2)}
                                    <span className="ml-1 text-[9px] text-text-muted">al vencer</span>
                                  </span>
                                )
                                const live = livePrices[rec.ticker]
                                return live != null
                                  ? <span className="text-text-primary">{live.toFixed(2)}</span>
                                  : <span className="text-text-muted">—</span>
                              })()}
                            </td>
                            <td className="hidden px-3 py-2.5 text-right font-mono text-text-secondary lg:table-cell">
                              {breakeven != null ? `$${breakeven.toFixed(2)}` : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold">
                              {vencido ? (
                                <span style={{ color: 'var(--color-text-secondary)' }} title={`Venció el ${expiration}`}>VENC.</span>
                              ) : dteActual != null ? (
                                <span style={{ color: dteActual <= 7 ? 'var(--color-negative)' : dteActual <= 21 ? 'var(--color-warning)' : 'var(--color-positive)' }}>{dteActual}d</span>
                              ) : <span className="text-text-muted">—</span>}
                            </td>
                            <td className="hidden px-3 py-2.5 text-right font-mono text-text-secondary xl:table-cell">{delta != null ? Math.abs(delta).toFixed(2) : '—'}</td>
                            <td className="hidden px-3 py-2.5 text-right font-mono text-text-secondary xl:table-cell">{iv != null ? `${(iv * 100).toFixed(0)}%` : '—'}</td>
                            <td className="px-3 py-2.5">
                              {(() => { const badge = estadoBadge(rec.estado); return (
                                <select value={rec.estado ?? 'Observacion'} onChange={e => void saveAgentField(rec.id, { estado: e.target.value })}
                                  className="cursor-pointer rounded border px-1.5 py-0.5 text-xs font-medium outline-none transition-colors"
                                  style={{ background: badge.bg, borderColor: badge.border, color: badge.text }}>
                                  <option value="Comprar">Comprar</option>
                                  <option value="Mantener">Mantener</option>
                                  <option value="Vender">Vender</option>
                                  <option value="Observacion">Observar</option>
                                </select>
                              )})()}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {confirmDeleteAgentId === rec.id ? (
                                <div className="flex items-center justify-end gap-1 text-xs">
                                  <span className="text-text-secondary">¿Eliminar?</span>
                                  <button onClick={() => { void deleteAgentRec(rec.id); setConfirmDeleteAgentId(null) }} className="rounded px-2 py-1 font-medium text-red-400 hover:bg-red-400/10">Sí</button>
                                  <button onClick={() => setConfirmDeleteAgentId(null)} className="rounded px-2 py-1 text-text-secondary hover:bg-surface-raised">No</button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmDeleteAgentId(rec.id)} className="rounded-md p-1.5 text-text-muted hover:bg-surface-raised hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })()}
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
              color: t.variant === 'success' ? 'var(--color-positive)' : 'var(--color-negative)',
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
