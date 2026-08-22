import type { Metadata } from 'next'
import EstrategiasClient from './_components/EstrategiasClient'
import { resumenTodas } from '@/lib/estrategias/datos'

export const metadata: Metadata = {
  title: 'Estrategias — SynerGy',
  description:
    'Seis sistemas algorítmicos de futuros sobre el Nasdaq, validados sobre 11,6 años de historia con costes reales.',
}

export default async function EstrategiasPage() {
  const backtests = await resumenTodas()
  return <EstrategiasClient backtests={backtests} />
}
