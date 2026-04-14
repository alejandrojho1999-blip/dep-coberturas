'use client'

import { useState } from 'react'
import type { PricingResult } from '@/lib/options/types'
import OptionsPricer from './OptionsPricer'
import GreeksPanel from './GreeksPanel'

export default function CoberturasClient() {
  const [result, setResult] = useState<PricingResult | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#e2e8f0]">Coberturas</h1>
        <p className="text-[#64748b] text-sm mt-1">
          Pricing de opciones Black-Scholes con Greeks en tiempo real
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pricer form */}
        <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-6">
          <h2 className="text-sm font-medium text-[#e2e8f0] mb-4">Parámetros</h2>
          <OptionsPricer onResult={setResult} />
        </div>

        {/* Greeks result */}
        <div>
          {result ? (
            <GreeksPanel result={result} />
          ) : (
            <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-6 flex items-center justify-center h-full min-h-[200px]">
              <p className="text-[#64748b] text-sm text-center">
                Ingresa los parámetros y presiona{' '}
                <span className="text-[#e2e8f0]">Calcular</span>{' '}
                para ver el precio y las Greeks.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
