import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RESUMEN_BACKTEST } from '@/lib/backtest/publicado'
import BacktestClient from './_components/BacktestClient'

export const metadata: Metadata = {
  title: 'Backtest de los agentes de acciones',
  description:
    'Resultado del backtest de los agentes Peter y Small, con y sin las capas técnicas, contra su índice de referencia.',
}

/**
 * Resultado del backtest de los agentes de acciones.
 *
 * Los datos son estáticos: vienen de `src/lib/backtest/resumen-publicado.json`,
 * que se regenera con `npm run backtest:publicar` después de correr el
 * orquestador. No hay llamada a Yahoo ni a la base de datos, así que la página
 * no puede quedarse a medias por una API caída; a cambio, las cifras son las de
 * la última publicación y la pantalla lo dice.
 */
export default async function BacktestAgentesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <BacktestClient resumen={RESUMEN_BACKTEST} />
}
