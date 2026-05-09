'use client'

import { useState } from 'react'

interface BlackScholesInputs {
  S: number // Precio subyacente
  K: number // Precio strike
  T: number // Tiempo hasta expiración (años)
  r: number // Tasa libre de riesgo
  sigma: number // Volatilidad
  type: 'call' | 'put'
}

interface BlackScholesResult {
  price: number
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
}

function calculateBlackScholes(inputs: BlackScholesInputs): BlackScholesResult {
  const { S, K, T, r, sigma, type } = inputs
  
  if (T <= 0) {
    return {
      price: type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0),
      delta: type === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0),
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0
    }
  }

  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)

  // Función de distribución normal acumulativa
  const normCDF = (x: number): number => {
    const a1 = 0.31938153
    const a2 = -0.356563782
    const a3 = 1.781477937
    const a4 = -1.821255978
    const a5 = 1.330274429
    const L = Math.abs(x)
    const K = 1 / (1 + 0.2316419 * L)
    let cdf = 1 - 1 / Math.sqrt(2 * Math.PI) * Math.exp(-L * L / 2) * (a1 * K + a2 * K * K + a3 * Math.pow(K, 3) + a4 * Math.pow(K, 4) + a5 * Math.pow(K, 5))
    
    if (x < 0) cdf = 1 - cdf
    return cdf
  }

  const normPDF = (x: number): number => {
    return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)
  }

  const callPrice = S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2)
  const putPrice = K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1)

  const price = type === 'call' ? callPrice : putPrice
  const delta = type === 'call' ? normCDF(d1) : normCDF(d1) - 1
  const gamma = normPDF(d1) / (S * sigma * Math.sqrt(T))
  const theta = -(S * normPDF(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normCDF(type === 'call' ? d2 : -d2)
  const vega = S * normPDF(d1) * Math.sqrt(T)
  const rho = K * T * Math.exp(-r * T) * normCDF(type === 'call' ? d2 : -d2)

  return {
    price: Math.max(price, 0),
    delta,
    gamma,
    theta,
    vega,
    rho
  }
}

export default function BlackScholesCalculator() {
  const [inputs, setInputs] = useState<BlackScholesInputs>({
    S: 100,
    K: 100,
    T: 0.25,
    r: 0.05,
    sigma: 0.2,
    type: 'call'
  })

  const result = calculateBlackScholes(inputs)

  const handleInputChange = (field: keyof BlackScholesInputs, value: string) => {
    const numValue = field === 'type' ? value : parseFloat(value) || 0
    setInputs(prev => ({
      ...prev,
      [field]: field === 'type' ? value : numValue
    }))
  }

  return (
    <div className="rounded-xl border border-[#1e2035] bg-[#0f0f17] p-6">
      <h2 className="text-[9px] font-mono font-bold tracking-[0.15em] text-[#374151] uppercase mb-4">
        CALCULADORA BLACK-SCHOLES
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-[10px] font-mono tracking-widest mb-2 text-[#64748b]">
            PRECIO SUBYACENTE (S)
          </label>
          <input
            type="number"
            value={inputs.S}
            onChange={(e) => handleInputChange('S', e.target.value)}
            className="w-full bg-[#0a0a0f] border border-[#1e2035] text-[#F0EFE8] text-sm px-3 py-2 rounded focus:outline-none focus:border-[#F59E0B] font-mono"
          />
        </div>
        
        <div>
          <label className="block text-[10px] font-mono tracking-widest mb-2 text-[#64748b]">
            PRECIO STRIKE (K)
          </label>
          <input
            type="number"
            value={inputs.K}
            onChange={(e) => handleInputChange('K', e.target.value)}
            className="w-full bg-[#0a0a0f] border border-[#1e2035] text-[#F0EFE8] text-sm px-3 py-2 rounded focus:outline-none focus:border-[#F59E0B] font-mono"
          />
        </div>
        
        <div>
          <label className="block text-[10px] font-mono tracking-widest mb-2 text-[#64748b]">
            TIEMPO (AÑOS) (T)
          </label>
          <input
            type="number"
            step="0.01"
            value={inputs.T}
            onChange={(e) => handleInputChange('T', e.target.value)}
            className="w-full bg-[#0a0a0f] border border-[#1e2035] text-[#F0EFE8] text-sm px-3 py-2 rounded focus:outline-none focus:border-[#F59E0B] font-mono"
          />
        </div>
        
        <div>
          <label className="block text-[10px] font-mono tracking-widest mb-2 text-[#64748b]">
            TASA LIBRE RIESGO (r)
          </label>
          <input
            type="number"
            step="0.01"
            value={inputs.r}
            onChange={(e) => handleInputChange('r', e.target.value)}
            className="w-full bg-[#0a0a0f] border border-[#1e2035] text-[#F0EFE8] text-sm px-3 py-2 rounded focus:outline-none focus:border-[#F59E0B] font-mono"
          />
        </div>
        
        <div>
          <label className="block text-[10px] font-mono tracking-widest mb-2 text-[#64748b]">
            VOLATILIDAD (σ)
          </label>
          <input
            type="number"
            step="0.01"
            value={inputs.sigma}
            onChange={(e) => handleInputChange('sigma', e.target.value)}
            className="w-full bg-[#0a0a0f] border border-[#1e2035] text-[#F0EFE8] text-sm px-3 py-2 rounded focus:outline-none focus:border-[#F59E0B] font-mono"
          />
        </div>
        
        <div>
          <label className="block text-[10px] font-mono tracking-widest mb-2 text-[#64748b]">
            TIPO DE OPCIÓN
          </label>
          <select
            value={inputs.type}
            onChange={(e) => handleInputChange('type', e.target.value)}
            className="w-full bg-[#0a0a0f] border border-[#1e2035] text-[#F0EFE8] text-sm px-3 py-2 rounded focus:outline-none focus:border-[#F59E0B] font-mono"
          >
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
        </div>
      </div>

      {/* Resultados */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-[#1e2035] p-3 bg-[#0a0a0f]">
          <p className="text-[9px] font-mono tracking-widest mb-1 text-[#64748b]">PRECIO BS</p>
          <p className="text-lg font-bold text-[#F59E0B]">${result.price.toFixed(2)}</p>
        </div>
        
        <div className="rounded-lg border border-[#1e2035] p-3 bg-[#0a0a0f]">
          <p className="text-[9px] font-mono tracking-widest mb-1 text-[#64748b]">DELTA</p>
          <p className="text-lg font-bold text-[#F0EFE8]">{result.delta.toFixed(3)}</p>
        </div>
        
        <div className="rounded-lg border border-[#1e2035] p-3 bg-[#0a0a0f]">
          <p className="text-[9px] font-mono tracking-widest mb-1 text-[#64748b]">GAMMA</p>
          <p className="text-lg font-bold text-[#F0EFE8]">{result.gamma.toFixed(4)}</p>
        </div>
        
        <div className="rounded-lg border border-[#1e2035] p-3 bg-[#0a0a0f]">
          <p className="text-[9px] font-mono tracking-widest mb-1 text-[#64748b]">THETA</p>
          <p className="text-lg font-bold text-[#F0EFE8]">{result.theta.toFixed(4)}</p>
        </div>
        
        <div className="rounded-lg border border-[#1e2035] p-3 bg-[#0a0a0f]">
          <p className="text-[9px] font-mono tracking-widest mb-1 text-[#64748b]">VEGA</p>
          <p className="text-lg font-bold text-[#F0EFE8]">{result.vega.toFixed(4)}</p>
        </div>
        
        <div className="rounded-lg border border-[#1e2035] p-3 bg-[#0a0a0f]">
          <p className="text-[9px] font-mono tracking-widest mb-1 text-[#64748b]">RHO</p>
          <p className="text-lg font-bold text-[#F0EFE8]">{result.rho.toFixed(4)}</p>
        </div>
      </div>

      <div className="mt-4 text-[10px] text-[#64748b] font-mono">
        <p>Fórmula Black-Scholes: Precio teórico de opciones europeas</p>
      </div>
    </div>
  )
}