'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import {
  Loader2, Play, Square, RotateCcw,
  TrendingDown, Brain, CheckCircle2, ArrowRight,
  RefreshCw, BarChart2, Filter, Layers,
} from 'lucide-react'
import { settleExpiredPicks } from '@/lib/options/settle-picks'
import FichaTecnicaAgente from './FichaTecnicaAgente'
import { FICHA_THETA } from './fichas/theta'

type Phase = 'idle' | 'running' | 'done' | 'error'

interface TickerStage {
  ticker: string
  strategy?: 'SELL_PUT' | 'COVERED_CALL'
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

const THETA_UNIVERSE = [
  'SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL', 'AMD',
  'NFLX', 'COIN', 'PLTR', 'SOFI', 'F', 'BAC', 'JPM', 'WFC', 'XOM', 'CVX',
  'GLD', 'SLV', 'TLT', 'XLE', 'XLF', 'XLK', 'ARKK',
  'ROKU', 'SNAP', 'UBER', 'DASH', 'HOOD', 'RIVN', 'LCID', 'MSTR', 'IONQ',
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
  const stratColor = t.strategy === 'SELL_PUT' ? '#e0a458' : t.strategy === 'COVERED_CALL' ? '#38bdf8' : 'var(--color-text-secondary)'

  return (
    <div className="rounded-xl p-3 space-y-2" style={{ border: '1px solid var(--color-border-subtle)', background: 'var(--color-surface)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>{t.ticker}</span>
          {t.strategy && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: stratColor, border: `1px solid ${stratColor}40`, background: `${stratColor}10` }}>
              {t.strategy === 'SELL_PUT' ? 'SP' : 'CC'}
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
              {t.iv != null ? `IV${((t.iv) * 100).toFixed(0)}%·Δ${(t.delta ?? 0).toFixed(2)}` : 'FILTRO'}
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

export default function AgenteTheta() {
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
      // ── PASO 0: Re-evaluación de opciones Theta activas ───────────
      setStep0Phase('running')
      addLog('🔄 Re-evaluando opciones activas OPTIONS_THETA...')
      const thetaPicksRes = await fetch('/api/agentes/picks?category=OPTIONS_THETA', { signal })
      const thetaPicks = thetaPicksRes.ok
        ? await thetaPicksRes.json() as Array<{ id: string; ticker: string; estado: string; precio_entrada: number; ai_report?: Record<string, unknown> }>
        : []
      const activeTheta = thetaPicks.filter(p => p.estado !== 'Vender')

      if (!activeTheta.length) {
        addLog('✓ Sin opciones Theta activas para re-evaluar')
      } else {
        addLog(`📋 ${activeTheta.length} opción(es) Theta activa(s)`)
        for (const pick of activeTheta) {
          const report = pick.ai_report ?? {}
          const expStr = (report.expiration ?? '') as string
          const dte = expStr ? calcDTE(expStr) : -1
          if (dte > 0) {
            addLog(`✓ ${pick.ticker}: DTE=${dte}d · prima cobrada $${pick.precio_entrada?.toFixed(2) ?? '?'} — vigente`)
          }
        }
      }

      // Liquidación de contratos vencidos con el cierre real del subyacente.
      // Un put vendido que vence ITM es pérdida, no la prima íntegra que
      // asumía el cálculo anterior.
      await settleExpiredPicks(thetaPicks, signal, addLog)
      setStep0Phase('done')
      if (signal.aborted) { setPhase('idle'); return }

      // ── PASO 1: Preparar universo Theta ───────────────────────────
      setStep1Phase('running')
      addLog(`📋 Preparando universo Theta: ${THETA_UNIVERSE.length} acciones opcionales líquidas`)
      const initial: TickerStage[] = THETA_UNIVERSE.map(ticker => ({
        ticker, step1: 'pass', step2: 'pending', step3: 'pending', step4: 'pending', step5: 'pending', step6: 'pending',
      }))
      setTickers([...initial])
      addLog(`✓ Universo listo: ${THETA_UNIVERSE.join(', ')}`)
      setStep1Phase('done')
      if (signal.aborted) { setPhase('idle'); return }

      // ── PASO 2: Proyección 30d — filtro de seguridad ─────────────
      setStep2Phase('running')
      addLog(`📊 Proyección 30d: evaluando seguridad de primas en ${THETA_UNIVERSE.length} tickers...`)

      const BATCH_SIZE = 8
      const forecastMap: Record<string, number> = {}

      for (let i = 0; i < THETA_UNIVERSE.length; i += BATCH_SIZE) {
        if (signal.aborted) break
        const batch = THETA_UNIVERSE.slice(i, i + BATCH_SIZE)
        try {
          const fRes = await fetch(`/api/agentes/forecast?tickers=${batch.join(',')}`, { signal })
          if (fRes.ok) {
            const fData = await fRes.json() as Record<string, { forecastReturn: number; pass: boolean }>
            for (const [tk, fd] of Object.entries(fData)) {
              forecastMap[tk] = fd.forecastReturn
            }
          }
        } catch { /* skip batch */ }
        if (i + BATCH_SIZE < THETA_UNIVERSE.length) await sleep(500)
      }

      const paso2: TickerStage[] = initial.map(t => {
        const fr = forecastMap[t.ticker]
        if (fr == null) {
          addLog(`⚠ ${t.ticker}: sin datos forecast → SKIP`)
          return { ...t, step2: 'fail' }
        }
        // Sell-put seguro si forecastReturn >= -5% (no caída brusca)
        // Covered-call seguro si forecastReturn <= +8% (no subida que queme el call)
        // Elegimos la estrategia viable:
        const sellPutOk = fr >= -5
        const covCallOk = fr <= 8
        const pass = sellPutOk || covCallOk
        const dir = fr >= 0 ? `+${fr.toFixed(1)}%` : `${fr.toFixed(1)}%`
        const strat = sellPutOk && covCallOk ? 'ambas' : sellPutOk ? 'sell-put' : covCallOk ? 'cov-call' : 'ninguna'
        addLog(`${pass ? '✓' : '✗'} ${t.ticker}: forecast ${dir} → ${strat}`)
        return { ...t, step2: pass ? 'pass' : 'fail', forecastReturn: fr }
      })
      setTickers([...paso2])
      setStep2Phase('done')
      if (signal.aborted) { setPhase('idle'); return }

      const paso2Pass = paso2.filter(t => t.step2 === 'pass')
      if (!paso2Pass.length) {
        addLog('⚠ Ningún ticker pasó el filtro de seguridad forecast.')
        setStep3Phase('done'); setStep4Phase('done'); setStep5Phase('done'); setStep6Phase('done')
        setPhase('done'); setSummary({ created: 0, total: THETA_UNIVERSE.length }); return
      }

      // ── PASO 3: Cadena de opciones — sell-put / covered-call ──────
      setStep3Phase('running')
      addLog(`🔗 Analizando cadena de opciones para ${paso2Pass.length} ticker(s)...`)
      const paso3: TickerStage[] = [...paso2]

      for (const t of paso2Pass) {
        if (signal.aborted) break
        const idx = paso3.findIndex(x => x.ticker === t.ticker)
        const fr = t.forecastReturn ?? 0

        try {
          const oRes = await fetch(`/api/options/analyze?ticker=${t.ticker}`, { signal })
          if (!oRes.ok) {
            addLog(`⚠ ${t.ticker}: error HTTP ${oRes.status}`)
            if (idx !== -1) paso3[idx] = { ...paso3[idx], step3: 'fail' }
            continue
          }
          const oData = await oRes.json() as OptionsAnalyzeResult

          // Pick best strategy based on forecast
          const sellPuts    = oData.strategies['sell-put'] ?? []
          const covCalls    = oData.strategies['covered-call'] ?? []
          const canSellPut  = fr >= -5 && sellPuts.length > 0
          const canCovCall  = fr <= 8 && covCalls.length > 0

          let best: OptionsStrategyPick | null = null
          let strategy: 'SELL_PUT' | 'COVERED_CALL' | undefined

          if (canSellPut && canCovCall) {
            // Pick whichever has higher score
            const sp = sellPuts[0]
            const cc = covCalls[0]
            if ((sp?.score ?? 0) >= (cc?.score ?? 0)) { best = sp; strategy = 'SELL_PUT' }
            else { best = cc; strategy = 'COVERED_CALL' }
          } else if (canSellPut) { best = sellPuts[0]; strategy = 'SELL_PUT' }
          else if (canCovCall)  { best = covCalls[0]; strategy = 'COVERED_CALL' }

          if (!best) {
            addLog(`⚠ ${t.ticker}: sin contratos de venta disponibles`)
            if (idx !== -1) paso3[idx] = { ...paso3[idx], step3: 'fail' }
            continue
          }

          const c = best.contract
          // La prima cobrada es el precio de entrada de esta posición: si el
          // mercado no publica ni horquilla ni cruce reciente, se descarta el
          // contrato en vez de guardarlo con prima 0. Con prima 0 la
          // rentabilidad al liquidar ni siquiera se puede calcular.
          const premium = c.mid ?? c.lastPrice ?? null
          if (premium == null || premium <= 0) {
            addLog(`✗ ${t.ticker}: contrato sin prima fiable (sin horquilla ni cruce) — descartado`)
            if (idx !== -1) paso3[idx] = { ...paso3[idx], step3: 'fail' }
            continue
          }
          const dte = calcDTE(c.expiration)
          addLog(`✓ ${t.ticker}: ${strategy} $${c.strike} exp ${c.expiration} · prima $${premium.toFixed(2)} · score ${best.score}`)
          if (idx !== -1) {
            paso3[idx] = {
              ...paso3[idx], step3: 'pass', strategy,
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

      // ── PASO 4: Filtro calidad premium ────────────────────────────
      setStep4Phase('running')
      addLog('🔍 Aplicando filtros de calidad de prima...')
      const paso4: TickerStage[] = paso3.map(t => {
        if (t.step3 !== 'pass') return t
        const iv    = t.iv ?? 0
        const delta = Math.abs(t.delta ?? 0)
        const dte   = t.dte ?? 0
        const score = t.contractScore ?? 0
        const ivOk    = iv > 0.30
        const dteOk   = dte >= 21 && dte <= 45
        const deltaOk = delta >= 0.15 && delta <= 0.35
        const scoreOk = score >= 60
        const pass = ivOk && dteOk && deltaOk && scoreOk
        const fails = [
          !ivOk    && `IV=${(iv * 100).toFixed(0)}%<30%`,
          !dteOk   && `DTE=${dte} ∉ [21-45]`,
          !deltaOk && `Δ${delta.toFixed(2)} ∉ [0.15-0.35]`,
          !scoreOk && `score=${score}<60`,
        ].filter(Boolean).join(', ')
        addLog(`${pass ? '✓' : '✗'} ${t.ticker}: IV${(iv * 100).toFixed(0)}% · DTE${dte} · Δ${delta.toFixed(2)} · score${score}${!pass ? ` → ${fails}` : ''}`)
        return { ...t, step4: pass ? 'pass' : 'fail' }
      })
      setTickers([...paso4])
      setStep4Phase('done')
      if (signal.aborted) { setPhase('idle'); return }

      const paso4Pass = paso4.filter(t => t.step4 === 'pass')
      if (!paso4Pass.length) {
        addLog('⚠ Ningún contrato superó el filtro de calidad de prima.')
        setStep5Phase('done'); setStep6Phase('done')
        setPhase('done'); setSummary({ created: 0, total: THETA_UNIVERSE.length }); return
      }

      // ── PASO 5: Confirmación IA ───────────────────────────────────
      setStep5Phase('running')
      addLog(`🤖 TradingAgents: confirmando ${paso4Pass.length} contrato(s) de venta de prima...`)
      const paso5: TickerStage[] = [...paso4]
      const analyzed: TickerStage[] = []

      for (const t of paso4Pass) {
        if (signal.aborted) break
        const idx = paso5.findIndex(x => x.ticker === t.ticker)
        if (idx !== -1) paso5[idx] = { ...paso5[idx], step5: 'running' }
        setTickers([...paso5])
        addLog(`⟳ ${t.ticker}: analizando ${t.strategy} $${t.strike}...`)

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
              category: 'OPTIONS_THETA',
              strategy: t.strategy,
              strike: t.strike,
              expiration: t.expiration,
              premium: t.premium,
              delta: t.delta,
              impliedVolatility: t.iv,
              dte: t.dte,
              forecastReturn: t.forecastReturn,
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
      addLog(`📝 Guardando ${analyzed.length} prima(s) confirmadas...`)
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
              category: 'OPTIONS_THETA',
              precio_entrada: parseFloat(premium.toFixed(4)),
              precio_objetivo: 0,
              stop_loss: parseFloat((premium * 2).toFixed(4)),
              direction: 'INCOME',
              riesgo: (ai.riesgo as string) ?? 'BAJO',
              timeframe: `${t.dte ?? '?'}d`,
              resumen: (ai.resumen as string) ?? `${t.strategy} ${t.ticker} $${t.strike} exp ${t.expiration}`,
              score: t.contractScore,
              ai_report: {
                strategy: t.strategy,
                strike: t.strike,
                expiration: t.expiration,
                delta: t.delta,
                theta: t.theta,
                iv: t.iv,
                dte: t.dte,
                breakeven: t.strategy === 'SELL_PUT'
                  ? (t.strike ?? 0) - premium
                  : (t.strike ?? 0) + premium,
                maxProfit: premium,
                maxLoss: t.strategy === 'SELL_PUT' ? (t.strike ?? 0) - premium : null,
                forecastReturn: t.forecastReturn,
                conviction: t.conviction,
              },
            }),
            signal,
          })
          if (!sRes.ok) throw new Error(`Picks HTTP ${sRes.status}`)
          const sData = await sRes.json() as { skipped?: boolean }
          if (sData.skipped) {
            addLog(`↩ ${t.ticker}: posición activa — omitido`)
          } else {
            addLog(`✓ ${t.ticker}: ${t.strategy} $${t.strike} · prima $${premium.toFixed(2)} guardada (conviction ${t.conviction}/10)`)
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
      setSummary({ created, total: THETA_UNIVERSE.length })
      addLog(`✅ AGENTE THETA finalizado. ${created} prima(s) de ${THETA_UNIVERSE.length} candidatos.`)
      setPhase('done')
    } catch (e) {
      if ((e as Error).name === 'AbortError') { setPhase('idle'); return }
      addLog(`✗ Error fatal: ${(e as Error).message}`)
      setPhase('error')
    }
  }

  const steps = [
    { label: 'RE-EVALUACIÓN',   desc: 'Auto-close solo al vencimiento',       phase: step0Phase, icon: RefreshCw },
    { label: 'UNIVERSO THETA',  desc: '~36 acciones opcionales líquidas',         phase: step1Phase, icon: Layers },
    { label: 'PROYECCIÓN 30d',  desc: 'Elige lado: put ≥-5% · call ≤+8%',            phase: step2Phase, icon: TrendingDown },
    { label: 'CADENA OPCIONES', desc: 'Sell-put / Covered-call mayor score',       phase: step3Phase, icon: BarChart2 },
    { label: 'CALIDAD PRIMA',   desc: 'IV>30% · DTE 21-45 · |Δ| .15-.35 · ≥60',     phase: step4Phase, icon: Filter },
    { label: 'CONFIRMACIÓN IA', desc: 'TradingAgents conviction ≥7',               phase: step5Phase, icon: Brain },
    { label: 'PICKS & INFORME', desc: 'Sin duplicados, crédito registrado',        phase: step6Phase, icon: CheckCircle2 },
  ]

  const funnelStages = [
    { label: 'Universo',  count: tickers.length,                                color: 'var(--color-warning)' },
    { label: 'Forecast',  count: tickers.filter(t => t.step2 === 'pass').length, color: '#38bdf8' },
    { label: 'Cadena',    count: tickers.filter(t => t.step3 === 'pass').length, color: '#e0a458' },
    { label: 'Calidad',   count: tickers.filter(t => t.step4 === 'pass').length, color: '#c4b5fd' },
    { label: 'IA',        count: tickers.filter(t => t.step5 === 'pass').length, color: '#8b8ff0' },
    { label: 'Picks',     count: tickers.filter(t => t.step6 === 'done').length, color: 'var(--color-positive)' },
  ]
  const maxFunnel = funnelStages[0]?.count ?? 1

  return (
    <div className="space-y-4">
      {/* Ficha técnica — cómo funciona el agente y qué respaldo tiene */}
      <FichaTecnicaAgente ficha={FICHA_THETA} />

      {/* Step cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {steps.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="rounded-xl border border-border-subtle bg-surface p-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-0.5 h-full" style={{
                background: s.phase === 'done' ? '#e0a458' : s.phase === 'running' ? 'var(--color-warning)' : s.phase === 'error' ? 'var(--color-negative)' : 'var(--color-border-subtle)'
              }} />
              <div className="mb-2 flex items-center justify-between gap-1 pl-2">
                <span className="text-[9px] font-bold font-mono text-text-muted">{String(i + 1).padStart(2, '0')}</span>
                <StepBadge phase={s.phase} />
              </div>
              <div className="pl-2 flex items-start gap-1.5">
                <Icon size={12} style={{ color: s.phase === 'done' ? '#e0a458' : s.phase === 'running' ? 'var(--color-warning)' : 'var(--color-text-muted)' }} className="mt-0.5 shrink-0" />
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
          <p className="text-[9px] font-mono text-text-muted mb-3">EMBUDO DE SELECCIÓN — VENTA DE PRIMAS</p>
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
      <div className="flex flex-wrap items-center gap-2">
        {phase === 'idle' || phase === 'done' || phase === 'error' ? (
          <button
            onClick={() => void run()}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all hover:brightness-90 active:scale-[0.98]"
            style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
          >
            <Play size={13} />
            {phase === 'done' || phase === 'error' ? 'Ejecutar de nuevo' : 'Ejecutar AGENTE THETA'}
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
            Procesando… (36 tickers, puede tardar 5-10 min)
          </span>
        )}
      </div>

      {/* Summary */}
      {summary && summary.created > 0 && (() => {
        const approved = tickers.filter(t => t.step6 === 'done')
        return (
          <div className="rounded-xl border p-4 space-y-3" style={{ background: 'rgba(224, 164, 88,0.06)', border: '1px solid rgba(224, 164, 88,0.25)' }}>
            <p className="text-xs font-bold font-mono" style={{ color: '#e0a458' }}>
              ✅ {summary.created} prima(s) aprobaron los 5 filtros
            </p>
            <div className="space-y-1.5">
              {approved.map(t => {
                const stratColor = t.strategy === 'SELL_PUT' ? '#e0a458' : '#38bdf8'
                return (
                  <div key={t.ticker} className="flex items-center gap-3 py-1.5 px-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span className="font-mono font-bold text-sm w-14 shrink-0" style={{ color: 'var(--color-text-primary)' }}>{t.ticker}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0" style={{ color: stratColor, border: `1px solid ${stratColor}40`, background: `${stratColor}10` }}>
                      {t.strategy === 'SELL_PUT' ? 'SELL-PUT' : 'COV-CALL'}
                    </span>
                    <span className="text-xs text-text-secondary flex-1">${t.strike} · {t.dte}d · IV{((t.iv ?? 0) * 100).toFixed(0)}%</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0" style={{ color: 'var(--color-positive)', border: '1px solid rgba(16, 185, 129,0.3)', background: 'rgba(16, 185, 129,0.08)' }}>
                      ${t.premium?.toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>
            <Link href="/recomendaciones"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all hover:brightness-90"
              style={{ background: 'rgba(224, 164, 88,0.15)', color: '#e0a458', border: '1px solid rgba(224, 164, 88,0.3)' }}
            >
              <ArrowRight size={13} />
              Ver en RECOMENDACIONES
            </Link>
          </div>
        )
      })()}
      {summary && summary.created === 0 && (
        <div className="rounded-xl border p-4 text-sm font-medium" style={{ background: 'rgba(245, 165, 36,0.08)', border: '1px solid rgba(245, 165, 36,0.25)', color: 'var(--color-warning)' }}>
          ⚠ Ninguna prima aprobó los filtros de {summary.total} candidatos
        </div>
      )}

      {/* Ticker cards */}
      {tickers.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
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
