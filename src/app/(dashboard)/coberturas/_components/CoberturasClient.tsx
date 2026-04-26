'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { PricingResult, OptionInput, HedgeAnalysis } from '@/lib/options/types'
import { analyzeHedge } from '@/lib/options/hedge'
import OptionsPricer from './OptionsPricer'
import GreeksPanel from './GreeksPanel'
import HedgeAnalyzer from './HedgeAnalyzer'
import PositionBuilder from './PositionBuilder'
import CfdsTrading from './CfdsTrading'
import FuturosPlaceholder from './FuturosPlaceholder'

interface PricingState {
  result: PricingResult
  input: OptionInput
}

function OpcionesTab() {
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[#1e2035] bg-[#0f0f17] p-6">
          <h2 className="text-[9px] font-mono font-bold tracking-[0.15em] text-[#374151] uppercase mb-4">
            Parámetros Black-Scholes
          </h2>
          <OptionsPricer onResult={handleResult} />
        </div>

        <div>
          {pricing ? (
            <GreeksPanel result={pricing.result} />
          ) : (
            <div className="rounded-xl border border-[#1e2035] bg-[#0f0f17] p-6 flex items-center justify-center h-full min-h-[200px]">
              <p className="text-[#64748b] text-sm text-center">
                Ingresa los parámetros y presiona{' '}
                <span className="text-[#F0EFE8]">Calcular</span>{' '}
                para ver el precio y las Greeks.
              </p>
            </div>
          )}
        </div>
      </div>

      {hedgeData && (
        <HedgeAnalyzer
          analysis={hedgeData.analysis}
          hedgingOption={hedgeData.hedgingOption}
        />
      )}

      <div className="border-t border-[#1e2035]" />

      <PositionBuilder defaultOption={pricing?.input ?? undefined} />
    </div>
  )
}

export default function CoberturasClient() {
  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold font-mono text-[#F0EFE8] tracking-tight">
          COBERTURAS
        </h1>
        <p className="text-xs text-[#64748b] mt-0.5 font-mono">
          Trading de opciones, CFDs y futuros · Análisis técnico MAIA
        </p>
      </div>

      <Tabs defaultValue="opciones">
        <div className="sticky top-0 z-10 bg-[#0a0a0f] overflow-x-auto pb-0.5">
          <TabsList className="bg-[#0f0f17] border border-[#1e2035] h-9 p-0.5 gap-0 min-w-max">
            {(['opciones', 'cfds', 'futuros'] as const).map(tab => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="font-mono text-[10px] font-bold tracking-[0.12em] uppercase px-3 sm:px-5 h-8 rounded-sm data-[state=active]:bg-[#161622] data-[state=active]:text-[#F59E0B] data-[state=inactive]:text-[#374151] data-[state=inactive]:hover:text-[#64748b] whitespace-nowrap"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="opciones" className="mt-5">
          <OpcionesTab />
        </TabsContent>

        <TabsContent value="cfds" className="mt-5">
          <CfdsTrading />
        </TabsContent>

        <TabsContent value="futuros" className="mt-5">
          <FuturosPlaceholder />
        </TabsContent>
      </Tabs>
    </div>
  )
}
