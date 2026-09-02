/**
 * ¿Está funcionando la deduplicación por suceso?
 *
 * La auditoría de severidad enseñó diez avisos del mismo hecho en dos horas.
 * O el LLM da una `evento_key` distinta a cada versión del suceso, o el
 * enfriamiento no está haciendo su trabajo. Esto lo distingue: agrupa las
 * señales por clave y enseña las claves que describen lo mismo con palabras
 * distintas.
 *
 * Solo lee.
 */
import { createAdminClient } from '@/lib/supabase/admin'

async function main(): Promise<void> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('alert_signals')
    .select('evento_key, severidad, titular, created_at, tipo')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(`alert_signals: ${error.message}`)

  const filas = (data ?? []) as Array<{
    evento_key: string; severidad: number; titular: string; created_at: string; tipo: string
  }>

  console.log(`\nCLAVES DE SUCESO EN ${filas.length} SEÑALES`)
  console.log(`Claves distintas: ${new Set(filas.map((f) => f.evento_key)).size}\n`)

  for (const f of filas) {
    console.log(`  [${f.severidad}] ${f.created_at.slice(5, 16)}  ${f.evento_key}`)
  }

  const { data: dd, error: e2 } = await admin
    .from('alert_dedupe')
    .select('evento_key, max_severidad, ultima_vez')
    .order('ultima_vez', { ascending: false })
    .limit(100)
  if (e2) {
    console.log(`\nalert_dedupe: ${e2.message}`)
    return
  }

  console.log(`\nESTADO DE DEDUPE: ${(dd ?? []).length} claves vivas`)
  for (const d of (dd ?? []) as Array<{ evento_key: string; max_severidad: number; ultima_vez: string }>) {
    console.log(`  [${d.max_severidad}] ${d.ultima_vez.slice(5, 16)}  ${d.evento_key}`)
  }
  console.log('')
}

main().catch((e) => {
  console.error(`error: ${(e as Error).message}`)
  process.exit(1)
})
