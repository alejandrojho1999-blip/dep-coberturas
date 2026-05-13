'use client'

import { useRef, useState } from 'react'
import { Loader2, Play, Square, RotateCcw } from 'lucide-react'
import type { ScreenerResult } from '@/lib/peter-lynch/screener'

type Phase = 'idle' | 'running' | 'done' | 'error'

interface TickerStage {
  ticker: string
  name?: string
  score: number
  lastPrice?: number
  sma20?: number
  direction?: string
  empresa?: string
  step1: 'pass'
  step2: 'pending' | 'pass' | 'fail'
  step3: 'pending' | 'pass' | 'fail' | 'running'
  step4: 'pending' | 'done' | 'fail'
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function StepBadge({ phase }: { phase: Phase }) {
  if (phase === 'idle')    return <span style={{ color: '#64748b', border: '1px solid #1e1e2e' }} className="text-[9px] font-mono px-1.5 py-0.5 rounded">EN ESPERA</span>
  if (phase === 'running') return <span style={{ color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.1)' }} className="text-[9px] font-mono px-1.5 py-0.5 rounded animate-pulse">● EJECUTANDO</span>
  if (phase === 'done')    return <span style={{ color: '#4ade80', border: '1px solid rgba(74,222,128,0.4)', background: 'rgba(74,222,128,0.1)' }} className="text-[9px] font-mono px-1.5 py-0.5 rounded">✓ COMPLETADO</span>
  return                          <span style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.1)' }} className="text-[9px] font-mono px-1.5 py-0.5 rounded">✗ ERROR</span>
}

function TickerBadge({ t }: { t: TickerStage }) {
  const step2Style = t.step2 === 'pass'
    ? { color: '#4ade80', border: '1px solid rgba(74,222,128,0.4)', background: 'rgba(74,222,128,0.1)' }
    : t.step2 === 'fail'
    ? { color: '#f87171', border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.1)' }
    : { color: '#64748b', border: '1px solid #1e1e2e' }
  const step3Style = t.step3 === 'pass'
    ? { color: '#4ade80', border: '1px solid rgba(74,222,128,0.4)', background: 'rgba(74,222,128,0.1)' }
    : t.step3 === 'fail'
    ? { color: '#f87171', border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.1)' }
    : t.step3 === 'running'
    ? { color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.1)' }
    : { color: '#64748b', border: '1px solid #1e1e2e' }
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ border: '1px solid #1e1e2e', background: '#12121a' }}>
      <span className="font-mono font-bold text-xs" style={{ color: '#00ff88' }}>{t.ticker}</span>
      <span className="text-[9px] font-mono opacity-60 text-[#64748b]">{t.score}/6</span>
      {t.step2 !== 'pending' && (
        <span className="text-[9px] font-mono px-1 py-0.5 rounded" style={step2Style}>
          {t.step2 === 'pass' ? `↑${t.direction}` : '✗TREND'}
        </span>
      )}
      {t.step3 !== 'pending' && (
        <span className="text-[9px] font-mono px-1 py-0.5 rounded" style={step3Style}>
          {t.step3 === 'pass' ? 'IA✓' : t.step3 === 'fail' ? 'IA✗' : 'IA⟳'}
        </span>
      )}
      {t.step4 === 'done' && (
        <span className="text-[9px] font-mono px-1 py-0.5 rounded" style={{ color: '#60a5fa', border: '1px solid rgba(96,165,250,0.4)', background: 'rgba(96,165,250,0.1)' }}>📝</span>
      )}
    </div>
  )
}

