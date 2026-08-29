import { describe, it, expect, vi } from 'vitest'
import {
  CATEGORIAS_CON_NIVELES, usaNivelesDeSalida, isOptionCategory, OPTION_CATEGORIES,
} from './exit-levels'
import { runExitReview } from './exit-review-run'

/**
 * Qué agentes cierran por nivel y cuáles mantienen hasta el vencimiento.
 *
 * No es una preferencia de estilo: Theta vende opciones y su pérdida no está
 * acotada, mientras que Gamma las compra y ya arriesga como mucho la prima
 * pagada. El backtest sobre 21 años midió las dos configuraciones y estas
 * pruebas fijan el resultado para que un refactor no lo revierta en silencio.
 */
describe('política de niveles por categoría', () => {
  it('vive en un módulo sin dependencias de servidor', async () => {
    // La tabla de recomendaciones la consulta desde el navegador para no pintar
    // niveles inexistentes. Si volviera a definirse junto al orquestador de la
    // revisión, el bundle de cliente arrastraría Supabase y el build fallaría.
    const puro = await import('./exit-levels')
    expect(typeof puro.usaNivelesDeSalida).toBe('function')
  })

  it('Theta cierra por nivel; Gamma mantiene hasta el vencimiento', () => {
    expect(usaNivelesDeSalida('OPTIONS_THETA')).toBe(true)
    expect(usaNivelesDeSalida('OPTIONS_GAMMA')).toBe(false)
  })

  it('declara una decisión explícita para cada categoría de opciones', () => {
    // Añadir un agente de opciones nuevo debe obligar a decidir esto, no a
    // heredar un valor por defecto sin pensarlo.
    for (const c of OPTION_CATEGORIES) {
      expect(typeof CATEGORIAS_CON_NIVELES[c], `${c} sin decisión`).toBe('boolean')
    }
  })

  it('sigue reconociendo las dos categorías válidas', () => {
    expect(isOptionCategory('OPTIONS_GAMMA')).toBe(true)
    expect(isOptionCategory('OPTIONS_THETA')).toBe(true)
    expect(isOptionCategory('OPTIONS_OTRO')).toBe(false)
    expect(isOptionCategory(null)).toBe(false)
  })
})

describe('runExitReview con la política aplicada', () => {
  /** Cliente de Supabase que falla si alguien llega a consultarlo. */
  function supabaseQueNoDebeUsarse() {
    const from = vi.fn(() => { throw new Error('no debería consultarse') })
    return { from } as never
  }

  it('no consulta ni cierra nada en un agente sin niveles', async () => {
    // La comprobación va dentro de `runExitReview` porque por ahí pasan las dos
    // vías —la revisión del agente y la del cron—; ponerla en quien llama
    // dejaría la otra cerrando posiciones que ya no debe tocar.
    const r = await runExitReview(supabaseQueNoDebeUsarse(), 'usuario-1', 'OPTIONS_GAMMA')

    expect(r.cerradas).toBe(0)
    expect(r.porObjetivo).toBe(0)
    expect(r.porStop).toBe(0)
    expect(r.revisadas).toBe(0)
    // Y lo dice en el log, en vez de guardar silencio y parecer que no había
    // posiciones vivas.
    expect(r.log.join(' ')).toContain('no usa niveles de salida')
  })

  it('sí consulta la base de datos en un agente con niveles', async () => {
    // Theta debe seguir revisándose exactamente igual que antes.
    let consultada = false
    const supabase = {
      from() {
        consultada = true
        const q = {
          select: () => q, eq: () => q, neq: () => q,
          limit: () => Promise.resolve({ data: [], error: null }),
        }
        return q
      },
    } as never

    const r = await runExitReview(supabase, 'usuario-1', 'OPTIONS_THETA')
    expect(consultada).toBe(true)
    expect(r.log.join(' ')).toContain('sin posiciones activas')
  })
})
