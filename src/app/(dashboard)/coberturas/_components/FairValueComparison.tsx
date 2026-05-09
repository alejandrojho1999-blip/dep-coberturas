'use client'

interface FairValueComparisonProps {
  currentPrice?: number
  fairValue?: number
  ticker?: string
  fundamentals?: {
    peForward?: number | null
    peTrailing?: number | null
    targetMeanPrice?: number | null
    analystConsensus?: string
  }
}

export default function FairValueComparison({ 
  currentPrice = 100, 
  fairValue = 110, 
  ticker = 'AAPL',
  fundamentals = {}
}: FairValueComparisonProps) {
  const premium = ((currentPrice - fairValue) / fairValue) * 100
  const isOvervalued = premium > 0
  
  const getValuationStatus = () => {
    const absPremium = Math.abs(premium)
    if (absPremium < 5) return { status: 'Justo', color: '#4ade80', description: 'Precio cercano al valor justo' }
    if (absPremium < 15) return { 
      status: isOvervalued ? 'Sobrevalorado' : 'Subvalorado', 
      color: '#F59E0B', 
      description: isOvervalued ? 'Posible sobrevaluación moderada' : 'Posible subvaluación moderada' 
    }
    return { 
      status: isOvervalued ? 'Muy Sobrevalorado' : 'Muy Subvalorado', 
      color: '#f87171', 
      description: isOvervalued ? 'Posible sobrevaluación significativa' : 'Posible subvaluación significativa' 
    }
  }

  const valuation = getValuationStatus()

  return (
    <div className="rounded-xl border border-[#1e2035] bg-[#0f0f17] p-6">
      <h2 className="text-[9px] font-mono font-bold tracking-[0.15em] text-[#374151] uppercase mb-4">
        ANÁLISIS FAIR VALUE
      </h2>
      
      {ticker && (
        <p className="text-xs text-[#64748b] mb-4 font-mono">
          Ticker: <span className="text-[#F59E0B]">{ticker}</span>
        </p>
      )}

      {/* Comparación principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="rounded-lg border border-[#1e2035] p-4 bg-[#0a0a0f]">
          <p className="text-[9px] font-mono tracking-widest mb-2 text-[#64748b]">PRECIO ACTUAL</p>
          <p className="text-3xl font-black text-[#F0EFE8]">${currentPrice.toFixed(2)}</p>
          <p className="text-xs text-[#64748b] mt-1">Precio de mercado</p>
        </div>
        
        <div className="rounded-lg border border-[#1e2035] p-4 bg-[#0a0a0f]">
          <p className="text-[9px] font-mono tracking-widest mb-2 text-[#64748b]">FAIR VALUE ESTIMADO</p>
          <p className="text-3xl font-black text-[#F59E0B]">${fairValue.toFixed(2)}</p>
          <p className="text-xs text-[#64748b] mt-1">Valor intrínseco estimado</p>
        </div>
      </div>

      {/* Diferencia y status */}
      <div className="rounded-lg border border-[#1e2035] p-4 bg-[#0a0a0f] mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-mono tracking-widest text-[#64748b]">DIFERENCIA</p>
          <span 
            className="text-sm font-bold font-mono px-3 py-1 rounded"
            style={{ 
              backgroundColor: `${valuation.color}20`, 
              color: valuation.color,
              border: `1px solid ${valuation.color}50`
            }}
          >
            {valuation.status}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs text-[#64748b] mb-1">
              <span>Subvalorado</span>
              <span>Sobrevalorado</span>
            </div>
            <div className="bg-[#1e2035] rounded-full h-2 overflow-hidden">
              <div 
                className="h-full transition-all"
                style={{
                  width: `${Math.abs(premium)}%`,
                  background: `linear-gradient(to ${isOvervalued ? 'right' : 'left'}, #4ade80, #F59E0B, #f87171)`,
                  marginLeft: isOvervalued ? '50%' : `${50 - Math.abs(premium)}%`
                }}
              />
            </div>
            <div className="flex justify-between text-[8px] text-[#64748b] mt-1">
              <span>-20%</span>
              <span>0%</span>
              <span>+20%</span>
            </div>
          </div>
          
          <div className="text-right">
            <p 
              className="text-xl font-black"
              style={{ color: valuation.color }}
            >
              {premium > 0 ? '+' : ''}{premium.toFixed(1)}%
            </p>
            <p className="text-[10px] text-[#64748b]">vs Fair Value</p>
          </div>
        </div>
        
        <p className="text-xs text-[#64748b] mt-3">{valuation.description}</p>
      </div>

      {/* Fundamentales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-[#1e2035] p-3 bg-[#0a0a0f]">
          <p className="text-[9px] font-mono tracking-widest mb-1 text-[#64748b]">P/E FWD</p>
          <p className="text-sm font-bold text-[#F0EFE8]">
            {fundamentals.peForward ? fundamentals.peForward.toFixed(1) : 'N/D'}
          </p>
        </div>
        
        <div className="rounded-lg border border-[#1e2035] p-3 bg-[#0a0a0f]">
          <p className="text-[9px] font-mono tracking-widest mb-1 text-[#64748b]">P/E TRAIL</p>
          <p className="text-sm font-bold text-[#F0EFE8]">
            {fundamentals.peTrailing ? fundamentals.peTrailing.toFixed(1) : 'N/D'}
          </p>
        </div>
        
        <div className="rounded-lg border border-[#1e2035] p-3 bg-[#0a0a0f]">
          <p className="text-[9px] font-mono tracking-widest mb-1 text-[#64748b]">TARGET</p>
          <p className="text-sm font-bold text-[#F59E0B]">
            {fundamentals.targetMeanPrice ? `$${fundamentals.targetMeanPrice.toFixed(1)}` : 'N/D'}
          </p>
        </div>
        
        <div className="rounded-lg border border-[#1e2035] p-3 bg-[#0a0a0f]">
          <p className="text-[9px] font-mono tracking-widest mb-1 text-[#64748b]">CONSENSO</p>
          <p className="text-sm font-bold text-[#F0EFE8]">
            {fundamentals.analystConsensus || 'N/D'}
          </p>
        </div>
      </div>

      <div className="mt-4 text-[10px] text-[#64748b] font-mono">
        <p>Fair Value estimado basado en análisis fundamental y comparables.</p>
      </div>
    </div>
  )
}