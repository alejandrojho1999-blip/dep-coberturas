'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { Loader2, Play, Square, RotateCcw, TrendingUp, BarChart2, Brain, BookOpen, CheckCircle2, ArrowRight, RefreshCw } from 'lucide-react'
import type { ScreenerResult } from '@/lib/peter-lynch/screener'
import FichaTecnicaAgente from './FichaTecnicaAgente'
import SoloLectura from './SoloLectura'
import { FICHA_SMALL } from './fichas/small'

type Phase = 'idle' | 'running' | 'done' | 'error'

interface TickerStage {
  ticker: string
  name?: string
  score: number
  marketCapM?: number
  step1: 'pass'
  // Paso 2 — proyección 30d (regresión lineal + EWMA)
  lastPrice?: number
  forecastPrice?: number
  forecastReturn?: number
  step2: 'pending' | 'pass' | 'fail'
  // Paso 3 — Momentum
  rsi?: number
  macd?: number
  macdSignal?: number
  momentumScore?: number
  step3: 'pending' | 'pass' | 'fail'
  // Paso 4 — revisión por modelo de lenguaje
  empresa?: string
  conviction?: number
  consensus?: string
  aiResult?: Record<string, unknown>
  step4: 'pending' | 'pass' | 'fail' | 'running'
  // Paso 5 — Save
  step5: 'pending' | 'done' | 'fail'
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

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

  const convictionColor = (t.conviction ?? 0) >= 8 ? 'var(--color-positive)' : (t.conviction ?? 0) >= 6 ? 'var(--color-warning)' : 'var(--color-negative)'

  return (
    <div className="rounded-xl p-3 space-y-2" style={{ border: '1px solid var(--color-border-subtle)', background: 'var(--color-surface)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>{t.ticker}</span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: 'var(--color-warning)', border: '1px solid rgba(245, 165, 36,0.3)', background: 'rgba(245, 165, 36,0.08)' }}>
            LYNCH {t.score}/6
          </span>
          {t.marketCapM != null && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.08)' }}>
              ${(t.marketCapM / 1000).toFixed(1)}B
            </span>
          )}
        </div>
        {t.step5 === 'done' && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.08)' }}>
            📝 PICK
          </span>
        )}
      </div>

      {/* Filter badges row */}
      <div className="flex flex-wrap gap-1">
        {/* Proyección 30d */}
        {t.step2 !== 'pending' && (() => {
          const s = stepColors[t.step2 === 'pass' ? 'pass' : 'fail']
          return (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ color: s.color, border: `1px solid ${s.border}`, background: s.bg }}>
              {t.step2 === 'pass' ? `▲${t.forecastReturn != null ? (t.forecastReturn >= 0 ? '+' : '') + t.forecastReturn.toFixed(1) + '%' : ''}` : '▼FORECAST'}
            </span>
          )
        })()}

        {/* Momentum */}
        {t.step3 !== 'pending' && (() => {
          const s = stepColors[t.step3 === 'pass' ? 'pass' : 'fail']
          return (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ color: s.color, border: `1px solid ${s.border}`, background: s.bg }}>
              {t.step3 === 'pass'
                ? `MOM ${t.momentumScore ?? 0}/3 · RSI ${t.rsi?.toFixed(0) ?? '?'}`
                : `MOM ${t.momentumScore ?? 0}/3`}
            </span>
          )
        })()}

        {/* AI */}
        {t.step4 !== 'pending' && (() => {
          const key = t.step4 === 'running' ? 'running' : t.step4 === 'pass' ? 'pass' : 'fail'
          const s = stepColors[key]
          return (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ color: t.step4 === 'pass' ? convictionColor : s.color, border: `1px solid ${s.border}`, background: s.bg }}>
              {t.step4 === 'running' ? 'IA⟳' : t.step4 === 'pass' ? `IA ${t.conviction ?? '?'}/10` : 'IA✗'}
            </span>
          )
        })()}
      </div>
    </div>
  )
}

