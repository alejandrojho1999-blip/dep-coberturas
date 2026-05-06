'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { FarosResult } from '@/lib/faros/engine'

const AUTO_TICKERS = ['SPY', 'QQQ', 'GLD', 'TLT', 'USO', 'AAPL', 'MSFT', 'NVDA', 'BTC-USD', 'GC=F', 'AMZN', 'TSLA']

const TICKER_SUGGESTIONS = [
  // ETFs
  { ticker: 'SPY',   name: 'SPDR S&P 500 ETF' },
  { ticker: 'QQQ',   name: 'Invesco QQQ Trust (NASDAQ 100)' },
  { ticker: 'IWM',   name: 'iShares Russell 2000 ETF' },
  { ticker: 'DIA',   name: 'SPDR Dow Jones Industrial ETF' },
  { ticker: 'VTI',   name: 'Vanguard Total Stock Market ETF' },
  { ticker: 'TLT',   name: 'iShares 20+ Year Treasury Bond ETF' },
  { ticker: 'GLD',   name: 'SPDR Gold Shares ETF' },
  { ticker: 'USO',   name: 'United States Oil Fund ETF' },
  { ticker: 'XLF',   name: 'Financial Select Sector SPDR ETF' },
  { ticker: 'XLE',   name: 'Energy Select Sector SPDR ETF' },
  { ticker: 'XLK',   name: 'Technology Select Sector SPDR ETF' },
  { ticker: 'XLV',   name: 'Health Care Select Sector SPDR ETF' },
  // Mega cap tech
  { ticker: 'AAPL',  name: 'Apple Inc.' },
  { ticker: 'MSFT',  name: 'Microsoft Corporation' },
  { ticker: 'NVDA',  name: 'NVIDIA Corporation' },
  { ticker: 'GOOGL', name: 'Alphabet Inc. (Class A)' },
  { ticker: 'GOOG',  name: 'Alphabet Inc. (Class C)' },
  { ticker: 'AMZN',  name: 'Amazon.com Inc.' },
  { ticker: 'META',  name: 'Meta Platforms Inc.' },
  { ticker: 'TSLA',  name: 'Tesla Inc.' },
  { ticker: 'AVGO',  name: 'Broadcom Inc.' },
  { ticker: 'ORCL',  name: 'Oracle Corporation' },
  { ticker: 'CRM',   name: 'Salesforce Inc.' },
  { ticker: 'ADBE',  name: 'Adobe Inc.' },
  { ticker: 'AMD',   name: 'Advanced Micro Devices Inc.' },
  { ticker: 'QCOM',  name: 'Qualcomm Inc.' },
  { ticker: 'TXN',   name: 'Texas Instruments Inc.' },
  { ticker: 'INTC',  name: 'Intel Corporation' },
  { ticker: 'NFLX',  name: 'Netflix Inc.' },
  { ticker: 'CSCO',  name: 'Cisco Systems Inc.' },
  { ticker: 'IBM',   name: 'IBM Corporation' },
  { ticker: 'NOW',   name: 'ServiceNow Inc.' },
  { ticker: 'PANW',  name: 'Palo Alto Networks Inc.' },
  { ticker: 'CRWD',  name: 'CrowdStrike Holdings Inc.' },
  { ticker: 'SNOW',  name: 'Snowflake Inc.' },
  { ticker: 'PLTR',  name: 'Palantir Technologies Inc.' },
  { ticker: 'NET',   name: 'Cloudflare Inc.' },
  { ticker: 'DDOG',  name: 'Datadog Inc.' },
  { ticker: 'ZS',    name: 'Zscaler Inc.' },
  { ticker: 'ANET',  name: 'Arista Networks Inc.' },
  { ticker: 'MU',    name: 'Micron Technology Inc.' },
  { ticker: 'LRCX',  name: 'Lam Research Corporation' },
  { ticker: 'KLAC',  name: 'KLA Corporation' },
  { ticker: 'AMAT',  name: 'Applied Materials Inc.' },
  { ticker: 'ASML',  name: 'ASML Holding N.V.' },
  { ticker: 'MRVL',  name: 'Marvell Technology Inc.' },
  // Financials
  { ticker: 'BRK-B', name: 'Berkshire Hathaway Inc.' },
  { ticker: 'JPM',   name: 'JPMorgan Chase & Co.' },
  { ticker: 'BAC',   name: 'Bank of America Corporation' },
  { ticker: 'WFC',   name: 'Wells Fargo & Company' },
  { ticker: 'GS',    name: 'Goldman Sachs Group Inc.' },
  { ticker: 'MS',    name: 'Morgan Stanley' },
  { ticker: 'BLK',   name: 'BlackRock Inc.' },
  { ticker: 'V',     name: 'Visa Inc.' },
  { ticker: 'MA',    name: 'Mastercard Incorporated' },
  { ticker: 'AXP',   name: 'American Express Company' },
  { ticker: 'SCHW',  name: 'Charles Schwab Corporation' },
  { ticker: 'COF',   name: 'Capital One Financial Corporation' },
  { ticker: 'PYPL',  name: 'PayPal Holdings Inc.' },
  { ticker: 'SQ',    name: 'Block Inc.' },
  { ticker: 'BX',    name: 'Blackstone Inc.' },
  { ticker: 'KKR',   name: 'KKR & Co. Inc.' },
  { ticker: 'CME',   name: 'CME Group Inc.' },
  { ticker: 'ICE',   name: 'Intercontinental Exchange Inc.' },
  // Healthcare
  { ticker: 'UNH',   name: 'UnitedHealth Group Inc.' },
  { ticker: 'LLY',   name: 'Eli Lilly and Company' },
  { ticker: 'JNJ',   name: 'Johnson & Johnson' },
  { ticker: 'ABT',   name: 'Abbott Laboratories' },
  { ticker: 'MRK',   name: 'Merck & Co. Inc.' },
  { ticker: 'ABBV',  name: 'AbbVie Inc.' },
  { ticker: 'PFE',   name: 'Pfizer Inc.' },
  { ticker: 'AMGN',  name: 'Amgen Inc.' },
  { ticker: 'GILD',  name: 'Gilead Sciences Inc.' },
  { ticker: 'VRTX',  name: 'Vertex Pharmaceuticals Inc.' },
  { ticker: 'REGN',  name: 'Regeneron Pharmaceuticals Inc.' },
  { ticker: 'ISRG',  name: 'Intuitive Surgical Inc.' },
  { ticker: 'SYK',   name: 'Stryker Corporation' },
  { ticker: 'MDT',   name: 'Medtronic plc' },
  { ticker: 'BSX',   name: 'Boston Scientific Corporation' },
  // Consumer
  { ticker: 'AMZN',  name: 'Amazon.com Inc.' },
  { ticker: 'HD',    name: 'Home Depot Inc.' },
  { ticker: 'MCD',   name: "McDonald's Corporation" },
  { ticker: 'NKE',   name: 'NIKE Inc.' },
  { ticker: 'SBUX',  name: 'Starbucks Corporation' },
  { ticker: 'LOW',   name: "Lowe's Companies Inc." },
  { ticker: 'TGT',   name: 'Target Corporation' },
  { ticker: 'WMT',   name: 'Walmart Inc.' },
  { ticker: 'COST',  name: 'Costco Wholesale Corporation' },
  { ticker: 'BKNG',  name: 'Booking Holdings Inc.' },
  { ticker: 'UBER',  name: 'Uber Technologies Inc.' },
  { ticker: 'ABNB',  name: 'Airbnb Inc.' },
  { ticker: 'LYFT',  name: 'Lyft Inc.' },
  { ticker: 'PG',    name: 'Procter & Gamble Company' },
  { ticker: 'KO',    name: 'Coca-Cola Company' },
  { ticker: 'PEP',   name: 'PepsiCo Inc.' },
  { ticker: 'PM',    name: 'Philip Morris International Inc.' },
  { ticker: 'MO',    name: 'Altria Group Inc.' },
  // Industrials / Energy
  { ticker: 'XOM',   name: 'Exxon Mobil Corporation' },
  { ticker: 'CVX',   name: 'Chevron Corporation' },
  { ticker: 'COP',   name: 'ConocoPhillips' },
  { ticker: 'OXY',   name: 'Occidental Petroleum Corporation' },
  { ticker: 'SLB',   name: 'SLB (Schlumberger)' },
  { ticker: 'LNG',   name: 'Cheniere Energy Inc.' },
  { ticker: 'HON',   name: 'Honeywell International Inc.' },
  { ticker: 'CAT',   name: 'Caterpillar Inc.' },
  { ticker: 'DE',    name: 'Deere & Company' },
  { ticker: 'GE',    name: 'GE Aerospace' },
  { ticker: 'RTX',   name: 'RTX Corporation' },
  { ticker: 'LMT',   name: 'Lockheed Martin Corporation' },
  { ticker: 'NOC',   name: 'Northrop Grumman Corporation' },
  { ticker: 'BA',    name: 'Boeing Company' },
  { ticker: 'UPS',   name: 'United Parcel Service Inc.' },
  { ticker: 'FDX',   name: 'FedEx Corporation' },
  { ticker: 'AXON',  name: 'Axon Enterprise Inc.' },
  // Telecom / Media
  { ticker: 'DIS',   name: 'Walt Disney Company' },
  { ticker: 'CMCSA', name: 'Comcast Corporation' },
  { ticker: 'T',     name: 'AT&T Inc.' },
  { ticker: 'VZ',    name: 'Verizon Communications Inc.' },
  { ticker: 'TMUS',  name: 'T-Mobile US Inc.' },
  { ticker: 'NWSA',  name: 'News Corp (Class A)' },
  { ticker: 'TTWO',  name: 'Take-Two Interactive Software Inc.' },
  { ticker: 'EA',    name: 'Electronic Arts Inc.' },
  // Real Estate / Utilities
  { ticker: 'AMT',   name: 'American Tower Corporation' },
  { ticker: 'PLD',   name: 'Prologis Inc.' },
  { ticker: 'EQIX',  name: 'Equinix Inc.' },
  { ticker: 'NEE',   name: 'NextEra Energy Inc.' },
  { ticker: 'DUK',   name: 'Duke Energy Corporation' },
  { ticker: 'SO',    name: 'Southern Company' },
  { ticker: 'ENPH',  name: 'Enphase Energy Inc.' },
  { ticker: 'FSLR',  name: 'First Solar Inc.' },
  // International
  { ticker: 'MELI',  name: 'MercadoLibre Inc.' },
  { ticker: 'SE',    name: 'Sea Limited' },
  { ticker: 'PDD',   name: 'PDD Holdings Inc.' },
  { ticker: 'BABA',  name: 'Alibaba Group Holding Ltd.' },
  { ticker: 'JD',    name: 'JD.com Inc.' },
  { ticker: 'NVO',   name: 'Novo Nordisk A/S' },
  { ticker: 'SAP',   name: 'SAP SE' },
  { ticker: 'TSM',   name: 'Taiwan Semiconductor Manufacturing' },
  { ticker: 'SONY',  name: 'Sony Group Corporation' },
  { ticker: 'TM',    name: 'Toyota Motor Corporation' },
  { ticker: 'NVS',   name: 'Novartis AG' },
  { ticker: 'SHOP',  name: 'Shopify Inc.' },
  // Crypto
  { ticker: 'BTC-USD',  name: 'Bitcoin USD' },
  { ticker: 'ETH-USD',  name: 'Ethereum USD' },
  { ticker: 'BNB-USD',  name: 'BNB USD' },
  { ticker: 'SOL-USD',  name: 'Solana USD' },
  { ticker: 'XRP-USD',  name: 'XRP USD' },
  { ticker: 'DOGE-USD', name: 'Dogecoin USD' },
  { ticker: 'ADA-USD',  name: 'Cardano USD' },
  { ticker: 'AVAX-USD', name: 'Avalanche USD' },
  { ticker: 'MATIC-USD',name: 'Polygon USD' },
  { ticker: 'LINK-USD', name: 'Chainlink USD' },
  { ticker: 'COIN',     name: 'Coinbase Global Inc.' },
  { ticker: 'MSTR',     name: 'MicroStrategy Inc.' },
  // Commodities / Futures
  { ticker: 'GC=F',  name: 'Gold Futures' },
  { ticker: 'SI=F',  name: 'Silver Futures' },
  { ticker: 'CL=F',  name: 'Crude Oil WTI Futures' },
  { ticker: 'NG=F',  name: 'Natural Gas Futures' },
  { ticker: 'ZC=F',  name: 'Corn Futures' },
  { ticker: 'ZW=F',  name: 'Wheat Futures' },
  { ticker: 'HG=F',  name: 'Copper Futures' },
  // FX
  { ticker: 'EURUSD=X', name: 'EUR/USD' },
  { ticker: 'GBPUSD=X', name: 'GBP/USD' },
  { ticker: 'USDJPY=X', name: 'USD/JPY' },
  { ticker: 'USDCAD=X', name: 'USD/CAD' },
  { ticker: 'DX-Y.NYB', name: 'US Dollar Index' },
  // Volatility
  { ticker: '^VIX', name: 'CBOE Volatility Index' },
  { ticker: '^GSPC', name: 'S&P 500 Index' },
  { ticker: '^IXIC', name: 'NASDAQ Composite Index' },
  { ticker: '^DJI',  name: 'Dow Jones Industrial Average' },
  { ticker: '^RUT',  name: 'Russell 2000 Index' },
] as const

