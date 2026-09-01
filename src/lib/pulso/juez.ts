/**
 * Juicio de los términos emergentes.
 *
 * La estadística dice qué se ha salido de su costumbre, pero no si eso importa.
 * «taco bell ice cream taco» puede tener un z-score altísimo y no significar
 * nada para una cartera; «suwalki» con la mitad de menciones lo significa todo.
 * Esa distinción necesita conocimiento del mundo, así que la hace el modelo.
 *
 * Se llama una vez al día sobre doce términos como mucho, no por titular: el
 * coste queda acotado y previsible. Mismo contrato que
 * `lib/alertas/clasificador.ts` —en serie, tolerante a fallos aislados, JSON
 * extraído a la defensiva— porque el proveedor y sus manías son los mismos.
 */

import { extraerJson } from '@/lib/alertas/clasificador'
import type { Emergente } from '@/lib/pulso/keywords'

const SISTEMA = `Eres analista de riesgos de una cartera expuesta a oro, defensa, energía y tipos de interés.

Recibes un término que hoy se ha disparado en búsquedas, foros, redes o titulares, junto con su contexto. Tu tarea es decir si ese término anticipa algo que pueda mover esos mercados.

Puntúa la relevancia de 1 a 5:
5 — hecho militar, nuclear o de la OTAN con capacidad de mover el precio hoy mismo.
4 — escalada geopolítica seria, corte de suministro energético, sanción mayor, decisión de un banco central.
3 — tensión relevante sin efecto inmediato de precio; política económica de peso.
2 — noticia internacional sin relación con esos mercados.
1 — deporte, espectáculo, sucesos, marketing, tecnología de consumo.

Clasifica el tema en uno de: guerra, otan, europa, mundo, macro, ninguno.

Sé severo. La mayoría de lo que sube en Google es entretenimiento y merece un 1. Un falso positivo ensucia la lista que se muestra al operador; una omisión se recupera al día siguiente.

Responde SOLO con este JSON, sin texto alrededor:
{"relevancia": 1-5, "tema": "guerra|otan|europa|mundo|macro|ninguno", "resumen": "una frase de por qué importa o por qué no"}`

const TEMAS = ['guerra', 'otan', 'europa', 'mundo', 'macro'] as const
export type TemaJuzgado = (typeof TEMAS)[number] | null

export interface Juicio {
  relevancia: number
  tema: TemaJuzgado
  resumen: string
}

/**
 * Todo lo mal formado degrada a irrelevante.
 *
 * Es la misma decisión que toma el clasificador de alertas: ante una respuesta
 * ilegible, callar. Un término colado por un JSON roto acabaría en la pantalla
 * como si un analista lo hubiera aprobado.
 */
export function normalizarJuicio(bruto: Record<string, unknown> | null): Juicio {
  if (!bruto) return { relevancia: 1, tema: null, resumen: 'respuesta ilegible' }

  const n = Math.round(Number(bruto.relevancia))
  const relevancia = Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 1

  const temaBruto = String(bruto.tema ?? '').toLowerCase()
  const tema = (TEMAS as readonly string[]).includes(temaBruto) ? (temaBruto as TemaJuzgado) : null

  return { relevancia, tema, resumen: String(bruto.resumen ?? '').slice(0, 400) }
}

export async function juzgarTermino(emergente: Emergente): Promise<Juicio> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY no configurada')

  const model = process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-chat-v3-0324'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const mensaje = `TÉRMINO: ${emergente.termino}
MENCIONES HOY: ${emergente.menciones}
DESVIACIÓN SOBRE SU NORMAL: ${emergente.zScore.toFixed(1)} sigmas
FUENTES DONDE APARECE: ${emergente.fuentes.join(', ')}
TITULAR DE EJEMPLO: ${emergente.ejemploTitulo ?? 'sin titular'}
ENLACE: ${emergente.ejemploUrl ?? 'sin enlace'}
FECHA: ${emergente.dia}

Responde SOLO con el JSON.`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': siteUrl,
      'X-Title': 'Pulso público Departamento de Riesgos',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SISTEMA },
        { role: 'user', content: mensaje },
      ],
      temperature: 0.1,
      max_tokens: 300,
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  return normalizarJuicio(extraerJson(data.choices?.[0]?.message?.content ?? '') as Record<string, unknown> | null)
}

export interface EmergenteJuzgado extends Emergente {
  juicio: Juicio
}

/** En serie y tolerante a fallos, igual que la tanda del clasificador. */
export async function juzgarEmergentes(
  emergentes: Emergente[],
  maximo = 12,
): Promise<{ juzgados: EmergenteJuzgado[]; errores: string[] }> {
  const juzgados: EmergenteJuzgado[] = []
  const errores: string[] = []

  for (const emergente of emergentes.slice(0, maximo)) {
    try {
      juzgados.push({ ...emergente, juicio: await juzgarTermino(emergente) })
    } catch (e) {
      errores.push(`${emergente.termino}: ${(e as Error).message}`)
    }
  }

  return { juzgados, errores }
}
