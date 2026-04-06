export type NodeRole = 'treatment' | 'outcome' | 'confounder' | 'collider' | 'mediator'

export interface DAGNode {
  id: string
  role: NodeRole
  label: string
}

export interface DAGEdge {
  from: string
  to: string
  label?: string
}

export interface CausalConfig {
  ticker: string
  name: string
  treatment: string
  outcome: string
  horizon: number  // quarters
  confounders: string[]
  excluded: Record<string, string>  // variable -> reason (collider)
  mediators?: string[]
  dagEdges: DAGEdge[]
}

export interface DataRow {
  date: string  // ISO date
  [variable: string]: number | string
}

export interface OLSResult {
  coefficients: Record<string, number>   // variable -> β
  standardErrors: Record<string, number>
  tStats: Record<string, number>
  pValues: Record<string, number>
  r2: number
  r2adj: number
  n: number
  k: number  // number of predictors (excluding intercept)
  residuals: number[]
  fittedValues: number[]
}

export interface ModelComparison {
  naive: OLSResult
  withColliders: OLSResult
  causal: OLSResult
  signFlipDetected: boolean  // β_treatment sign differs between naive and withColliders
}

export interface PortfolioScore {
  score: number      // 0-100
  signal: 'AUMENTAR' | 'MANTENER' | 'REDUCIR'
  suggestedWeight: number  // percentage
  components: Record<string, number>
  stressTests: Array<{ variable: string; shockBps: number; impact: number }>
}

export interface BacktestFold {
  fold: number
  beta: number
  r2oos: number
  ic: number        // Spearman IC
  signCorrect: boolean
}

export interface BacktestResult {
  folds: BacktestFold[]
  avgBeta: number
  avgR2oos: number
  avgIC: number
  signCorrectRatio: number  // e.g. 4/5
}

export interface MultipleTestingResult {
  placeboBetas: number[]
  placeboP: number
  dsr: number          // Decision Sharpe Ratio
  bhFdrRejected: boolean  // Benjamini-Hochberg at 0.05
}

export interface PipelineResult {
  config: CausalConfig
  adjustmentSet: string[]
  backdoorPaths: string[][]
  models: ModelComparison
  portfolio: PortfolioScore
  backtest: BacktestResult
  multipleTesting: MultipleTestingResult
  runAt: string
}
