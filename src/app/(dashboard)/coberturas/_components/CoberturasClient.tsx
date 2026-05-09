'use client'

import { useState } from 'react'
import type { PricingResult, OptionInput, HedgeAnalysis } from '@/lib/options/types'
import { analyzeHedge } from '@/lib/options/hedge'
import OptionsPricer from './OptionsPricer'
import GreeksPanel from './GreeksPanel'
import HedgeAnalyzer from './HedgeAnalyzer'
import PositionBuilder from './PositionBuilder'
import CfdsTrading from './CfdsTrading'
import FuturosPlaceholder from './FuturosPlaceholder'
import OpcionesAnalisisClient from './OpcionesAnalisisClient'
import BlackScholesCalculator from './BlackScholesCalculator'
import ImpliedVolatilityAnalysis from './ImpliedVolatilityAnalysis'
import FairValueComparison from './FairValueComparison'

interface PricingState {
  result: PricingResult
  input: OptionInput
}

type MainTab = 'opciones' | 'cfds' | 'futuros'
type SubTab = 'analisis' | 'pricing'
type ToolTab = 'bs' | 'greeks' | 'iv' | 'fv'

interface OpcionesTabProps {
  activeSubTab: SubTab
  activeToolTab: ToolTab
  tickerData?: any // Datos del ticker analizado
}

