'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import {
  Loader2, Play, Square, RotateCcw,
  TrendingUp, Brain, CheckCircle2, ArrowRight,
  RefreshCw, Activity, Filter, Layers,
} from 'lucide-react'
import { settleExpiredPicks } from '@/lib/options/settle-picks'
import FichaTecnicaAgente from './FichaTecnicaAgente'
import SoloLectura from './SoloLectura'
import { FICHA_GAMMA } from './fichas/gamma'

type Phase = 'idle' | 'running' | 'done' | 'error'

interface TickerStage {
  ticker: string
  optionType?: 'CALL' | 'PUT'
  forecastReturn?: number
  step1: 'pass'
  strike?: number
  expiration?: string
  premium?: number
  /** Precio del subyacente al analizar la cadena. */
  underlyingPrice?: number
  delta?: number
  theta?: number
  iv?: number
  contractScore?: number
  dte?: number
  conviction?: number
  aiResult?: Record<string, unknown>
  step2: 'pending' | 'pass' | 'fail'
  step3: 'pending' | 'pass' | 'fail'
  step4: 'pending' | 'pass' | 'fail'
  step5: 'pending' | 'pass' | 'fail' | 'running'
  step6: 'pending' | 'done' | 'fail'
}

type OptionsContract = {
  strike: number
  expiration: string
  lastPrice: number | null
  mid: number | null
  delta: number | null
  theta: number | null
  gamma: number | null
  vega: number | null
  impliedVolatility: number | null
  volume: number | null
  openInterest: number | null
}

type OptionsStrategyPick = {
  score: number
  contract: OptionsContract
  breakeven: number
}

type OptionsAnalyzeResult = {
  strategies: Record<string, OptionsStrategyPick[]>
  underlying: { underlyingPrice: number; ticker: string }
}

const FALLBACK_TICKERS = [
  'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN',
  'META', 'GOOGL', 'AMD', 'NFLX', 'COIN',
  'PLTR', 'SOFI', 'UBER', 'ROKU', 'SNAP',
]

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function calcDTE(expiration: string): number {
  const exp = new Date(expiration)
  const now = new Date()
  return Math.max(0, Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
}

function StepBadge({ phase }: { phase: Phase }) {
  if (phase === 'idle')    return <span style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-subtle)' }} className="text-[9px] font-mono px-1.5 py-0.5 rounded">EN ESPERA</span>
  if (phase === 'running') return <span style={{ color: 'var(--color-warning)', border: '1px solid rgba(245, 165, 36,0.4)', background: 'rgba(245, 165, 36,0.1)' }} className="text-[9px] font-mono px-1.5 py-0.5 rounded animate-pulse">● EJECUTANDO</span>
  if (phase === 'done')    return <span style={{ color: 'var(--color-positive)', border: '1px solid rgba(16, 185, 129,0.4)', background: 'rgba(16, 185, 129,0.1)' }} className="text-[9px] font-mono px-1.5 py-0.5 rounded">✓ COMPLETADO</span>
  return                          <span style={{ color: 'var(--color-negative)', border: '1px solid rgba(240, 68, 56,0.4)', background: 'rgba(240, 68, 56,0.1)' }} className="text-[9px] font-mono px-1.5 py-0.5 rounded">✗ ERROR</span>
}

