import { createClient } from '@/lib/supabase/server'
import { AAPL_DEFAULT_CONFIG } from '@/lib/causal/dag'
import { backdoorCriterion } from '@/lib/causal/adjustment'
import { compareModels } from '@/lib/causal/estimation'
import { computeCausalScore } from '@/lib/causal/portfolio'
import { runBacktest } from '@/lib/causal/backtest'
import { runMultipleTesting } from '@/lib/causal/testing'
import type { CausalConfig, DataRow, PipelineResult } from '@/lib/causal/types'

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    assetId?: string
    config?: CausalConfig
    data: DataRow[]
  }

  const { assetId, data } = body
  const config: CausalConfig = body.config ?? AAPL_DEFAULT_CONFIG

  if (!data || !Array.isArray(data) || data.length === 0) {
    return Response.json({ error: 'Missing or empty required field: data' }, { status: 400 })
  }

  // Step 3: Backdoor criterion (adjustment set)
  const { adjustmentSet, backdoorPaths, validation } = backdoorCriterion(config)

  // Step 4: Model estimation
  const models = compareModels(data, config)

  // Extract causal model
  const causalModel = models.causal

  // Step 5: Portfolio score using last row as latest values
  const latestData = data[data.length - 1]
  const portfolio = computeCausalScore(causalModel, latestData, config)

  // Step 6: Backtest
  const backtest = runBacktest(data, config, adjustmentSet)

  // Step 7: Multiple testing
  const multipleTesting = runMultipleTesting(data, config, adjustmentSet, causalModel)

  const result: PipelineResult = {
    config,
    adjustmentSet,
    backdoorPaths,
    models,
    portfolio,
    backtest,
    multipleTesting,
    runAt: new Date().toISOString(),
  }

  // Save to Supabase if assetId provided
  if (assetId) {
    await supabase.from('causal_results').insert({ asset_id: assetId, result })
  }

  return Response.json({ result })
}