const STATE_CONFIG = {
  'SÓLIDO':  { color: '#3b82f6', bg: '#3b82f610', label: 'SÓLIDO',  desc: 'Capital atrapado en rango. Baja energía cinética.', signal: 'Esperar / Acumular' },
  'LÍQUIDO': { color: '#22c55e', bg: '#22c55e10', label: 'LÍQUIDO', desc: 'Tendencia clara, volatilidad moderada. Zona óptima para operar.', signal: 'Invertir / Mantener' },
  'GAS':     { color: '#ef4444', bg: '#ef444410', label: 'GAS',     desc: 'Alta entropía. Caos o pánico. Movimiento extremo.', signal: 'Veto / Cash' },
  'PLASMA':  { color: '#a855f7', bg: '#a855f710', label: 'PLASMA',  desc: 'Burbuja especulativa. Iliquidez estructural.', signal: 'Veto / Short' },
} as const

const SIGNAL_CONFIG = {
  BUY:  { color: '#22c55e', bg: '#22c55e15', label: 'BUY' },
  HOLD: { color: '#F59E0B', bg: '#F59E0B15', label: 'HOLD' },
  SELL: { color: '#ef4444', bg: '#ef444415', label: 'SELL' },
  CASH: { color: '#64748b', bg: '#64748b15', label: 'CASH' },
}

