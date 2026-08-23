import { parseContracts, quoteContracts } from '@/lib/options/quote-contracts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RequestBody {
  contracts?: unknown
}

/**
 * Devuelve la prima actual de cada contrato de opción, indexada por
 * `contractKey`. Los contratos ilíquidos o inexistentes se omiten del mapa
 * en lugar de fallar toda la petición.
 *
 * El trabajo vive en `lib/options/quote-contracts.ts`, para que el servidor
 * pueda cotizar contratos sin pasar por HTTP.
 */
export async function POST(request: Request): Promise<Response> {
  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return Response.json({ error: 'Cuerpo JSON inválido' }, { status: 400 })
  }

  const contracts = parseContracts(body.contracts)
  if (!contracts.length) return Response.json({})

  const prices = await quoteContracts(contracts)
  return Response.json(prices, { headers: { 'Cache-Control': 'no-store' } })
}
