'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AgentRec } from '@/lib/agentes/types'
import { estaAbierta } from '@/lib/agentes/types'
import { contractKey } from '@/lib/options/occ-symbol'
import { optionRefFromRec } from '@/lib/options/mark'
import { BENCHMARK, OPTION_CATEGORIES, STOCK_CATEGORIES } from '@/lib/portafolios/config'
import { isoDay } from '@/lib/portafolios/closed-date'
import type { ClosesByTicker } from '@/lib/portafolios/types'

/** Cada cuánto se refrescan recomendaciones y precios. */
const REFRESCO_MS = 60_000

/**
 * Los históricos son caros y solo cambian una vez al día: no tiene sentido
 * pedirlos al mismo ritmo que las cotizaciones.
 */
const REFRESCO_HISTORICO_MS = 15 * 60_000

export interface LivePortfolioData {
  recs: AgentRec[]
  /** Precio de mercado por ticker de acciones. */
  livePrices: Record<string, number>
  /** Prima actual por contrato, indexada por `contractKey`. */
  primas: Record<string, number>
  /** Cierres diarios por ticker, incluido el benchmark. */
  closes: ClosesByTicker
  cargando: boolean
  error: string | null
  /** Momento del último refresco correcto de precios. */
  actualizado: Date | null
  refrescar: () => void
}

/**
 * Datos vivos de los portafolios.
 *
 * Refresca en un solo sitio las tres fuentes que necesita el dashboard y
 * mantiene el último valor bueno si una petición falla, igual que hace el
 * ticker de mercado: un hueco puntual de Yahoo no debe vaciar la pantalla.
 *
 * Al releer `agent_recommendations` cada minuto, una posición que un agente
 * acaba de vender desaparece sola de los gráficos y pasa al track record, sin
 * ninguna lógica adicional.
 */
export function useLivePortfolio(): LivePortfolioData {
  const [recs, setRecs] = useState<AgentRec[]>([])
  const [livePrices, setLivePrices] = useState<Record<string, number>>({})
  const [primas, setPrimas] = useState<Record<string, number>>({})
  const [closes, setCloses] = useState<ClosesByTicker>({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actualizado, setActualizado] = useState<Date | null>(null)
  const [tick, setTick] = useState(0)

  const refrescar = useCallback(() => setTick(t => t + 1), [])

  // ── Recomendaciones ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    const cargar = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (!cancelled) { setError('Sesión no disponible'); setCargando(false) }
          return
        }
        // Sin filtro por usuario: la cartera es única y la política de lectura
        // ya limita las filas visibles a las del administrador. Filtrar por
        // `user.id` dejaría el portafolio vacío para todos los demás.
        const { data, error: dbError } = await supabase
          .from('agent_recommendations')
          .select('*')
          .order('created_at', { ascending: true })

        if (cancelled) return
        if (dbError) { setError(dbError.message); setCargando(false); return }
        setRecs((data ?? []) as AgentRec[])
        setError(null)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setCargando(false)
      }
    }

    void cargar()
    const id = setInterval(() => void cargar(), REFRESCO_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [tick])

  // ── Qué hay que cotizar ────────────────────────────────────────────────
  // Solo las posiciones abiertas: una cerrada ya tiene su precio de salida
  // grabado y volver a cotizarla movería un resultado que es definitivo.
  const tickersAcciones = useMemo(() => [...new Set(
    recs.filter(r => STOCK_CATEGORIES.includes(r.category) && estaAbierta(r)).map(r => r.ticker)
  )].sort(), [recs])

  const contratos = useMemo(() => recs
    .filter(r => OPTION_CATEGORIES.includes(r.category) && estaAbierta(r))
    .map(optionRefFromRec)
    .filter((c): c is NonNullable<ReturnType<typeof optionRefFromRec>> => c != null),
  [recs])

  const tickersHistoricos = useMemo(() => [...new Set([
    ...recs.filter(r => STOCK_CATEGORIES.includes(r.category)).map(r => r.ticker),
    BENCHMARK,
  ])].sort(), [recs])

  const desde = useMemo(() => (
    recs.length > 0
      ? isoDay(recs.reduce((min, r) => (r.created_at < min ? r.created_at : min), recs[0].created_at))
      : null
  ), [recs])

  // Los cuerpos de las peticiones se leen de refs para que los efectos
  // dependan solo de la clave serializada: así una recarga de la tabla que no
  // cambie la composición no vuelve a disparar las peticiones.
  const contratosRef = useRef(contratos)
  contratosRef.current = contratos
  const tickersHistoricosRef = useRef(tickersHistoricos)
  tickersHistoricosRef.current = tickersHistoricos

  // ── Precios de acciones ────────────────────────────────────────────────
  const clavePrecios = tickersAcciones.join(',')

  useEffect(() => {
    if (!clavePrecios) { setLivePrices({}); return }
    let cancelled = false

    const cargar = async () => {
      try {
        const res = await fetch(`/api/informes/live-prices?tickers=${encodeURIComponent(clavePrecios)}`, {
          cache: 'no-store',
        })
        if (!res.ok || cancelled) return
        const data = await res.json() as Record<string, number>
        if (cancelled) return
        setLivePrices(data)
        setActualizado(new Date())
      } catch { /* se conserva el último precio conocido */ }
    }

    void cargar()
    const id = setInterval(() => void cargar(), REFRESCO_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [clavePrecios])

  // ── Primas de opciones ─────────────────────────────────────────────────
  const claveContratos = contratos.map(contractKey).sort().join('~')

  useEffect(() => {
    if (!claveContratos) { setPrimas({}); return }
    let cancelled = false

    const cargar = async () => {
      try {
        const res = await fetch('/api/informes/option-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contracts: contratosRef.current }),
          cache: 'no-store',
        })
        if (!res.ok || cancelled) return
        const data = await res.json() as Record<string, number>
        if (!cancelled) setPrimas(data)
      } catch { /* se conserva la última prima conocida */ }
    }

    void cargar()
    const id = setInterval(() => void cargar(), REFRESCO_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [claveContratos])

  // ── Históricos diarios ─────────────────────────────────────────────────
  const claveHistorico = desde ? `${desde}::${tickersHistoricos.join(',')}` : ''

  useEffect(() => {
    if (!claveHistorico || !desde) return
    let cancelled = false

    const cargar = async () => {
      try {
        const res = await fetch('/api/portafolios/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tickers: tickersHistoricosRef.current, from: desde }),
          cache: 'no-store',
        })
        if (!res.ok || cancelled) return
        const data = await res.json() as ClosesByTicker
        if (!cancelled) setCloses(data)
      } catch { /* se conserva el histórico anterior */ }
    }

    void cargar()
    const id = setInterval(() => void cargar(), REFRESCO_HISTORICO_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [claveHistorico, desde])

  return { recs, livePrices, primas, closes, cargando, error, actualizado, refrescar }
}
