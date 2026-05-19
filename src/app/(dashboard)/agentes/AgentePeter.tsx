'use client'

import { useRef, useState } from 'react'
import { Loader2, Play, Square, RotateCcw, TrendingUp, BarChart2, Brain, BookOpen, CheckCircle2 } from 'lucide-react'
import type { ScreenerResult } from '@/lib/peter-lynch/screener'

type Phase = 'idle' | 'running' | 'done' | 'error'

interface TickerStage {
  ticker: string
  name?: string
  score: number
  step1: 'pass'
  // Paso 2 — TimesFM
  forecastPrice?: number
  forecastReturn?: number
  step2: 'pending' | 'pass' | 'fail'
  // Paso 3 — Momentum
  rsi?: number
  macd?: number
  macdSignal?: number
  momentumScore?: number
  step3: 'pending' | 'pass' | 'fail'
  // Paso 4 — AI TradingAgents
  lastPrice?: number
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
  if (phase === 'idle')    return <span style={{ color: '#64748b', border: '1px solid #1e1e2e' }} className="text-[9px] font-mono px-1.5 py-0.5 rounded">EN ESPERA</span>
  if (phase === 'running') return <span style={{ color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.1)' }} className="text-[9px] font-mono px-1.5 py-0.5 rounded animate-pulse">● EJECUTANDO</span>
  if (phase === 'done')    return <span style={{ color: '#4ade80', border: '1px solid rgba(74,222,128,0.4)', background: 'rgba(74,222,128,0.1)' }} className="text-[9px] font-mono px-1.5 py-0.5 rounded">✓ COMPLETADO</span>
  return                          <span style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.1)' }} className="text-[9px] font-mono px-1.5 py-0.5 rounded">✗ ERROR</span>
}