function TickerCard({ t }: { t: TickerStage }) {
  const stepColors = {
    pass:    { color: 'var(--color-positive)', border: 'rgba(16, 185, 129,0.4)',  bg: 'rgba(16, 185, 129,0.08)' },
    fail:    { color: 'var(--color-negative)', border: 'rgba(240, 68, 56,0.4)', bg: 'rgba(240, 68, 56,0.08)' },
    running: { color: 'var(--color-warning)', border: 'rgba(245, 165, 36,0.4)',  bg: 'rgba(245, 165, 36,0.08)' },
    pending: { color: 'var(--color-text-muted)', border: 'var(--color-border-subtle)',               bg: 'transparent' },
  }
  const typeColor = t.optionType === 'CALL' ? 'var(--color-positive)' : t.optionType === 'PUT' ? 'var(--color-negative)' : 'var(--color-text-secondary)'

  return (
    <div className="rounded-xl p-3 space-y-2" style={{ border: '1px solid var(--color-border-subtle)', background: 'var(--color-surface)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>{t.ticker}</span>
          {t.optionType && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: typeColor, border: `1px solid ${typeColor}40`, background: `${typeColor}10` }}>
              {t.optionType}
            </span>
          )}
        </div>
        {t.step6 === 'done' && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.08)' }}>
            📝 PICK
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {t.step2 !== 'pending' && (() => {
          const s = stepColors[t.step2 === 'pass' ? 'pass' : 'fail']
          return (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ color: s.color, border: `1px solid ${s.border}`, background: s.bg }}>
              {t.forecastReturn != null ? `${t.forecastReturn >= 0 ? '+' : ''}${t.forecastReturn.toFixed(1)}%` : 'SKIP'}
            </span>
          )
        })()}
        {t.step3 !== 'pending' && (() => {
          const s = stepColors[t.step3 === 'pass' ? 'pass' : 'fail']
          return (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ color: s.color, border: `1px solid ${s.border}`, background: s.bg }}>
              {t.strike != null ? `$${t.strike} · ${t.dte}d` : 'NO DATA'}
            </span>
          )
        })()}
        {t.step4 !== 'pending' && (() => {
          const s = stepColors[t.step4 === 'pass' ? 'pass' : 'fail']
          return (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ color: s.color, border: `1px solid ${s.border}`, background: s.bg }}>
              {t.delta != null ? `Δ${t.delta.toFixed(2)}·IV${((t.iv ?? 0) * 100).toFixed(0)}%` : 'FILTRO'}
            </span>
          )
        })()}
        {t.step5 !== 'pending' && (() => {
          const key = t.step5 === 'running' ? 'running' : t.step5 === 'pass' ? 'pass' : 'fail'
          const s = stepColors[key]
          return (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ color: s.color, border: `1px solid ${s.border}`, background: s.bg }}>
              {t.step5 === 'running' ? 'IA⟳' : t.step5 === 'pass' ? `IA ${t.conviction ?? '?'}/10` : 'IA✗'}
            </span>
          )
        })()}
      </div>
    </div>
  )
}