export default function AgentePeter() {
  const [phase, setPhase]           = useState<Phase>('idle')
  const [step1Phase, setStep1Phase] = useState<Phase>('idle')
  const [step2Phase, setStep2Phase] = useState<Phase>('idle')
  const [step3Phase, setStep3Phase] = useState<Phase>('idle')
  const [step4Phase, setStep4Phase] = useState<Phase>('idle')
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
    setStep1Phase('idle'); setStep2Phase('idle'); setStep3Phase('idle'); setStep4Phase('idle')
    setTickers([]); setLog([]); setSummary(null)
  }

  function stop() {
    abortRef.current?.abort()
    addLog('⛔ Agente detenido por el usuario')
    setPhase('idle')
    setStep1Phase('idle'); setStep2Phase('idle'); setStep3Phase('idle'); setStep4Phase('idle')
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
        step1: 'pass', step2: 'pending', step3: 'pending', step4: 'pending',
      }))
      setTickers([...initial])
      setStep1Phase('done')
      if (signal.aborted) { setPhase('idle'); return }

      // ── PASO 2: Tendencia YF (SMA-20) ─────────────────────────────
      setStep2Phase('running')
      addLog(`📈 Verificando tendencia (SMA-20) para ${six.length} ticker(s)...`)
      const trendRes = await fetch(
        `/api/agentes/trend?tickers=${six.map(r => r.ticker).join(',')}`, { signal }
      )
      const trendData = trendRes.ok
        ? await trendRes.json() as Record<string, { direction: string; lastPrice: number; sma20: number }>
        : {}

      const paso2: TickerStage[] = initial.map(t => {
        const td = trendData[t.ticker]
        if (!td) {
          addLog(`⚠ ${t.ticker}: sin datos de tendencia`)
          return { ...t, step2: 'fail' }
        }
        const pass = td.direction === 'ALCISTA'
        addLog(`${pass ? '✓' : '✗'} ${t.ticker}: ${td.direction} ($${td.lastPrice.toFixed(2)} vs SMA-20 $${td.sma20.toFixed(2)})`)
        return { ...t, step2: pass ? 'pass' : 'fail', lastPrice: td.lastPrice, sma20: td.sma20, direction: td.direction }
      })
      setTickers([...paso2])
      setStep2Phase('done')
      if (signal.aborted) { setPhase('idle'); return }

      const paso2Pass = paso2.filter(t => t.step2 === 'pass')
      if (!paso2Pass.length) {
        addLog('⚠ Ningún ticker con tendencia alcista confirmada.')
        setStep3Phase('done'); setStep4Phase('done')
        setPhase('done'); setSummary({ created: 0, total: six.length }); return
      }

      // ── PASO 3: Análisis IA (OpenRouter) ──────────────────────────
      setStep3Phase('running')
      addLog(`🤖 Analizando ${paso2Pass.length} ticker(s) con IA...`)
      const paso3: TickerStage[] = [...paso2]
      const analyzed: (TickerStage & { aiResult: Record<string, unknown> })[] = []

      for (const t of paso2Pass) {
        if (signal.aborted) break
        addLog(`⟳ Analizando ${t.ticker} con IA...`)
        const idx = paso3.findIndex(x => x.ticker === t.ticker)
        if (idx !== -1) paso3[idx] = { ...paso3[idx], step3: 'running' }
        setTickers([...paso3])

        try {
          const aRes = await fetch('/api/agentes/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticker: t.ticker,
              lastPrice: t.lastPrice,
              category: 'PETER_LYNCH',
              score: t.score,
              sma20: t.sma20,
            }),
            signal,
          })
          if (!aRes.ok) throw new Error(`IA HTTP ${aRes.status}`)
          const result = await aRes.json() as Record<string, unknown>
          addLog(`✓ ${t.ticker}: ${result.empresa ?? t.ticker} — ${result.riesgo ?? '?'} riesgo, obj: $${(result.precio_objetivo as number)?.toFixed(2) ?? '?'}`)
          if (idx !== -1) paso3[idx] = { ...paso3[idx], step3: 'pass', empresa: result.empresa as string }
          analyzed.push({ ...t, empresa: result.empresa as string, aiResult: result })
        } catch (e) {
          if (signal.aborted) break
          addLog(`⚠ ${t.ticker}: error IA — ${(e as Error).message}`)
          if (idx !== -1) paso3[idx] = { ...paso3[idx], step3: 'fail' }
        }
        setTickers([...paso3])
        await sleep(500)
      }
      setStep3Phase('done')
      if (signal.aborted) { setPhase('idle'); return }

      // ── PASO 4: Guardar recomendaciones ───────────────────────────
      setStep4Phase('running')
      addLog(`📝 Guardando ${analyzed.length} recomendación(es) en RECOMENDACIONES AGENTE PETER...`)
      const paso4: TickerStage[] = [...paso3]
      let created = 0

      for (const t of analyzed) {
        if (signal.aborted) break
        const ai = t.aiResult
        try {
          const sRes = await fetch('/api/agentes/picks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticker: t.ticker,
              empresa: ai.empresa ?? t.name,
              category: 'PETER_LYNCH',
              precio_entrada: t.lastPrice,
              precio_objetivo: ai.precio_objetivo,
              stop_loss: ai.stop_loss,
              direction: ai.direction ?? 'COMPRA',
              riesgo: ai.riesgo,
              timeframe: ai.timeframe,
              resumen: ai.resumen,
              score: t.score,
              ai_report: ai,
            }),
            signal,
          })
          if (!sRes.ok) throw new Error(`Picks HTTP ${sRes.status}`)
          addLog(`✓ ${t.ticker}: guardado en RECOMENDACIONES`)
          const idx = paso4.findIndex(x => x.ticker === t.ticker)
          if (idx !== -1) paso4[idx] = { ...paso4[idx], step4: 'done' }
          created++
        } catch (e) {
          if (signal.aborted) break
          addLog(`⚠ ${t.ticker}: error guardando — ${(e as Error).message}`)
          const idx = paso4.findIndex(x => x.ticker === t.ticker)
          if (idx !== -1) paso4[idx] = { ...paso4[idx], step4: 'fail' }
        }
        setTickers([...paso4])
      }

      setStep4Phase('done')
      setSummary({ created, total: six.length })
      addLog(`✅ AGENTE PETER finalizado. ${created} recomendación(es) guardada(s) de ${six.length} candidato(s).`)
      setPhase('done')
    } catch (e) {
      if ((e as Error).name === 'AbortError') { setPhase('idle'); return }
      addLog(`✗ Error fatal: ${(e as Error).message}`)
      setPhase('error')
    }
  }

  const steps = [
    { label: 'INVESTIGACIÓN LYNCH 6/6', desc: 'Screener S&P500+NASDAQ100 con puntuación perfecta', phase: step1Phase },
    { label: 'TENDENCIA ALCISTA (SMA-20)', desc: 'Precio actual por encima de media móvil 20 días', phase: step2Phase },
    { label: 'CONFIRMACIÓN IA', desc: 'Análisis fundamental y tesis de inversión por OpenRouter', phase: step3Phase },
    { label: 'GENERAR RECOMENDACIONES', desc: 'Guardar picks validados en sección RECOMENDACIONES', phase: step4Phase },
  ]

  return (
    <div className="space-y-4">
      {/* Step cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => (
          <div key={i} className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold font-mono text-[#64748b]">PASO {i + 1}</span>
              <StepBadge phase={s.phase} />
            </div>
            <p className="text-xs font-semibold text-[#e2e8f0]">{s.label}</p>
            <p className="mt-0.5 text-[10px] text-[#475569]">{s.desc}</p>
          </div>
        ))}
      </div>

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
            ? `✅ ${summary.created} recomendación(es) guardada(s) — ve a RECOMENDACIONES → AGENTE PETER para verlas`
            : `⚠ Ninguna recomendación generada de ${summary.total} candidato(s) evaluado(s)`}
        </div>
      )}

      {/* Ticker badges */}
      {tickers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tickers.map(t => <TickerBadge key={t.ticker} t={t} />)}
        </div>
      )}

      {/* Log console */}
      {log.length > 0 && (
        <div
          ref={logRef}
          className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] p-4 font-mono text-[11px] text-[#64748b] overflow-y-auto"
          style={{ maxHeight: '280px' }}
        >
          {log.map((line, i) => (
            <div key={i} className="py-0.5 leading-relaxed" style={{ color: line.startsWith('✓') ? '#4ade80' : line.startsWith('✗') || line.startsWith('⛔') ? '#f87171' : line.startsWith('⚠') ? '#fbbf24' : '#64748b' }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