function OpcionesTab({ activeSubTab, activeToolTab, tickerData }: OpcionesTabProps) {
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

  // Renderizar herramienta activa si estamos en modo Manual
  if (activeSubTab === 'pricing') {
    switch (activeToolTab) {
      case 'bs':
        return <BlackScholesCalculator />
      case 'greeks':
        return (
          <div className="space-y-6">
            <div className="rounded-xl border border-[#1e2035] bg-[#0f0f17] p-6">
              <h2 className="text-[9px] font-mono font-bold tracking-[0.15em] text-[#374151] uppercase mb-4">
                Parámetros Black-Scholes
              </h2>
              <OptionsPricer onResult={handleResult} />
            </div>
            {pricing && <GreeksPanel result={pricing.result} />}
          </div>
        )
      case 'iv':
        return (
          <ImpliedVolatilityAnalysis 
            currentIV={tickerData?.underlying?.fundamentals?.beta} // Ejemplo usando beta como proxy
            ticker={tickerData?.underlying?.ticker}
          />
        )
      case 'fv':
        return (
          <FairValueComparison 
            currentPrice={tickerData?.underlying?.underlyingPrice}
            fairValue={tickerData?.underlying?.fundamentals?.targetMeanPrice}
            ticker={tickerData?.underlying?.ticker}
            fundamentals={tickerData?.underlying?.fundamentals}
          />
        )
      default:
        return <BlackScholesCalculator />
    }
  }

  // Modo Automático (análisis de opciones)
  return (
    <div className="space-y-6">
      <OpcionesAnalisisClient onAnalysisComplete={handleTickerAnalysis} />
      
      {/* Mostrar herramienta activa también en modo Automático */}
      {activeToolTab !== 'bs' && (
        <div className="mt-6">
          {activeToolTab === 'iv' && (
            <ImpliedVolatilityAnalysis 
              currentIV={tickerData?.underlying?.fundamentals?.beta}
              ticker={tickerData?.underlying?.ticker}
            />
          )}
          {activeToolTab === 'fv' && (
            <FairValueComparison 
              currentPrice={tickerData?.underlying?.underlyingPrice}
              fairValue={tickerData?.underlying?.fundamentals?.targetMeanPrice}
              ticker={tickerData?.underlying?.ticker}
              fundamentals={tickerData?.underlying?.fundamentals}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default function CoberturasClient() {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('opciones')
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('analisis')
  const [activeToolTab, setActiveToolTab] = useState<ToolTab>('bs')
  const [tickerData, setTickerData] = useState<any>(null)

  // Función para recibir datos del análisis de opciones
  const handleTickerAnalysis = (data: any) => {
    setTickerData(data)
  }

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

      {/* Premium Horizontal Toolbar */}
      <div className="bg-[#0f0f17] border border-[#1e2035] rounded-xl p-3">
        <div className="grid grid-cols-3 gap-3">
          
          {/* Left Zone: Market Selector */}
          <div className="flex gap-1">
            {[
              { id: 'opciones' as MainTab, label: 'Opciones', icon: '⚡' },
              { id: 'cfds' as MainTab, label: 'CFDs', icon: '🎯' },
              { id: 'futuros' as MainTab, label: 'Futuros', icon: '🚀' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveMainTab(tab.id)}
                className={`px-3 py-2 text-xs font-mono tracking-widest rounded-lg border transition-all flex items-center gap-2 min-w-0 flex-1 justify-center ${
                  activeMainTab === tab.id
                    ? 'bg-[#F59E0B] text-black border-[#F59E0B] shadow-sm'
                    : 'bg-[#0f0f17] border-[#1e2035] text-[#64748b] hover:border-[#F59E0B] hover:bg-white/5'
                }`}
              >
                <span className="text-[10px]">{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>
          
          {/* Center Zone: Analysis Mode */}
          <div className="flex gap-1">
            {[
              { id: 'analisis' as SubTab, label: 'Automático', icon: '🤖' },
              { id: 'pricing' as SubTab, label: 'Manual', icon: '🧮' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`px-3 py-2 text-xs font-mono tracking-widest rounded-lg border transition-all flex items-center gap-2 min-w-0 flex-1 justify-center ${
                  activeSubTab === tab.id
                    ? 'bg-[#F59E0B]/20 border-[#F59E0B]/50 text-[#F59E0B] shadow-sm'
                    : 'bg-[#0f0f17] border-[#1e2035] text-[#64748b] hover:border-[#F59E0B] hover:bg-white/5'
                }`}
              >
                <span className="text-[10px]">{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>
          
          {/* Right Zone: Tools */}
          <div className="flex gap-1">
            {[
              { id: 'bs' as ToolTab, label: 'BS', icon: '📊', tooltip: 'Black-Scholes' },
              { id: 'greeks' as ToolTab, label: 'Greeks', icon: '📈', tooltip: 'Griegas' },
              { id: 'iv' as ToolTab, label: 'IV', icon: '📉', tooltip: 'Volatilidad Implícita' },
              { id: 'fv' as ToolTab, label: 'FV', icon: '💰', tooltip: 'Fair Value' },
            ].map(tool => (
              <button
                key={tool.id}
                onClick={() => setActiveToolTab(tool.id)}
                className={`px-2 py-2 text-xs font-mono tracking-widest rounded-lg border transition-all flex items-center gap-1 min-w-0 flex-1 justify-center group relative ${
                  activeToolTab === tool.id
                    ? 'bg-[#F59E0B]/20 border-[#F59E0B]/50 text-[#F59E0B] shadow-sm'
                    : 'bg-[#0f0f17] border-[#1e2035] text-[#64748b] hover:border-[#F59E0B] hover:bg-white/5'
                }`}
                title={tool.tooltip}
              >
                <span className="text-[10px]">{tool.icon}</span>
                <span className="truncate">{tool.label}</span>
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black/90 text-white text-[10px] px-2 py-1 rounded pointer-events-none whitespace-nowrap z-50">
                  {tool.tooltip}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content based on active tab */}
      <div className="mt-5">
        {activeMainTab === 'opciones' && (
          <OpcionesTab 
            activeSubTab={activeSubTab} 
            activeToolTab={activeToolTab}
            tickerData={tickerData}
          />
        )}
        {activeMainTab === 'cfds' && <CfdsTrading />}
        {activeMainTab === 'futuros' && <FuturosPlaceholder />}
      </div>
    </div>
  )
}