export default function AgenteGamma({ puedeEjecutar = false }: { puedeEjecutar?: boolean }
) {
  const [phase, setPhase]           = useState<Phase>('idle')
  const [step0Phase, setStep0Phase] = useState<Phase>('idle')
  const [step1Phase, setStep1Phase] = useState<Phase>('idle')
  const [step2Phase, setStep2Phase] = useState<Phase>('idle')
  const [step3Phase, setStep3Phase] = useState<Phase>('idle')
  const [step4Phase, setStep4Phase] = useState<Phase>('idle')
  const [step5Phase, setStep5Phase] = useState<Phase>('idle')
  const [step6Phase, setStep6Phase] = useState<Phase>('idle')
  const [tickers, setTickers]       = useState<TickerStage[]>([])
  const [log, setLog]               = useState<string[]>([])
  const [summary, setSummary]       = useState<{ created: number; total: number } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const logRef   = useRef<HTMLDivElement>(null)

  function addLog(msg: string) {
    setLog(prev => [...prev, msg])
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, 50)
  }

  function reset() {
    setPhase('idle')
    setStep0Phase('idle'); setStep1Phase('idle'); setStep2Phase('idle'); setStep3Phase('idle')
    setStep4Phase('idle'); setStep5Phase('idle'); setStep6Phase('idle')
    setTickers([]); setLog([]); setSummary(null)
  }

  function stop() {
    abortRef.current?.abort()
    addLog('⛔ Agente detenido por el usuario')
    setPhase('idle')
    setStep0Phase('idle'); setStep1Phase('idle'); setStep2Phase('idle'); setStep3Phase('idle')
    setStep4Phase('idle'); setStep5Phase('idle'); setStep6Phase('idle')
  }

  async function run() {
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    setPhase('running'); setLog([]); setTickers([]); setSummary(null)

    try {
      // ── PASO 0: Re-evaluación de opciones Gamma activas ───────────
      setStep0Phase('running')
      addLog('🔄 Re-evaluando opciones activas OPTIONS_GAMMA...')
      const gammaPicksRes = await fetch('/api/agentes/picks?category=OPTIONS_GAMMA', { signal })
      const gammaPicks = gammaPicksRes.ok
        ? await gammaPicksRes.json() as Array<{ id: string; ticker: string; estado: string; precio_entrada: number; ai_report?: Record<string, unknown> }>
        : []
      const activeGamma = gammaPicks.filter(p => p.estado !== 'Vender')

      if (!activeGamma.length) {
        addLog('✓ Sin opciones Gamma activas para re-evaluar')
      } else {
        addLog(`📋 ${activeGamma.length} opción(es) Gamma activa(s)`)
        // Gamma no cierra por niveles: mantiene hasta el vencimiento. Comprar
        // opciones ya tiene la pérdida acotada a la prima pagada, así que el
        // stop no protegía de nada y sí cortaba posiciones que se recuperaban.
        // Lo que sigue vivo es la liquidación de vencidos, justo debajo.
        addLog('✓ Sin revisión de niveles: Gamma mantiene hasta el vencimiento')
      }
      if (signal.aborted) { setPhase('idle'); return }

      // Liquidación de contratos vencidos con el cierre real del subyacente en
      // la fecha de expiración. Incluye las posiciones que se cerraron con el
      // −100% cableado que asumía siempre pérdida total.
      await settleExpiredPicks(gammaPicks, signal, addLog)
      setStep0Phase('done')
      if (signal.aborted) { setPhase('idle'); return }

      // ── PASO 1: Cargar candidatos ──────────────────────────────────
      setStep1Phase('running')
      addLog('📋 Cargando picks activos de Agente Peter y Agente Small...')
      const [peterRes, smallRes] = await Promise.all([
        fetch('/api/agentes/picks?category=PETER_LYNCH', { signal }),
        fetch('/api/agentes/picks?category=SMALL_CAPS', { signal }),
      ])
      const peterPicks = peterRes.ok ? await peterRes.json() as Array<{ ticker: string; estado: string }> : []
      const smallPicks = smallRes.ok ? await smallRes.json() as Array<{ ticker: string; estado: string }> : []
      const allActive = [
        ...peterPicks.filter(p => p.estado !== 'Vender'),
        ...smallPicks.filter(p => p.estado !== 'Vender'),
      ]
      const seen = new Set<string>()
      const deduped = allActive.filter(p => { if (seen.has(p.ticker)) return false; seen.add(p.ticker); return true })
      let candidateTickers = deduped.map(p => p.ticker)

      if (!candidateTickers.length) {
        addLog('⚠ Sin picks activos — usando lista fallback de 15 large-caps líquidas')
        candidateTickers = [...FALLBACK_TICKERS]
      } else {
        addLog(`✓ ${candidateTickers.length} candidatos: ${candidateTickers.join(', ')}`)
      }

      const initial: TickerStage[] = candidateTickers.map(ticker => ({
        ticker, step1: 'pass', step2: 'pending', step3: 'pending', step4: 'pending', step5: 'pending', step6: 'pending',
      }))
      setTickers([...initial])
      setStep1Phase('done')
      if (signal.aborted) { setPhase('idle'); return }

      // ── PASO 2: Proyección 30d (regresión lineal + EWMA) ─────────
      setStep2Phase('running')
      addLog(`📊 Proyección 30d: estimando precio para ${candidateTickers.length} ticker(s)...`)
      const forecastRes = await fetch(
        `/api/agentes/forecast?tickers=${candidateTickers.join(',')}`, { signal }
      )
      const forecastData = forecastRes.ok
        ? await forecastRes.json() as Record<string, { lastPrice: number; forecastReturn: number; pass: boolean }>
        : {}

      const paso2: TickerStage[] = initial.map(t => {
        const fd = forecastData[t.ticker]
        if (!fd) {
          addLog(`⚠ ${t.ticker}: sin datos forecast → SKIP`)
          return { ...t, step2: 'fail' }
        }
        const fr = fd.forecastReturn
        let optionType: 'CALL' | 'PUT' | undefined
        if (fr >= 2) optionType = 'CALL'
        else if (fr <= -3) optionType = 'PUT'

        const pass = optionType != null
        const dir = pass
          ? `${optionType} (${fr >= 0 ? '+' : ''}${fr.toFixed(1)}%)`
          : `SKIP (${fr >= 0 ? '+' : ''}${fr.toFixed(1)}% — señal débil)`
        addLog(`${pass ? '✓' : '✗'} ${t.ticker}: forecast ${dir}`)
        return { ...t, step2: pass ? 'pass' : 'fail', forecastReturn: fr, optionType }
      })
      setTickers([...paso2])
      setStep2Phase('done')
      if (signal.aborted) { setPhase('idle'); return }

      const paso2Pass = paso2.filter(t => t.step2 === 'pass')
      if (!paso2Pass.length) {
        addLog('⚠ Ningún ticker con señal direccional clara (CALL ≥+2% o PUT ≤-3%).')
        setStep3Phase('done'); setStep4Phase('done'); setStep5Phase('done'); setStep6Phase('done')
        setPhase('done'); setSummary({ created: 0, total: candidateTickers.length }); return
      }

      // ── PASO 3: Cadena de opciones ────────────────────────────────
      setStep3Phase('running')
      addLog(`🔗 Analizando cadena de opciones para ${paso2Pass.length} ticker(s)...`)
      const paso3: TickerStage[] = [...paso2]

      for (const t of paso2Pass) {
        if (signal.aborted) break
        const idx = paso3.findIndex(x => x.ticker === t.ticker)
        try {
          const oRes = await fetch(`/api/options/analyze?ticker=${t.ticker}`, { signal })
          if (!oRes.ok) {
            addLog(`⚠ ${t.ticker}: error HTTP ${oRes.status} en cadena de opciones`)
            if (idx !== -1) paso3[idx] = { ...paso3[idx], step3: 'fail' }
            continue
          }
          const oData = await oRes.json() as OptionsAnalyzeResult
          const stratKey = t.optionType === 'CALL' ? 'buy-call' : 'buy-put'
          const best = oData.strategies[stratKey]?.[0]
          if (!best) {
            addLog(`⚠ ${t.ticker}: sin contratos ${t.optionType} disponibles`)
            if (idx !== -1) paso3[idx] = { ...paso3[idx], step3: 'fail' }
            continue
          }
          const c = best.contract
          // La prima es el precio de entrada de esta posición: si el mercado no
          // publica ni horquilla ni cruce reciente, se descarta el contrato en
          // vez de guardarlo con prima 0. Una entrada inventada falsearía el
          // rendimiento durante toda la vida de la posición, y con prima 0 la
          // rentabilidad al liquidar ni siquiera se puede calcular.
          const premium = c.mid ?? c.lastPrice ?? null
          if (premium == null || premium <= 0) {
            addLog(`✗ ${t.ticker}: contrato sin prima fiable (sin horquilla ni cruce) — descartado`)
            if (idx !== -1) paso3[idx] = { ...paso3[idx], step3: 'fail' }
            continue
          }
          const dte = calcDTE(c.expiration)
          addLog(`✓ ${t.ticker}: ${t.optionType} $${c.strike} exp ${c.expiration} · prima $${premium.toFixed(2)} · score ${best.score}`)
          if (idx !== -1) {
            paso3[idx] = {
              ...paso3[idx], step3: 'pass',
              strike: c.strike, expiration: c.expiration, premium,
              underlyingPrice: oData.underlying?.underlyingPrice,
              delta: c.delta ?? undefined, theta: c.theta ?? undefined,
              iv: c.impliedVolatility ?? undefined,
              contractScore: best.score, dte,
            }
          }
        } catch (e) {
          if (signal.aborted) break
          addLog(`⚠ ${t.ticker}: ${(e as Error).message}`)
          if (idx !== -1) paso3[idx] = { ...paso3[idx], step3: 'fail' }
        }
        setTickers([...paso3])
        await sleep(400)
      }
      setStep3Phase('done')
      if (signal.aborted) { setPhase('idle'); return }

      // ── PASO 4: Filtro de calidad del contrato ────────────────────
      setStep4Phase('running')
      addLog('🔍 Aplicando filtros de calidad del contrato...')
      const paso4: TickerStage[] = paso3.map(t => {
        if (t.step3 !== 'pass') return t
        const delta = Math.abs(t.delta ?? 0)
        const dte = t.dte ?? 0
        const score = t.contractScore ?? 0
        const deltaOk = delta >= 0.30 && delta <= 0.65
        const dteOk   = dte >= 21 && dte <= 90
        const scoreOk = score >= 50
        const pass = deltaOk && dteOk && scoreOk
        const fails = [
          !deltaOk && `Δ${delta.toFixed(2)} ∉ [0.30-0.65]`,
          !dteOk   && `DTE=${dte} ∉ [21-90]`,
          !scoreOk && `score=${score}<50`,
        ].filter(Boolean).join(', ')
        addLog(`${pass ? '✓' : '✗'} ${t.ticker}: Δ${delta.toFixed(2)} · DTE${dte} · IV${((t.iv ?? 0) * 100).toFixed(0)}% · score${score}${!pass ? ` → ${fails}` : ''}`)
        return { ...t, step4: pass ? 'pass' : 'fail' }
      })
      setTickers([...paso4])
      setStep4Phase('done')
      if (signal.aborted) { setPhase('idle'); return }

      const paso4Pass = paso4.filter(t => t.step4 === 'pass')
      if (!paso4Pass.length) {
        addLog('⚠ Ningún contrato superó el filtro de calidad.')
        setStep5Phase('done'); setStep6Phase('done')
        setPhase('done'); setSummary({ created: 0, total: candidateTickers.length }); return
      }

      // ── PASO 5: Confirmación IA ───────────────────────────────────
      setStep5Phase('running')
      addLog(`🤖 Revisión por IA: confirmando ${paso4Pass.length} contrato(s)...`)
      const paso5: TickerStage[] = [...paso4]
      const analyzed: TickerStage[] = []

      for (const t of paso4Pass) {
        if (signal.aborted) break
        const idx = paso5.findIndex(x => x.ticker === t.ticker)
        if (idx !== -1) paso5[idx] = { ...paso5[idx], step5: 'running' }
        setTickers([...paso5])
        addLog(`⟳ ${t.ticker}: analizando opción ${t.optionType} $${t.strike}...`)

        try {
          const aRes = await fetch('/api/agentes/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticker: t.ticker,
              // El precio del SUBYACENTE, no la prima: pasar la prima aquí hacía
              // que el modelo valorase un activo de $3 cuando la acción cotiza
              // a $180, y todo su análisis partía de esa cifra falsa.
              lastPrice: t.underlyingPrice ?? 0,
              category: 'OPTIONS_GAMMA',
              forecastReturn: t.forecastReturn,
              optionType: t.optionType,
              strike: t.strike,
              expiration: t.expiration,
              premium: t.premium,
              delta: t.delta,
              impliedVolatility: t.iv,
              dte: t.dte,
            }),
            signal,
          })
          if (!aRes.ok) throw new Error(`IA HTTP ${aRes.status}`)
          const result = await aRes.json() as Record<string, unknown>
          const conviction = (result.conviction as number) ?? 5
          const pass = conviction >= 7

          addLog(`${pass ? '✓' : '✗'} ${t.ticker}: conviction ${conviction}/10${!pass ? ' → insuficiente (<7)' : ''}`)
          if (idx !== -1) paso5[idx] = { ...paso5[idx], step5: pass ? 'pass' : 'fail', conviction, aiResult: result }
          if (pass) analyzed.push({ ...paso5[idx] })
        } catch (e) {
          if (signal.aborted) break
          addLog(`⚠ ${t.ticker}: error IA — ${(e as Error).message}`)
          if (idx !== -1) paso5[idx] = { ...paso5[idx], step5: 'fail' }
        }
        setTickers([...paso5])
        await sleep(600)
      }
      setStep5Phase('done')
      if (signal.aborted) { setPhase('idle'); return }

      // ── PASO 6: Guardar picks ─────────────────────────────────────
      setStep6Phase('running')
      addLog(`📝 Guardando ${analyzed.length} opción(es) confirmadas...`)
      const paso6: TickerStage[] = [...paso5]
      let created = 0

      for (const t of analyzed) {
        if (signal.aborted) break
        const ai = t.aiResult ?? {}
        const premium = t.premium ?? 0

        try {
          const sRes = await fetch('/api/agentes/picks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticker: t.ticker,
              empresa: (ai.empresa as string) ?? t.ticker,
              category: 'OPTIONS_GAMMA',
              precio_entrada: parseFloat(premium.toFixed(4)),
              // Sin objetivo ni stop: Gamma mantiene hasta el vencimiento.
              // Guardar cifras que ningún proceso lee invita a creer que hay una
              // protección que no existe, que es el error que ya se cometió una
              // vez en este agente.
              precio_objetivo: null,
              stop_loss: null,
              direction: t.optionType === 'CALL' ? 'COMPRA' : 'VENTA',
              riesgo: (ai.riesgo as string) ?? 'MEDIO',
              timeframe: `${t.dte ?? '?'}d`,
              resumen: (ai.resumen as string) ?? `${t.optionType} ${t.ticker} $${t.strike} exp ${t.expiration}`,
              score: t.contractScore,
              ai_report: {
                strike: t.strike,
                expiration: t.expiration,
                delta: t.delta,
                theta: t.theta,
                iv: t.iv,
                dte: t.dte,
                breakeven: t.optionType === 'CALL'
                  ? (t.strike ?? 0) + premium
                  : (t.strike ?? 0) - premium,
                optionType: t.optionType,
                forecastReturn: t.forecastReturn,
                conviction: t.conviction,
                underlying: t.ticker,
                // Distingue estas filas de las de Peter/Small y deja constancia
                // de que la ausencia de niveles es deliberada, no un fallo al
                // guardarlos.
                nivelesFuente: 'sin-niveles',
                side: 'long',
              },
            }),
            signal,
          })
          if (!sRes.ok) throw new Error(`Picks HTTP ${sRes.status}`)
          const sData = await sRes.json() as { skipped?: boolean }
          if (sData.skipped) {
            addLog(`↩ ${t.ticker}: posición activa — omitido`)
          } else {
            addLog(`✓ ${t.ticker}: ${t.optionType} $${t.strike} guardado (conviction ${t.conviction}/10)`)
            const idx = paso6.findIndex(x => x.ticker === t.ticker)
            if (idx !== -1) paso6[idx] = { ...paso6[idx], step6: 'done' }
            created++
          }
        } catch (e) {
          if (signal.aborted) break
          addLog(`⚠ ${t.ticker}: error guardando — ${(e as Error).message}`)
          const idx = paso6.findIndex(x => x.ticker === t.ticker)
          if (idx !== -1) paso6[idx] = { ...paso6[idx], step6: 'fail' }
        }
        setTickers([...paso6])
      }

      setStep6Phase('done')
      setSummary({ created, total: candidateTickers.length })
      addLog(`✅ AGENTE GAMMA finalizado. ${created} opción(es) de ${candidateTickers.length} candidatos.`)
      setPhase('done')
    } catch (e) {
      if ((e as Error).name === 'AbortError') { setPhase('idle'); return }
      addLog(`✗ Error fatal: ${(e as Error).message}`)
      setPhase('error')
    }
  }

  const steps = [
    { label: 'RE-EVALUACIÓN',   desc: 'Auto-sell opciones expiradas',          phase: step0Phase, icon: RefreshCw },
    { label: 'CANDIDATOS',      desc: 'Picks Peter + Small + fallback',         phase: step1Phase, icon: Layers },
    { label: 'PROYECCIÓN 30d',  desc: 'Alcista=CALL ≥+2% · Bajista=PUT ≤-3%', phase: step2Phase, icon: TrendingUp },
    { label: 'CADENA OPCIONES', desc: 'Mejor buy-call o buy-put por score',     phase: step3Phase, icon: Activity },
    { label: 'CALIDAD',         desc: 'Δ 0.30-0.65 · DTE 21-75 · score ≥50',  phase: step4Phase, icon: Filter },
    { label: 'CONFIRMACIÓN IA', desc: 'Convicción del modelo ≥7',               phase: step5Phase, icon: Brain },
    { label: 'PICKS & INFORME', desc: 'Sin duplicados, solo aprobados',         phase: step6Phase, icon: CheckCircle2 },
  ]

  const funnelStages = [
    { label: 'Candidatos', count: tickers.length,                                color: 'var(--color-warning)' },
    { label: 'Forecast',   count: tickers.filter(t => t.step2 === 'pass').length, color: '#8b8ff0' },
    { label: 'Cadena',     count: tickers.filter(t => t.step3 === 'pass').length, color: '#38bdf8' },
    { label: 'Calidad',    count: tickers.filter(t => t.step4 === 'pass').length, color: '#e0a458' },
    { label: 'IA',         count: tickers.filter(t => t.step5 === 'pass').length, color: '#c4b5fd' },
    { label: 'Picks',      count: tickers.filter(t => t.step6 === 'done').length, color: 'var(--color-positive)' },
  ]
  const maxFunnel = funnelStages[0]?.count ?? 1

  return (
    <div className="space-y-4">
      {/* Ficha técnica — cómo funciona el agente y qué respaldo tiene */}
      <FichaTecnicaAgente ficha={FICHA_GAMMA} />

      {/* Step cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {steps.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="rounded-xl border border-border-subtle bg-surface p-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-0.5 h-full" style={{
                background: s.phase === 'done' ? '#8b8ff0' : s.phase === 'running' ? 'var(--color-warning)' : s.phase === 'error' ? 'var(--color-negative)' : 'var(--color-border-subtle)'
              }} />
              <div className="mb-2 flex items-center justify-between gap-1 pl-2">
                <span className="text-[9px] font-bold font-mono text-text-muted">{String(i + 1).padStart(2, '0')}</span>
                <StepBadge phase={s.phase} />
              </div>
              <div className="pl-2 flex items-start gap-1.5">
                <Icon size={12} style={{ color: s.phase === 'done' ? '#8b8ff0' : s.phase === 'running' ? 'var(--color-warning)' : 'var(--color-text-muted)' }} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold font-mono text-text-primary leading-tight">{s.label}</p>
                  <p className="mt-0.5 text-[9px] text-text-muted leading-tight">{s.desc}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Funnel */}
      {tickers.length > 0 && (
        <div className="rounded-xl border border-border-subtle bg-surface p-4">
          <p className="text-[9px] font-mono text-text-muted mb-3">EMBUDO DE SELECCIÓN — OPCIONES DIRECCIONALES</p>
          <div className="flex items-end gap-1 h-12 px-1">
            {funnelStages.map((s, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] font-mono font-bold" style={{ color: s.color }}>{s.count}</span>
                <div className="w-full rounded-sm transition-all duration-500" style={{ height: `${Math.max(4, (s.count / maxFunnel) * 32)}px`, background: s.color, opacity: 0.7 }} />
                <span className="text-[8px] font-mono text-text-muted text-center leading-tight">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      {!puedeEjecutar ? (
        <SoloLectura agente="AGENTE GAMMA" />
      ) : (
      <div className="flex flex-wrap items-center gap-2">
        {phase === 'idle' || phase === 'done' || phase === 'error' ? (
          <button
            onClick={() => void run()}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all hover:brightness-90 active:scale-[0.98]"
            style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
          >
            <Play size={13} />
            {phase === 'done' || phase === 'error' ? 'Ejecutar de nuevo' : 'Ejecutar AGENTE GAMMA'}
          </button>
        ) : (
          <button
            onClick={stop}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all"
            style={{ background: 'rgba(240, 68, 56,0.15)', color: 'var(--color-negative)', border: '1px solid rgba(240, 68, 56,0.3)' }}
          >
            <Square size={13} />
            Detener
          </button>
        )}
        {(phase === 'done' || phase === 'error') && (
          <button onClick={reset} className="flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-xs text-text-secondary hover:text-text-primary transition-colors">
            <RotateCcw size={13} />
            Reiniciar
          </button>
        )}
        {phase === 'running' && (
          <span className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Loader2 size={12} className="animate-spin" />
            Procesando… (opciones pueden tardar 30-60s por ticker)
          </span>
        )}
      </div>
      )}

      {/* Summary */}
      {summary && summary.created > 0 && (() => {
        const approved = tickers.filter(t => t.step6 === 'done')
        return (
          <div className="rounded-xl border p-4 space-y-3" style={{ background: 'rgba(139, 143, 240,0.06)', border: '1px solid rgba(139, 143, 240,0.25)' }}>
            <p className="text-xs font-bold font-mono" style={{ color: '#8b8ff0' }}>
              ✅ {summary.created} opción(es) aprobaron los 5 filtros
            </p>
            <div className="space-y-1.5">
              {approved.map(t => {
                const typeColor = t.optionType === 'CALL' ? 'var(--color-positive)' : 'var(--color-negative)'
                return (
                  <div key={t.ticker} className="flex items-center gap-3 py-1.5 px-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span className="font-mono font-bold text-sm w-14 shrink-0" style={{ color: 'var(--color-text-primary)' }}>{t.ticker}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0" style={{ color: typeColor, border: `1px solid ${typeColor}40`, background: `${typeColor}10` }}>{t.optionType}</span>
                    <span className="text-xs text-text-secondary flex-1">${t.strike} · {t.dte}d · Δ{t.delta?.toFixed(2)}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0" style={{ color: '#8b8ff0', border: '1px solid rgba(139, 143, 240,0.3)', background: 'rgba(139, 143, 240,0.08)' }}>
                      {t.conviction}/10
                    </span>
                  </div>
                )
              })}
            </div>
            <Link href="/recomendaciones"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all hover:brightness-90"
              style={{ background: 'rgba(139, 143, 240,0.15)', color: '#8b8ff0', border: '1px solid rgba(139, 143, 240,0.3)' }}
            >
              <ArrowRight size={13} />
              Ver en RECOMENDACIONES
            </Link>
          </div>
        )
      })()}
      {summary && summary.created === 0 && (
        <div className="rounded-xl border p-4 text-sm font-medium" style={{ background: 'rgba(245, 165, 36,0.08)', border: '1px solid rgba(245, 165, 36,0.25)', color: 'var(--color-warning)' }}>
          ⚠ Ninguna opción aprobó los filtros de {summary.total} candidatos
        </div>
      )}

      {/* Ticker cards */}
      {tickers.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {tickers.map(t => <TickerCard key={t.ticker} t={t} />)}
        </div>
      )}

      {/* Log console */}
      {log.length > 0 && (
        <div ref={logRef} className="rounded-xl border border-border-subtle bg-background p-4 font-mono text-[11px] overflow-y-auto" style={{ maxHeight: '300px' }}>
          {log.map((line, i) => (
            <div key={i} className="py-0.5 leading-relaxed" style={{
              color: line.startsWith('✓') ? 'var(--color-positive)'
                : line.startsWith('✗') || line.startsWith('⛔') ? 'var(--color-negative)'
                : line.startsWith('⚠') ? 'var(--color-warning)'
                : line.startsWith('⟳') ? '#8b8ff0'
                : 'var(--color-text-secondary)'
            }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
