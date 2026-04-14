'use client'

import { useState } from 'react'
import type { PricingResult, OptionInput, HedgeAnalysis } from '@/lib/options/types'
import { analyzeHedge } from '@/lib/options/hedge'
import OptionsPricer from './OptionsPricer'
import GreeksPanel from './GreeksPanel'
import HedgeAnalyzer from './HedgeAnalyzer'

interface PricingState {
  result: PricingResult
  input: OptionInput
}

export default function CoberturasClient() {
  const [pricing, setPricing] = useState<PricingState | null>(null)

  function handleResult(result: PricingResult, input: OptionInput) {
    setPricing({ result, input })
  }

  const hedgeData = pricing
    ? (() => {
        const { input } = pricing
        const positions = [
          {
            type: input.type,
            quantity: 1,
            S: input.S,
            K: input.K,
            T: input.T,
            r: input.r,
            sigma: input.sigma,
          },
        ] as const
        const analysis: HedgeAnalysis = analyzeHedge([...positions], input)
        return { analysis, hedgingOption: input }
      })()
    : null

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
          <OptionsPricer onResult={handleResult} />
        </div>

        {/* Greeks result */}
        <div>
          {pricing ? (
            <GreeksPanel result={pricing.result} />
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

      {/* Hedge analyzer — shown after first calculation */}
      {hedgeData && (
        <HedgeAnalyzer
          analysis={hedgeData.analysis}
          hedgingOption={hedgeData.hedgingOption}
        />
      )}
    </div>
  )
}
