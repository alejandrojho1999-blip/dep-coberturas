'use client'

import { useState } from 'react'

interface IVAnalysisProps {
  currentIV?: number
  historicalIV?: number[]
  ticker?: string
}

export default function ImpliedVolatilityAnalysis({ currentIV, historicalIV, ticker }: IVAnalysisProps) {
  const [range, setRange] = useState<'1m' | '3m' | '6m' | '1y'>('3m')

  // Datos de ejemplo si no se proporcionan
  const defaultHistoricalIV = [0.25, 0.28, 0.22, 0.30, 0.26, 0.29, 0.24, 0.31]
  const ivData = historicalIV || defaultHistoricalIV
  const currentVol = currentIV || 0.27

  const getRangeLabel = () => {
    switch (range) {
      case '1m': return '1 Mes'
      case '3m': return '3 Meses'
      case '6m': return '6 Meses'
      case '1y': return '1 Año'
    }
  }

  const getStats = () => {
    const avg = ivData.reduce((a, b) => a + b, 0) / ivData.length
    const max = Math.max(...ivData)
    const min = Math.min(...ivData)
    const percentile = ivData.filter(v => v <= currentVol).length / ivData.length * 100
    
    return { avg, max, min, percentile }
  }

  const stats = getStats()

  return (
    <div className="rounded-xl border border-[#1e2035] bg-[#0f0f17] p-6">
      <h2 className="text-[9px] font-mono font-bold tracking-[0.15em] text-[#374151] uppercase mb-4">
        ANÁLISIS VOLATILIDAD IMPLÍCITA
      </h2>
      
      {ticker && (
        <p className="text-xs text-[#64748b] mb-4 font-mono">
          Ticker: <span className="text-[#F59E0B]">{ticker}</span>
        </p>
      )}

      {/* Selector de rango */}
      <div className="flex gap-2 mb-6">
        {(['1m', '3m', '6m', '1y'] as const).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 text-xs font-mono rounded border transition-colors ${
              range === r
                ? 'bg-[#F59E0B] text-black border-[#F59E0B]'
                : 'bg-[#0a0a0f] border-[#1e2035] text-[#64748b] hover:border-[#F59E0B]'
            }`}
          >
            {r === '1m' ? '1M' : r === '3m' ? '3M' : r === '6m' ? '6M' : '1Y'}
          </button>
        ))}
      </div>

      {/* Estadísticas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border border-[#1e2035] p-3 bg-[#0a0a0f]">
          <p className="text-[9px] font-mono tracking-widest mb-1 text-[#64748b]">ACTUAL</p>
          <p className="text-lg font-bold text-[#F59E0B]">{(currentVol * 100).toFixed(1)}%</p>
        </div>
        
        <div className="rounded-lg border border-[#1e2035] p-3 bg-[#0a0a0f]">
          <p className="text-[9px] font-mono tracking-widest mb-1 text-[#64748b]">PROMEDIO</p>
          <p className="text-lg font-bold text-[#F0EFE8]">{(stats.avg * 100).toFixed(1)}%</p>
        </div>
        
        <div className="rounded-lg border border-[#1e2035] p-3 bg-[#0a0a0f]">
          <p className="text-[9px] font-mono tracking-widest mb-1 text-[#64748b]">MÁXIMO</p>
          <p className="text-lg font-bold text-[#f87171]">{(stats.max * 100).toFixed(1)}%</p>
        </div>
        
        <div className="rounded-lg border border-[#1e2035] p-3 bg-[#0a0a0f]">
          <p className="text-[9px] font-mono tracking-widest mb-1 text-[#64748b]">MÍNIMO</p>
          <p className="text-lg font-bold text-[#4ade80]">{(stats.min * 100).toFixed(1)}%</p>
        </div>
      </div>

      {/* Gráfico simple de volatilidad */}
      <div className="mb-6">
        <p className="text-[10px] font-mono tracking-widest mb-3 text-[#64748b]">
          HISTORIAL VOLATILIDAD ({getRangeLabel()})
        </p>
        <div className="h-32 bg-[#0a0a0f] border border-[#1e2035] rounded-lg p-3 relative">
          <div className="flex items-end justify-between h-full">
            {ivData.map((iv, index) => (
              <div
                key={index}
                className="flex-1 mx-1 flex flex-col items-center"
                style={{ height: '100%' }}
              >
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${(iv / stats.max) * 100}%`,
                    backgroundColor: iv === currentVol ? '#F59E0B' : iv > stats.avg ? '#f87171' : '#4ade80'
                  }}
                />
                <span className="text-[8px] text-[#64748b] mt-1">{(iv * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-[#1e2035]" />
        </div>
      </div>

      {/* Análisis de percentil */}
      <div className="rounded-lg border border-[#1e2035] p-4 bg-[#0a0a0f]">
        <p className="text-[10px] font-mono tracking-widest mb-2 text-[#64748b]">PERCENTIL HISTÓRICO</p>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-[#1e2035] rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#4ade80] via-[#F59E0B] to-[#f87171] transition-all"
              style={{ width: `${stats.percentile}%` }}
            />
          </div>
          <span className="text-sm font-bold text-[#F0EFE8] font-mono">
            {stats.percentile.toFixed(0)}%
          </span>
        </div>
        <p className="text-xs text-[#64748b] mt-2">
          La volatilidad actual está en el percentil {stats.percentile.toFixed(0)} del histórico.
          {stats.percentile > 70 ? ' (Alta volatilidad)' : stats.percentile < 30 ? ' (Baja volatilidad)' : ' (Volatilidad normal)'}
        </p>
      </div>

      <div className="mt-4 text-[10px] text-[#64748b] font-mono">
        <p>La volatilidad implícita refleja las expectativas del mercado sobre movimientos futuros.</p>
      </div>
    </div>
  )
}