const REGIME_LABELS: Record<string, string> = {
  INSTITUTIONAL_ACCUMULATION: 'ACUMULACIÓN INSTITUCIONAL',
  HIGH_MOMENTUM: 'ALTO MOMENTUM',
  CONSOLIDATION: 'CONSOLIDACIÓN',
  DISTRIBUTION_BEAR: 'DISTRIBUCIÓN / BAJISTA',
  STRUCTURAL_BREAK: 'RUPTURA ESTRUCTURAL — KILL SWITCH',
}

function PsiBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[#1e2035] overflow-hidden">
        <div className="h-full rounded-full bg-[#F59E0B] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-[#F59E0B] w-8 text-right">{pct}%</span>
    </div>
  )
}

function AssetCard({ r }: { r: FarosResult }) {
  const sc = STATE_CONFIG[r.state]
  const sig = SIGNAL_CONFIG[r.signal]
  return (
    <div
      className="rounded-lg border bg-[#0f0f17] p-4 flex flex-col gap-2"
      style={{ borderColor: sig.color + '40' }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold font-mono text-[#F59E0B]">{r.ticker}</p>
          <p className="text-[10px] text-[#475569] truncate max-w-[140px]">{r.name}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs font-bold font-mono rounded px-1.5 py-0.5 border text-[10px]"
            style={{ color: sig.color, borderColor: sig.color + '40', backgroundColor: sig.bg }}>
            {sig.label}
          </span>
          <span className="text-[9px] font-mono rounded px-1.5 py-0.5 border"
            style={{ color: sc.color, borderColor: sc.color + '40', backgroundColor: sc.bg }}>
            {sc.label}
          </span>
        </div>
      </div>

      <div className="flex justify-between text-[10px] font-mono text-[#94a3b8]">
        <span>P: <span className="text-[#F0EFE8]">${r.price.toFixed(2)}</span></span>
        <span>5d: <span className={r.momentum5d >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
          {r.momentum5d >= 0 ? '+' : ''}{(r.momentum5d * 100).toFixed(1)}%
        </span></span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[9px] font-mono">
        <div>
          <p className="text-[#374151] uppercase tracking-widest">Reynolds</p>
          <p className="text-[#F0EFE8]">{r.reynoldsPercentile.toFixed(0)}%ile</p>
        </div>
        <div>
          <p className="text-[#374151] uppercase tracking-widest">Entropía</p>
          <p className="text-[#F0EFE8]">{(r.entropy * 100).toFixed(0)}%</p>
        </div>
        <div>
          <p className="text-[#374151] uppercase tracking-widest">αflow</p>
          <p className="text-[#F0EFE8]">{r.alphaFlow.toFixed(2)}</p>
        </div>
      </div>

      <div>
        <p className="text-[9px] font-mono text-[#374151] uppercase tracking-widest mb-1">Ψ Gobernanza</p>
        <PsiBar value={r.psi} />
      </div>
    </div>
  )
}

function DetailCard({ r }: { r: FarosResult }) {
  const sc = STATE_CONFIG[r.state]
  const sig = SIGNAL_CONFIG[r.signal]
  return (
    <div className="rounded-lg border bg-[#0f0f17] p-5" style={{ borderColor: sig.color + '50' }}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h3 className="text-lg font-bold font-mono text-[#F59E0B]">{r.ticker}</h3>
        <p className="text-sm text-[#64748b]">{r.name}</p>
        <span className="ml-auto text-xl font-bold font-mono">${r.price.toFixed(2)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
        {[
          { label: 'Estado', value: r.state, color: sc.color },
          { label: 'Régimen', value: REGIME_LABELS[r.regime] ?? r.regime, color: sig.color },
          { label: 'Señal', value: r.signal, color: sig.color },
          { label: 'Momentum 5d', value: `${r.momentum5d >= 0 ? '+' : ''}${(r.momentum5d * 100).toFixed(2)}%`, color: r.momentum5d >= 0 ? '#22c55e' : '#ef4444' },
        ].map((item) => (
          <div key={item.label} className="rounded border border-[#1e2035] bg-[#07070b] p-3">
            <p className="text-[9px] font-mono uppercase tracking-widest text-[#374151] mb-1">{item.label}</p>
            <p className="text-sm font-bold font-mono" style={{ color: item.color }}>{item.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
        {[
          { label: 'Z-Score', value: r.zScore.toFixed(3) },
          { label: 'Reynolds %ile', value: `${r.reynoldsPercentile.toFixed(1)}%ile` },
          { label: 'Entropía H', value: `${(r.entropy * 100).toFixed(1)}%` },
          { label: 'α Flow', value: r.alphaFlow.toFixed(3) },
        ].map((item) => (
          <div key={item.label} className="rounded border border-[#1e2035] bg-[#07070b] p-3">
            <p className="text-[9px] font-mono uppercase tracking-widest text-[#374151] mb-1">{item.label}</p>
            <p className="text-sm font-bold font-mono text-[#F0EFE8] tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="text-[9px] font-mono uppercase tracking-widest text-[#374151] mb-1">Ψ Gobernanza (% capital asignado)</p>
        <PsiBar value={r.psi} />
      </div>
    </div>
  )
}

type TickerSuggestion = { ticker: string; name: string }

export function FarosClient() {
  const [autoResults, setAutoResults] = useState<(FarosResult | null)[]>(Array(AUTO_TICKERS.length).fill(null))
  const [autoLoading, setAutoLoading] = useState(true)

  const [searchTicker, setSearchTicker] = useState('')
  const [searchResult, setSearchResult] = useState<FarosResult | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<TickerSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.allSettled(
      AUTO_TICKERS.map((t) => fetch(`/api/faros/analyze?ticker=${t}`).then((r) => r.json() as Promise<FarosResult>))
    ).then((settled) => {
      setAutoResults(settled.map((s) => s.status === 'fulfilled' ? s.value : null))
      setAutoLoading(false)
    })
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const runSearch = useCallback(async (ticker: string) => {
    const t = ticker.trim().toUpperCase()
    if (!t) return
    setShowSuggestions(false)
    setSearchLoading(true)
    setSearchError(null)
    setSearchResult(null)
    try {
      const res = await fetch(`/api/faros/analyze?ticker=${t}`)
      const data = await res.json() as FarosResult & { error?: string }
      if (data.error) throw new Error(data.error)
      setSearchResult(data)
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const handleSearch = useCallback(() => runSearch(searchTicker), [runSearch, searchTicker])

  const handleInputChange = (val: string) => {
    setSearchTicker(val.toUpperCase())
    const q = val.toLowerCase()
    if (!q) { setSuggestions([]); setShowSuggestions(false); return }
    const filtered = (TICKER_SUGGESTIONS as readonly TickerSuggestion[]).filter(
      (s) => s.ticker.toLowerCase().startsWith(q) || s.name.toLowerCase().includes(q)
    ).slice(0, 8)
    setSuggestions(filtered)
    setShowSuggestions(filtered.length > 0)
  }

  const handleSelect = (item: TickerSuggestion) => {
    setSearchTicker(item.ticker)
    setSuggestions([])
    setShowSuggestions(false)
    void runSearch(item.ticker)
  }

  return (
    <div className="min-h-screen bg-[#07070b] px-4 py-6 text-[#F0EFE8] lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold font-mono tracking-tight">METODOLOGÍA FAROS v7.0</h1>
          <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30 font-mono text-[10px]">
            TAI-ACF Framework
          </Badge>
        </div>
        <p className="text-[#64748b] text-sm font-mono">
          Future-Oriented Actor-Critic System — Hidrodinámica Financiera & Gobernanza Artificial
        </p>
        <p className="text-[#374151] text-xs font-mono mt-1">
          Juan Arroyo · CEO, Emporium Quality Funds | COO, SG Consulting Group
        </p>
      </div>

      {/* Ticker Search */}
      <section className="mb-8">
        <p className="text-[9px] font-mono font-bold tracking-[0.15em] uppercase text-[#374151] mb-3">
          Analizar Activo
        </p>
        <div className="flex gap-3 mb-4">
          <div ref={wrapperRef} className="relative">
            <input
              type="text" placeholder="Ej: NVDA, AAPL, BTC-USD..."
              value={searchTicker}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { void handleSearch() }
                if (e.key === 'Escape') setShowSuggestions(false)
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              className="rounded border border-[#1e2035] bg-[#0f0f17] px-4 py-2 text-sm font-mono text-[#F0EFE8] outline-none focus:border-[#F59E0B] transition-colors w-64"
            />
            {showSuggestions && (
              <ul className="absolute top-full left-0 mt-1 w-full z-50 rounded border border-[#1e2035] bg-[#0f0f17] shadow-xl overflow-hidden">
                {suggestions.map((s) => (
                  <li
                    key={s.ticker}
                    onMouseDown={() => handleSelect(s)}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[#161622] transition-colors"
                  >
                    <span className="text-[11px] font-bold font-mono text-[#F59E0B] w-20 shrink-0">{s.ticker}</span>
                    <span className="text-[10px] font-mono text-[#64748b] truncate">{s.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={() => void handleSearch()}
            disabled={searchLoading}
            className="rounded border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-4 py-2 text-sm font-mono font-bold text-[#F59E0B] hover:bg-[#F59E0B]/20 transition-colors disabled:opacity-50"
          >
            {searchLoading ? 'Analizando...' : 'Analizar →'}
          </button>
        </div>
        {searchError && (
          <p className="text-xs font-mono text-[#ef4444] mb-3">Error: {searchError}</p>
        )}
        {searchResult && <DetailCard r={searchResult} />}
      </section>

      {/* Auto Analysis */}
      <section className="mb-8">
        <p className="text-[9px] font-mono font-bold tracking-[0.15em] uppercase text-[#374151] mb-3">
          Análisis Automático — 12 Activos Clave
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {AUTO_TICKERS.map((ticker, i) => (
            autoLoading || autoResults[i] == null ? (
              <div key={ticker} className="rounded-lg border border-[#1e2035] bg-[#0f0f17] p-4 space-y-3">
                <Skeleton className="h-4 w-20 bg-[#161622]" />
                <Skeleton className="h-3 w-32 bg-[#161622]" />
                <Skeleton className="h-3 w-full bg-[#161622]" />
                <Skeleton className="h-2 w-full bg-[#161622]" />
              </div>
            ) : (
              <AssetCard key={ticker} r={autoResults[i]!} />
            )
          ))}
        </div>
      </section>

      {/* Thermodynamic States */}
      <section className="mb-8">
        <p className="text-[9px] font-mono font-bold tracking-[0.15em] uppercase text-[#374151] mb-3">
          Estados Termodinámicos del Capital
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(Object.entries(STATE_CONFIG) as [string, typeof STATE_CONFIG[keyof typeof STATE_CONFIG]][]).map(([, cfg]) => (
            <div key={cfg.label} className="rounded-lg border bg-[#0f0f17] p-4" style={{ borderColor: cfg.color + '40' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cfg.color, boxShadow: `0 0 8px ${cfg.color}60` }} />
                <p className="text-sm font-bold font-mono" style={{ color: cfg.color }}>{cfg.label}</p>
              </div>
              <p className="text-xs text-[#64748b] leading-relaxed mb-2">{cfg.desc}</p>
              <p className="text-[9px] font-mono text-[#374151] uppercase tracking-wider">Señal</p>
              <p className="text-xs font-mono" style={{ color: cfg.color }}>{cfg.signal}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Reynolds Regimes Table */}
      <section className="mb-8">
        <p className="text-[9px] font-mono font-bold tracking-[0.15em] uppercase text-[#374151] mb-3">
          Regímenes — Número de Reynolds Financiero
        </p>
        <div className="rounded-lg border border-[#1e2035] bg-[#0f0f17] overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1e2035]">
                {['Régimen', 'Reynolds %ile', 'Comportamiento', 'Señal FAROS'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { regime: 'ACUMULACIÓN INSTITUCIONAL', re: '< 75%ile + trend > +2%', behavior: 'Flujo ordenado, tendencia predecible', signal: 'BUY', color: '#22c55e' },
                { regime: 'ALTO MOMENTUM', re: '> 75%ile + trend > +10%', behavior: 'Fuerzas inerciales altas, tendencia fuerte', signal: 'BUY ⚠', color: '#F59E0B' },
                { regime: 'CONSOLIDACIÓN', re: '< 75%ile, -5% a +2%', behavior: 'Vórtices de inestabilidad, volatilidad no-lineal', signal: 'HOLD', color: '#3b82f6' },
                { regime: 'DISTRIBUCIÓN / BAJISTA', re: '< 75%ile + trend < -5%', behavior: 'Salida de capital institucional', signal: 'SELL', color: '#ef4444' },
                { regime: 'RUPTURA ESTRUCTURAL', re: '> 75%ile', behavior: 'Caos. Fundamentales desconectados del precio', signal: 'KILL SWITCH', color: '#a855f7' },
              ].map((row) => (
                <tr key={row.regime} className="border-b border-[#1e2035] hover:bg-[#161622] transition-colors">
                  <td className="px-4 py-3 font-bold text-[#F0EFE8]">{row.regime}</td>
                  <td className="px-4 py-3 text-[#64748b]">{row.re}</td>
                  <td className="px-4 py-3 text-[#64748b]">{row.behavior}</td>
                  <td className="px-4 py-3">
                    <span className="rounded px-2 py-0.5 text-[10px] font-bold border" style={{ color: row.color, borderColor: row.color + '40', backgroundColor: row.color + '15' }}>
                      {row.signal}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Governance Equation */}
      <section className="mb-8">
        <p className="text-[9px] font-mono font-bold tracking-[0.15em] uppercase text-[#374151] mb-3">
          Ecuación de Gobernanza Ψ
        </p>
        <div className="rounded-lg border border-[#1e2035] bg-[#0f0f17] p-5 mb-4">
          <p className="text-center text-base font-mono text-[#F0EFE8] tracking-wider mb-1">
            Ψ = tanh( <span className="text-[#22c55e]">M · α<sub>flow</sub></span> / <span className="text-[#ef4444]">Re<sup>γ</sup></span> ) · <span className="text-[#3b82f6]">I(Z ∈ Líquido)</span>
          </p>
          <p className="text-center text-[10px] font-mono text-[#374151]">Ψ ∈ [0, 1] — porcentaje de capital asignado al mercado</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { color: '#22c55e', title: 'Motor — M · αflow', desc: 'Impulso monetario autenticado por entropía. Si el flujo es fuerte pero artificial (α → 0), el numerador se anula.' },
            { color: '#ef4444', title: 'Freno — Re^γ',      desc: 'La turbulencia actúa como resistencia viscosa. Si Reynolds → ∞, entonces Ψ → 0 (salida forzada del mercado).' },
            { color: '#3b82f6', title: 'Veto Topológico — I(Z)',  desc: 'Booleano. Si el mercado está en estado Sólido o Gas, bloquea toda operación. Solo opera en estado Líquido.' },
          ].map((c) => (
            <div key={c.title} className="rounded-lg border bg-[#07070b] p-4" style={{ borderColor: c.color + '40' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                <p className="text-xs font-bold font-mono" style={{ color: c.color }}>{c.title}</p>
              </div>
              <p className="text-xs text-[#64748b] leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FutureScore */}
      <section>
        <p className="text-[9px] font-mono font-bold tracking-[0.15em] uppercase text-[#374151] mb-3">
          FutureScore — El ADN de la Empresa
        </p>
        <div className="rounded-lg border border-[#1e2035] bg-[#0f0f17] p-4 mb-4">
          <p className="text-center text-sm font-mono text-[#F0EFE8]">
            FutureScore = <span className="text-[#F59E0B]">E</span> · <span className="text-[#22c55e]">A</span> · <span className="text-[#3b82f6]">X</span> · <span className="text-[#a855f7]">F</span>
          </p>
          <p className="text-center text-[10px] font-mono text-[#374151] mt-1">F = Probabilidad × Impacto × Horizonte temporal</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { letter: 'E', color: '#F59E0B', dim: 'Exposición', var_: '% ingresos en la tendencia', q: '¿Cuánto del negocio depende de esta ola tecnológica?' },
            { letter: 'A', color: '#22c55e', dim: 'Ventaja',    var_: 'Moat tecnológico / regulatorio', q: '¿Tiene foso defensivo que impida la competencia directa?' },
            { letter: 'X', color: '#3b82f6', dim: 'Ejecución',  var_: 'Track record de hitos', q: '¿La gerencia ha demostrado capacidad de entregar resultados?' },
            { letter: 'F', color: '#a855f7', dim: 'Fuerza',     var_: 'P × I × H', q: '¿La tendencia macro es real, grande e inminente?' },
          ].map((d) => (
            <div key={d.letter} className="rounded-lg border bg-[#07070b] p-4" style={{ borderColor: d.color + '40' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-bold font-mono" style={{ color: d.color }}>{d.letter}</span>
                <div>
                  <p className="text-xs font-bold font-mono text-[#F0EFE8]">{d.dim}</p>
                  <p className="text-[9px] font-mono text-[#374151]">{d.var_}</p>
                </div>
              </div>
              <p className="text-[10px] text-[#64748b] leading-relaxed italic">&ldquo;{d.q}&rdquo;</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