function FunnelBar({ stages }: { stages: { label: string; count: number; color: string }[] }) {
  const max = stages[0]?.count ?? 1
  return (
    <div className="flex items-end gap-1 h-12 px-1">
      {stages.map((s, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[9px] font-mono font-bold" style={{ color: s.color }}>{s.count}</span>
          <div
            className="w-full rounded-sm transition-all duration-500"
            style={{
              height: `${Math.max(4, (s.count / max) * 32)}px`,
              background: s.color,
              opacity: 0.7,
            }}
          />
          <span className="text-[8px] font-mono text-text-muted text-center leading-tight">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function AgenteSmall({ puedeEjecutar = false }: { puedeEjecutar?: boolean }
) {
  const [phase, setPhase]           = useState<Phase>('idle')
  const [step0Phase, setStep0Phase] = useState<Phase>('idle')
  const [step1Phase, setStep1Phase] = useState<Phase>('idle')
  const [step2Phase, setStep2Phase] = useState<Phase>('idle')
  const [step3Phase, setStep3Phase] = useState<Phase>('idle')
  const [step4Phase, setStep4Phase] = useState<Phase>('idle')
  const [step5Phase, setStep5Phase] = useState<Phase>('idle')
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
    setStep4Phase('idle'); setStep5Phase('idle')
    setTickers([]); setLog([]); setSummary(null)
  }

  function stop() {
    abortRef.current?.abort()
    addLog('⛔ Agente detenido por el usuario')
    setPhase('idle')
    setStep0Phase('idle'); setStep1Phase('idle'); setStep2Phase('idle'); setStep3Phase('idle')
    setStep4Phase('idle'); setStep5Phase('idle')
  }

  async function run() {
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    setPhase('running'); setLog([]); setTickers([]); setSummary(null)

    try {
      // ── PASO 0: Re-evaluación de posiciones activas ────────────────
      setStep0Phase('running')
      addLog('🔄 Re-evaluando posiciones activas del Agente Small...')

      type ActivePickReview = {
        id: string; ticker: string; precio_entrada: number;
        forecastPass: boolean; momentumPass: boolean; forecastLastPrice: number;
      }
      let activePicksReview: ActivePickReview[] = []

      const picksRes = await fetch('/api/agentes/picks?category=SMALL_CAPS', { signal })
      const allPicks = picksRes.ok
        ? await picksRes.json() as Array<{ id: string; ticker: string; precio_entrada: number; estado: string }>
        : []
      const activePicks = allPicks.filter(p => p.estado !== 'Vender')

      if (!activePicks.length) {
        addLog('✓ Sin posiciones activas para re-evaluar')
      } else {
        addLog(`📋 ${activePicks.length} posición(es) activa(s): ${activePicks.map(p => p.ticker).join(', ')}`)
        const activeTickers = activePicks.map(p => p.ticker).join(',')
        const [fRes0, mRes0] = await Promise.all([
          fetch(`/api/agentes/forecast?tickers=${activeTickers}`, { signal }),
          fetch(`/api/agentes/momentum?tickers=${activeTickers}`, { signal }),
        ])
        const fData0 = fRes0.ok
          ? await fRes0.json() as Record<string, { lastPrice: number; pass: boolean }>
          : {}
        const mData0 = mRes0.ok
          ? await mRes0.json() as Record<string, { pass: boolean }>
          : {}
        activePicksReview = activePicks.map(p => ({
          id: p.id, ticker: p.ticker, precio_entrada: p.precio_entrada,
          forecastPass:  fData0[p.ticker]?.pass  ?? true,
          momentumPass:  mData0[p.ticker]?.pass  ?? true,
          forecastLastPrice: fData0[p.ticker]?.lastPrice ?? p.precio_entrada,
        }))
        addLog(`✓ Datos preliminares de re-evaluación listos para ${activePicksReview.length} posición(es)`)
      }
      setStep0Phase('done')
      if (signal.aborted) { setPhase('idle'); return }

      // ── PASO 1: Lynch Small-Cap (score ≥4/6, criterios adaptados) ─
      setStep1Phase('running')
      addLog('🔍 Ejecutando screener Lynch Small-Cap (score ≥4/6, criterios adaptados)...')
      const lynchRes = await fetch('/api/peter-lynch/screen?universe=small_cap', { signal })
      if (!lynchRes.ok) throw new Error(`Screener HTTP ${lynchRes.status}`)
      const all = await lynchRes.json() as ScreenerResult[]
      const small = all.filter(r => r.score >= 4)

      if (!small.length) {
        addLog('⚠ Sin Small-Cap con score ≥4/6 (criterios adaptados S&P 600 / Russell 2000). Intenta refrescar el screener en Ratios Peter Lynch.')
        setStep1Phase('done'); setPhase('done'); return
      }
      addLog(`✓ ${small.length} acción(es) Small-Cap (score ≥4/6, criterios Lynch adaptados): ${small.map(r => r.ticker).join(', ')}`)
      const initial: TickerStage[] = small.map(r => ({
        ticker: r.ticker, name: r.name, score: r.score,
        marketCapM: r.market_cap != null ? Math.round(r.market_cap / 1_000_000) : undefined,
        step1: 'pass', step2: 'pending', step3: 'pending', step4: 'pending', step5: 'pending',
      }))
      setTickers([...initial])
      setStep1Phase('done')

      // ── RE-EVALUACIÓN: señales de venta ───────────────────────────
      if (activePicksReview.length) {
        const smallSet = new Set(small.map(r => r.ticker))
        for (const review of activePicksReview) {
          if (signal.aborted) break
          const lynchPass = smallSet.has(review.ticker)
          const failCount = (!lynchPass ? 1 : 0) + (!review.forecastPass ? 1 : 0) + (!review.momentumPass ? 1 : 0)
          if (failCount >= 2) {
            const cp = review.forecastLastPrice
            const rent = review.precio_entrada > 0
              ? ((cp - review.precio_entrada) / review.precio_entrada * 100)
              : 0
            const rentStr = (rent >= 0 ? '+' : '') + rent.toFixed(1) + '%'
            addLog(`⬇ ${review.ticker}: SEÑAL VENDER — falla ${failCount}/3 filtros | entrada $${review.precio_entrada.toFixed(2)} → salida $${cp.toFixed(2)} | rentabilidad ${rentStr}`)
            try {
              await fetch('/api/agentes/picks', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: review.id,
                  estado: 'Vender',
                  precio_venta: parseFloat(cp.toFixed(2)),
                  rentabilidad: parseFloat(rent.toFixed(2)),
                  closed_at: new Date().toISOString(),
                }),
                signal,
              })
            } catch { addLog(`⚠ ${review.ticker}: error al registrar señal de venta`) }
          } else {
            addLog(`✓ ${review.ticker}: posición OK — falla ${failCount}/3 filtros (umbral: 2)`)
          }
        }
      }
      if (signal.aborted) { setPhase('idle'); return }

      // ── PASO 2: Proyección 30d (regresión lineal + EWMA) ─────────
      setStep2Phase('running')
      addLog(`📊 Proyección 30d: estimando precio para ${small.length} ticker(s)...`)
      const forecastRes = await fetch(
        `/api/agentes/forecast?tickers=${small.map(r => r.ticker).join(',')}`, { signal }
      )
      const forecastData = forecastRes.ok
        ? await forecastRes.json() as Record<string, { lastPrice: number; forecastPrice: number; forecastReturn: number; pass: boolean }>
        : {}

      const paso2: TickerStage[] = initial.map(t => {
        const fd = forecastData[t.ticker]
        if (!fd) {
          addLog(`⚠ ${t.ticker}: sin datos de forecast`)
          return { ...t, step2: 'fail' }
        }
        const sign = fd.forecastReturn >= 0 ? '+' : ''
        addLog(`${fd.pass ? '✓' : '✗'} ${t.ticker}: forecast 30d ${sign}${fd.forecastReturn.toFixed(1)}% → $${fd.forecastPrice.toFixed(2)}${!fd.pass ? ' → descartado (<2% upside)' : ''}`)
        return { ...t, step2: fd.pass ? 'pass' : 'fail', lastPrice: fd.lastPrice, forecastPrice: fd.forecastPrice, forecastReturn: fd.forecastReturn }
      })
      setTickers([...paso2])
      setStep2Phase('done')
      if (signal.aborted) { setPhase('idle'); return }

      const paso2Pass = paso2.filter(t => t.step2 === 'pass')
      if (!paso2Pass.length) {
        addLog('⚠ Ningún ticker con upside proyectado ≥2% a 30 días.')
        setStep3Phase('done'); setStep4Phase('done'); setStep5Phase('done')
        setPhase('done'); setSummary({ created: 0, total: small.length }); return
      }

      // ── PASO 3: Momentum Daily Scanner ────────────────────────────
      setStep3Phase('running')
      addLog(`⚡ Momentum Scanner: RSI/MACD/Volumen para ${paso2Pass.length} ticker(s)...`)
      const momRes = await fetch(
        `/api/agentes/momentum?tickers=${paso2Pass.map(t => t.ticker).join(',')}`, { signal }
      )
      const momData = momRes.ok
        ? await momRes.json() as Record<string, { rsi: number; macd: number; signal: number; volumeTrend: number; score: number; pass: boolean }>
        : {}

      const paso3: TickerStage[] = paso2.map(t => {
        if (t.step2 !== 'pass') return t
        const md = momData[t.ticker]
        if (!md) {
          addLog(`⚠ ${t.ticker}: sin datos de momentum`)
          return { ...t, step3: 'fail' }
        }
        const macdDir = md.macd > md.signal ? '↑' : '↓'
        addLog(`${md.pass ? '✓' : '✗'} ${t.ticker}: score ${md.score}/3 · RSI ${md.rsi.toFixed(0)} · MACD ${macdDir} · Vol×${md.volumeTrend.toFixed(2)}${!md.pass ? ' → descartado' : ''}`)
        return { ...t, step3: md.pass ? 'pass' : 'fail', rsi: md.rsi, macd: md.macd, macdSignal: md.signal, momentumScore: md.score }
      })
      setTickers([...paso3])
      setStep3Phase('done')
      if (signal.aborted) { setPhase('idle'); return }

      const paso3Pass = paso3.filter(t => t.step3 === 'pass')
      if (!paso3Pass.length) {
        addLog('⚠ Ningún ticker superó el filtro de momentum (score ≥2/3).')
        setStep4Phase('done'); setStep5Phase('done')
        setPhase('done'); setSummary({ created: 0, total: small.length }); return
      }

      // ── PASO 4: Revisión por IA ───────────────────────────────────
      setStep4Phase('running')
      addLog(`🤖 Revisión por IA: analizando ${paso3Pass.length} ticker(s) Small-Cap...`)
      const paso4: TickerStage[] = [...paso3]
      const analyzed: TickerStage[] = []

      for (const t of paso3Pass) {
        if (signal.aborted) break
        const idx = paso4.findIndex(x => x.ticker === t.ticker)

        // Sin precio real de mercado no se analiza: el objetivo y el stop de la
        // IA se derivan de él, y el precio de entrada quedaría inventado.
        if (t.lastPrice == null || t.lastPrice <= 0) {
          addLog(`⚠ ${t.ticker}: sin precio de mercado fiable — descartado`)
          if (idx !== -1) paso4[idx] = { ...paso4[idx], step4: 'fail' }
          setTickers([...paso4])
          continue
        }

        addLog(`⟳ ${t.ticker}: debate técnico + fundamental + síntesis...`)
        if (idx !== -1) paso4[idx] = { ...paso4[idx], step4: 'running' }
        setTickers([...paso4])

        try {
          const aRes = await fetch('/api/agentes/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticker: t.ticker,
              lastPrice: t.lastPrice,
              category: 'SMALL_CAPS',
              score: t.score,
              forecastReturn: t.forecastReturn,
              momentumScore: t.momentumScore,
              rsi: t.rsi,
              macd: t.macd,
              macdSignal: t.macdSignal,
            }),
            signal,
          })
          if (!aRes.ok) throw new Error(`IA HTTP ${aRes.status}`)
          const result = await aRes.json() as Record<string, unknown>
          const conviction = (result.conviction as number) ?? 5
          // Mismo criterio que el Agente Peter: comparten `/api/agentes/analyze`
          // y esta cartera también es solo larga, así que una dirección que no
          // sea COMPRA no puede guardarse aunque la convicción sea alta.
          const direction = ((result.direction as string) ?? 'COMPRA').toUpperCase()
          const convictionOk = conviction >= 7
          const directionOk = direction === 'COMPRA'
          const pass = convictionOk && directionOk

          const motivo = !convictionOk
            ? ' → conviction insuficiente (<7)'
            : !directionOk ? ` → dirección ${direction}, no es compra` : ''
          addLog(`${pass ? '✓' : '✗'} ${t.ticker}: conviction ${conviction}/10 · ${direction} · ${result.consensus ?? 'N/D'} · riesgo ${result.riesgo ?? '?'}${motivo}`)

          if (idx !== -1) paso4[idx] = {
            ...paso4[idx],
            step4: pass ? 'pass' : 'fail',
            empresa: result.empresa as string,
            conviction,
            consensus: result.consensus as string,
            aiResult: result,
          }
          if (pass) analyzed.push({ ...paso4[idx] })
        } catch (e) {
          if (signal.aborted) break
          addLog(`⚠ ${t.ticker}: error IA — ${(e as Error).message}`)
          if (idx !== -1) paso4[idx] = { ...paso4[idx], step4: 'fail' }
        }
        setTickers([...paso4])
        await sleep(600)
      }
      setStep4Phase('done')
      if (signal.aborted) { setPhase('idle'); return }

      // ── PASO 5: Guardar picks ─────────────────────────────────────
      setStep5Phase('running')
      addLog(`📝 Guardando ${analyzed.length} recomendación(es) validadas...`)
      const paso5: TickerStage[] = [...paso4]
      let created = 0

      for (const t of analyzed) {
        if (signal.aborted) break
        const ai = t.aiResult ?? {}
        // Precio real de mercado del paso 2. Nunca se sustituye por la
        // proyección ni por cero: una entrada inventada falsea el rendimiento
        // de la recomendación durante toda su vida.
        const entryPrice = t.lastPrice
        if (entryPrice == null || entryPrice <= 0) {
          addLog(`⚠ ${t.ticker}: sin precio de entrada fiable — no se guarda`)
          continue
        }

        try {
          const sRes = await fetch('/api/agentes/picks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticker: t.ticker,
              empresa: ai.empresa ?? t.name,
              category: 'SMALL_CAPS',
              precio_entrada: parseFloat(entryPrice.toFixed(2)),
              precio_objetivo: ai.precio_objetivo,
              stop_loss: ai.stop_loss,
              // Constante a propósito: el paso 4 solo deja pasar COMPRA, y así
              // no se cuela un 'compra' en minúsculas del modelo.
              direction: 'COMPRA',
              riesgo: ai.riesgo,
              timeframe: ai.timeframe,
              resumen: ai.resumen,
              score: t.score,
              market_cap_m: t.marketCapM,
              ai_report: { ...ai, conviction: t.conviction, consensus: t.consensus, forecastReturn: t.forecastReturn, momentumScore: t.momentumScore },
            }),
            signal,
          })
          if (!sRes.ok) throw new Error(`Picks HTTP ${sRes.status}`)
          const sData = await sRes.json() as { skipped?: boolean }
          if (sData.skipped) {
            addLog(`↩ ${t.ticker}: ya tiene posición activa — se conserva la recomendación original sin modificar`)
          } else {
            addLog(`✓ ${t.ticker}: guardado — ${t.empresa ?? t.ticker} (conviction ${t.conviction}/10)`)
            const idx = paso5.findIndex(x => x.ticker === t.ticker)
            if (idx !== -1) paso5[idx] = { ...paso5[idx], step5: 'done' }
            created++
          }
        } catch (e) {
          if (signal.aborted) break
          addLog(`⚠ ${t.ticker}: error guardando — ${(e as Error).message}`)
          const idx = paso5.findIndex(x => x.ticker === t.ticker)
          if (idx !== -1) paso5[idx] = { ...paso5[idx], step5: 'fail' }
        }
        setTickers([...paso5])
      }

      setStep5Phase('done')
      setSummary({ created, total: small.length })
      addLog(`✅ AGENTE SMALL finalizado. ${created} recomendación(es) de ${small.length} candidatos iniciales.`)
      setPhase('done')
    } catch (e) {
      if ((e as Error).name === 'AbortError') { setPhase('idle'); return }
      addLog(`✗ Error fatal: ${(e as Error).message}`)
      setPhase('error')
    }
  }

  const steps = [
    { label: 'RE-EVALUACIÓN', desc: 'Auto-sell si ≥2/3 filtros fallan', phase: step0Phase, icon: RefreshCw },
    { label: 'SMALL-CAP LYNCH', desc: 'Score ≥4/6 · S&P 600 + Russell 2000', phase: step1Phase, icon: BookOpen },
    { label: 'PROYECCIÓN 30d', desc: 'Regresión + EWMA ≥2%', phase: step2Phase, icon: TrendingUp },
    { label: 'MOMENTUM SCANNER', desc: 'RSI · MACD · Volumen ≥2/3', phase: step3Phase, icon: BarChart2 },
    { label: 'CONFIRMACIÓN IA', desc: 'Convicción del modelo ≥7', phase: step4Phase, icon: Brain },
    { label: 'PICKS & INFORME', desc: 'Sin duplicados, solo aprobados', phase: step5Phase, icon: CheckCircle2 },
  ]

  const funnelStages = [
    { label: 'Lynch',    count: tickers.length,                                  color: 'var(--color-warning)' },
    { label: 'Forecast', count: tickers.filter(t => t.step2 === 'pass').length,  color: '#8b8ff0' },
    { label: 'Momentum', count: tickers.filter(t => t.step3 === 'pass').length,  color: '#38bdf8' },
    { label: 'IA',       count: tickers.filter(t => t.step4 === 'pass').length,  color: '#e0a458' },
    { label: 'Picks',    count: tickers.filter(t => t.step5 === 'done').length,  color: 'var(--color-positive)' },
  ]

  return (
    <div className="space-y-4">
      {/* Ficha técnica — cómo funciona el agente y qué respaldo tiene */}
      <FichaTecnicaAgente ficha={FICHA_SMALL} />

      {/* Step cards */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {steps.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="rounded-xl border border-border-subtle bg-surface p-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-0.5 h-full" style={{
                background: s.phase === 'done' ? 'var(--color-positive)' : s.phase === 'running' ? 'var(--color-warning)' : s.phase === 'error' ? 'var(--color-negative)' : 'var(--color-border-subtle)'
              }} />
              <div className="mb-2 flex items-center justify-between gap-1 pl-2">
                <span className="text-[9px] font-bold font-mono text-text-muted">{String(i + 1).padStart(2, '0')}</span>
                <StepBadge phase={s.phase} />
              </div>
              <div className="pl-2 flex items-start gap-1.5">
                <Icon size={12} style={{ color: s.phase === 'done' ? 'var(--color-positive)' : s.phase === 'running' ? 'var(--color-warning)' : 'var(--color-text-muted)' }} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold font-mono text-text-primary leading-tight">{s.label}</p>
                  <p className="mt-0.5 text-[9px] text-text-muted leading-tight">{s.desc}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Funnel visualization */}
      {tickers.length > 0 && (
        <div className="rounded-xl border border-border-subtle bg-surface p-4">
          <p className="text-[9px] font-mono text-text-muted mb-3">EMBUDO DE SELECCIÓN</p>
          <FunnelBar stages={funnelStages} />
        </div>
      )}

      {/* Controls */}
      {!puedeEjecutar ? (
        <SoloLectura agente="AGENTE SMALL" />
      ) : (
      <div className="flex flex-wrap items-center gap-2">
        {phase === 'idle' || phase === 'done' || phase === 'error' ? (
          <button
            onClick={() => void run()}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all hover:brightness-90 active:scale-[0.98]"
            style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
          >
            <Play size={13} />
            {phase === 'done' || phase === 'error' ? 'Ejecutar de nuevo' : 'Ejecutar AGENTE SMALL'}
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
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            <RotateCcw size={13} />
            Reiniciar
          </button>
        )}
        {phase === 'running' && (
          <span className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Loader2 size={12} className="animate-spin" />
            Procesando…
          </span>
        )}
      </div>
      )}

      {/* Summary */}
      {summary && summary.created > 0 && (() => {
        const approved = tickers.filter(t => t.step5 === 'done')
        return (
          <div className="rounded-xl border p-4 space-y-3" style={{ background: 'rgba(16, 185, 129,0.06)', border: '1px solid rgba(16, 185, 129,0.25)' }}>
            <p className="text-xs font-bold font-mono" style={{ color: 'var(--color-positive)' }}>
              ✅ {summary.created} acción(es) Small-Cap aprobaron los 4 filtros
            </p>
            <div className="space-y-1.5">
              {approved.map(t => {
                const conv = t.conviction ?? 0
                const convColor = conv >= 8 ? 'var(--color-positive)' : conv >= 7 ? 'var(--color-warning)' : 'var(--color-negative)'
                const fret = t.forecastReturn ?? 0
                return (
                  <div key={t.ticker} className="flex items-center gap-3 py-1.5 px-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span className="font-mono font-bold text-sm w-14 shrink-0" style={{ color: 'var(--color-text-primary)' }}>{t.ticker}</span>
                    {t.marketCapM != null && (
                      <span className="text-[9px] font-mono shrink-0" style={{ color: '#38bdf8' }}>${(t.marketCapM / 1000).toFixed(1)}B</span>
                    )}
                    <span className="text-xs text-text-secondary truncate flex-1">{t.empresa ?? t.name ?? t.ticker}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0" style={{ color: convColor, border: `1px solid ${convColor}40`, background: `${convColor}10` }}>
                      {conv}/10
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0" style={{ color: fret >= 0 ? 'var(--color-positive)' : 'var(--color-negative)', border: `1px solid ${fret >= 0 ? 'rgba(16, 185, 129,0.3)' : 'rgba(240, 68, 56,0.3)'}`, background: fret >= 0 ? 'rgba(16, 185, 129,0.08)' : 'rgba(240, 68, 56,0.08)' }}>
                      {fret >= 0 ? '+' : ''}{fret.toFixed(1)}%
                    </span>
                  </div>
                )
              })}
            </div>
            <Link
              href="/recomendaciones#rec-small"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all hover:brightness-90"
              style={{ background: 'rgba(245, 165, 36,0.15)', color: 'var(--color-warning)', border: '1px solid rgba(245, 165, 36,0.3)' }}
            >
              <ArrowRight size={13} />
              Ver en RECOMENDACIONES
            </Link>
          </div>
        )
      })()}
      {summary && summary.created === 0 && (
        <div className="rounded-xl border p-4 text-sm font-medium" style={{ background: 'rgba(245, 165, 36,0.08)', border: '1px solid rgba(245, 165, 36,0.25)', color: 'var(--color-warning)' }}>
          ⚠ Ninguna recomendación aprobó los 4 filtros de {summary.total} candidatos Small-Cap
        </div>
      )}

      {/* Ticker cards grid */}
      {tickers.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {tickers.map(t => <TickerCard key={t.ticker} t={t} />)}
        </div>
      )}

      {/* Log console */}
      {log.length > 0 && (
        <div
          ref={logRef}
          className="rounded-xl border border-border-subtle bg-background p-4 font-mono text-[11px] overflow-y-auto"
          style={{ maxHeight: '300px' }}
        >
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