function TickerCard({ t }: { t: TickerStage }) {
  const stepColors = {
    pass:    { color: '#4ade80', border: 'rgba(74,222,128,0.4)',  bg: 'rgba(74,222,128,0.08)' },
    fail:    { color: '#f87171', border: 'rgba(248,113,113,0.4)', bg: 'rgba(248,113,113,0.08)' },
    running: { color: '#fbbf24', border: 'rgba(251,191,36,0.4)',  bg: 'rgba(251,191,36,0.08)' },
    pending: { color: '#475569', border: '#1e1e2e',               bg: 'transparent' },
  }

  const convictionColor = (t.conviction ?? 0) >= 8 ? '#4ade80' : (t.conviction ?? 0) >= 6 ? '#fbbf24' : '#f87171'

  return (
    <div className="rounded-xl p-3 space-y-2" style={{ border: '1px solid #1e1e2e', background: '#12121a' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm" style={{ color: '#00ff88' }}>{t.ticker}</span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.08)' }}>
            LYNCH {t.score}/6
          </span>
        </div>
        {t.step5 === 'done' && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.08)' }}>
            📝 PICK
          </span>
        )}
      </div>

      {/* Filter badges row */}
      <div className="flex flex-wrap gap-1">
        {/* TimesFM */}
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
          <span className="text-[8px] font-mono text-[#475569] text-center leading-tight">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function AgentePeter() {
  const [phase, setPhase]           = useState<Phase>('idle')
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
    setStep1Phase('idle'); setStep2Phase('idle'); setStep3Phase('idle')
    setStep4Phase('idle'); setStep5Phase('idle')
    setTickers([]); setLog([]); setSummary(null)
  }

  function stop() {
    abortRef.current?.abort()
    addLog('⛔ Agente detenido por el usuario')
    setPhase('idle')
    setStep1Phase('idle'); setStep2Phase('idle'); setStep3Phase('idle')
    setStep4Phase('idle'); setStep5Phase('idle')
  }

  async function run() {
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    setPhase('running'); setLog([]); setTickers([]); setSummary(null)

    try {
      // ── PASO 1: Lynch 6/6 ─────────────────────────────────────────
      setStep1Phase('running')
      addLog('🔍 Ejecutando screener Lynch (score 6/6)...')
      const lynchRes = await fetch('/api/peter-lynch/screen', { signal })
      if (!lynchRes.ok) throw new Error(`Screener HTTP ${lynchRes.status}`)
      const all = await lynchRes.json() as ScreenerResult[]
      const six = all.filter(r => r.score === 6)

      if (!six.length) {
        addLog('⚠ Sin acciones con score 6/6. Intenta refrescar el screener en Ratios Peter Lynch.')
        setStep1Phase('done'); setPhase('done'); return
      }
      addLog(`✓ ${six.length} acción(es) con score 6/6: ${six.map(r => r.ticker).join(', ')}`)
      const initial: TickerStage[] = six.map(r => ({
        ticker: r.ticker, name: r.name, score: r.score,
        step1: 'pass', step2: 'pending', step3: 'pending', step4: 'pending', step5: 'pending',
      }))
      setTickers([...initial])
      setStep1Phase('done')
      if (signal.aborted) { setPhase('idle'); return }

      // ── PASO 2: TimesFM Forecast 30d ──────────────────────────────
      setStep2Phase('running')
      addLog(`📊 TimesFM: proyectando precio 30 días para ${six.length} ticker(s)...`)
      const forecastRes = await fetch(
        `/api/agentes/forecast?tickers=${six.map(r => r.ticker).join(',')}`, { signal }
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
        setPhase('done'); setSummary({ created: 0, total: six.length }); return
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
        setPhase('done'); setSummary({ created: 0, total: six.length }); return
      }

      // ── PASO 4: AI Confirmation (TradingAgents) ───────────────────
      setStep4Phase('running')
      addLog(`🤖 TradingAgents: analizando ${paso3Pass.length} ticker(s) con 3 agentes IA...`)
      const paso4: TickerStage[] = [...paso3]
      const analyzed: TickerStage[] = []

      for (const t of paso3Pass) {
        if (signal.aborted) break
        addLog(`⟳ ${t.ticker}: debate técnico + fundamental + síntesis...`)
        const idx = paso4.findIndex(x => x.ticker === t.ticker)
        if (idx !== -1) paso4[idx] = { ...paso4[idx], step4: 'running' }
        setTickers([...paso4])

        try {
          const aRes = await fetch('/api/agentes/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticker: t.ticker,
              lastPrice: t.lastPrice ?? t.forecastPrice ?? 0,
              category: 'PETER_LYNCH',
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
          const pass = conviction >= 7

          addLog(`${pass ? '✓' : '✗'} ${t.ticker}: conviction ${conviction}/10 · ${result.consensus ?? 'N/D'} · riesgo ${result.riesgo ?? '?'}${!pass ? ' → conviction insuficiente (<7)' : ''}`)

          if (idx !== -1) paso4[idx] = {
            ...paso4[idx],
            step4: pass ? 'pass' : 'fail',
            empresa: result.empresa as string,
            conviction,
            consensus: result.consensus as string,
            lastPrice: result.precio_objetivo ? (result.precio_objetivo as number) / 1.15 : undefined,
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
        const entryPrice = t.lastPrice ?? t.forecastPrice ?? 0

        try {
          const sRes = await fetch('/api/agentes/picks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticker: t.ticker,
              empresa: ai.empresa ?? t.name,
              category: 'PETER_LYNCH',
              precio_entrada: parseFloat(entryPrice.toFixed(2)),
              precio_objetivo: ai.precio_objetivo,
              stop_loss: ai.stop_loss,
              direction: ai.direction ?? 'COMPRA',
              riesgo: ai.riesgo,
              timeframe: ai.timeframe,
              resumen: ai.resumen,
              score: t.score,
              ai_report: { ...ai, conviction: t.conviction, consensus: t.consensus, forecastReturn: t.forecastReturn, momentumScore: t.momentumScore },
            }),
            signal,
          })
          if (!sRes.ok) throw new Error(`Picks HTTP ${sRes.status}`)
          addLog(`✓ ${t.ticker}: guardado — ${t.empresa ?? t.ticker} (conviction ${t.conviction}/10)`)
          const idx = paso5.findIndex(x => x.ticker === t.ticker)
          if (idx !== -1) paso5[idx] = { ...paso5[idx], step5: 'done' }
          created++
        } catch (e) {
          if (signal.aborted) break
          addLog(`⚠ ${t.ticker}: error guardando — ${(e as Error).message}`)
          const idx = paso5.findIndex(x => x.ticker === t.ticker)
          if (idx !== -1) paso5[idx] = { ...paso5[idx], step5: 'fail' }
        }
        setTickers([...paso5])
      }

      setStep5Phase('done')
      setSummary({ created, total: six.length })
      addLog(`✅ AGENTE PETER finalizado. ${created} recomendación(es) de ${six.length} candidatos iniciales.`)
      setPhase('done')
    } catch (e) {
      if ((e as Error).name === 'AbortError') { setPhase('idle'); return }
      addLog(`✗ Error fatal: ${(e as Error).message}`)
      setPhase('error')
    }
  }

  const steps = [
    { label: 'LYNCH 6/6', desc: 'Screener S&P500+NASDAQ100', phase: step1Phase, icon: BookOpen },
    { label: 'TIMESFM FORECAST', desc: 'Proyección 30 días ≥2%', phase: step2Phase, icon: TrendingUp },
    { label: 'MOMENTUM SCANNER', desc: 'RSI · MACD · Volumen ≥2/3', phase: step3Phase, icon: BarChart2 },
    { label: 'CONFIRMACIÓN IA', desc: 'TradingAgents conviction ≥7', phase: step4Phase, icon: Brain },
    { label: 'PICKS & INFORME', desc: 'Guardar recomendaciones', phase: step5Phase, icon: CheckCircle2 },
  ]

  // Funnel counts
  const funnelStages = [
    { label: 'Lynch', count: tickers.length,                                            color: '#fbbf24' },
    { label: 'Forecast', count: tickers.filter(t => t.step2 === 'pass').length,         color: '#a78bfa' },
    { label: 'Momentum', count: tickers.filter(t => t.step3 === 'pass').length,         color: '#38bdf8' },
    { label: 'IA',     count: tickers.filter(t => t.step4 === 'pass').length,           color: '#fb923c' },
    { label: 'Picks',  count: tickers.filter(t => t.step5 === 'done').length,           color: '#4ade80' },
  ]

  return (
    <div className="space-y-4">
      {/* Step cards */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        {steps.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-3 relative overflow-hidden">
              {/* step number accent */}
              <div className="absolute top-0 left-0 w-0.5 h-full" style={{
                background: s.phase === 'done' ? '#4ade80' : s.phase === 'running' ? '#fbbf24' : s.phase === 'error' ? '#f87171' : '#1e1e2e'
              }} />
              <div className="mb-2 flex items-center justify-between gap-1 pl-2">
                <span className="text-[9px] font-bold font-mono text-[#475569]">{String(i + 1).padStart(2, '0')}</span>
                <StepBadge phase={s.phase} />
              </div>
              <div className="pl-2 flex items-start gap-1.5">
                <Icon size={12} style={{ color: s.phase === 'done' ? '#4ade80' : s.phase === 'running' ? '#fbbf24' : '#475569' }} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold font-mono text-[#e2e8f0] leading-tight">{s.label}</p>
                  <p className="mt-0.5 text-[9px] text-[#475569] leading-tight">{s.desc}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Funnel visualization */}
      {tickers.length > 0 && (
        <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-4">
          <p className="text-[9px] font-mono text-[#475569] mb-3">EMBUDO DE SELECCIÓN</p>
          <FunnelBar stages={funnelStages} />
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {phase === 'idle' || phase === 'done' || phase === 'error' ? (
          <button
            onClick={() => void run()}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all hover:brightness-90 active:scale-[0.98]"
            style={{ background: '#00ff88', color: '#0a0a0f' }}
          >
            <Play size={13} />
            {phase === 'done' || phase === 'error' ? 'Ejecutar de nuevo' : 'Ejecutar AGENTE PETER'}
          </button>
        ) : (
          <button
            onClick={stop}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all"
            style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
          >
            <Square size={13} />
            Detener
          </button>
        )}
        {(phase === 'done' || phase === 'error') && (
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-lg border border-[#1e1e2e] px-3 py-2 text-xs text-[#64748b] hover:text-[#e2e8f0] transition-colors"
          >
            <RotateCcw size={13} />
            Reiniciar
          </button>
        )}
        {phase === 'running' && (
          <span className="flex items-center gap-1.5 text-xs text-[#64748b]">
            <Loader2 size={12} className="animate-spin" />
            Procesando…
          </span>
        )}
      </div>

      {/* Summary */}
      {summary && (
        <div
          className="rounded-xl border p-4 text-sm font-medium"
          style={
            summary.created > 0
              ? { background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }
              : { background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }
          }
        >
          {summary.created > 0
            ? `✅ ${summary.created} recomendación(es) — ve a RECOMENDACIONES → AGENTE PETER`
            : `⚠ Ninguna recomendación aprobó los 4 filtros de ${summary.total} candidatos`}
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
          className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] p-4 font-mono text-[11px] overflow-y-auto"
          style={{ maxHeight: '300px' }}
        >
          {log.map((line, i) => (
            <div key={i} className="py-0.5 leading-relaxed" style={{
              color: line.startsWith('✓') ? '#4ade80'
                : line.startsWith('✗') || line.startsWith('⛔') ? '#f87171'
                : line.startsWith('⚠') ? '#fbbf24'
                : line.startsWith('⟳') ? '#a78bfa'
                : '#64748b'
            }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
