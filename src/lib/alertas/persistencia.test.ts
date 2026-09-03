import { afterEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cargarCurva, curvaActiva } from '@/lib/alertas/persistencia'
import { N_MINIMO_PARA_CORREGIR } from '@/lib/alertas/calibracion'

/**
 * Supabase de mentira que solo sabe lo que `cargarCurva` le pide: una tabla,
 * un `select` y un `gte`. Devuelve las filas que superan el filtro, igual que
 * haría Postgres, para poder comprobar que el listón se aplica de verdad.
 */
function supabaseCon(filas: Array<Record<string, unknown>>, error: string | null = null) {
  return {
    from: () => ({
      select: () => ({
        gte: (columna: string, minimo: number) => Promise.resolve(
          error
            ? { data: null, error: { message: error } }
            : { data: filas.filter((f) => Number(f[columna]) >= minimo), error: null },
        ),
      }),
    }),
  } as unknown as SupabaseClient
}

describe('cargarCurva', () => {
  it('deja fuera los peldaños medidos con muy pocos casos', async () => {
    // El caso real del 2026-09-03: guerra 4/5 tiene n=8 y corrige; guerra 5/5
    // tiene n=2 y no debe corregir, porque con dos casos la proporción es un
    // sorteo. Al no estar en la curva, aplicarCurva lo publica tal cual.
    const { curva, error } = await cargarCurva(supabaseCon([
      { tema: 'guerra', severidad_llm: 4, severidad_final: 2, n_eventos: 8 },
      { tema: 'guerra', severidad_llm: 5, severidad_final: 5, n_eventos: 2 },
    ]))

    expect(error).toBeNull()
    expect(curva).toEqual([{ tema: 'guerra', severidadLlm: 4, severidadFinal: 2 }])
  })

  it('el listón es exactamente N_MINIMO_PARA_CORREGIR, no uno más', async () => {
    const { curva } = await cargarCurva(supabaseCon([
      { tema: 'guerra', severidad_llm: 2, severidad_final: 1, n_eventos: N_MINIMO_PARA_CORREGIR },
      { tema: 'guerra', severidad_llm: 3, severidad_final: 1, n_eventos: N_MINIMO_PARA_CORREGIR - 1 },
    ]))

    expect(curva.map((p) => p.severidadLlm)).toEqual([2])
  })

  it('un fallo de la tabla devuelve curva vacía y el error, sin lanzar', async () => {
    // Es la diferencia entre perder la corrección y perder la alerta: el ciclo
    // tiene que seguir avisando con el peldaño del modelo.
    const { curva, error } = await cargarCurva(supabaseCon([], 'permission denied'))

    expect(curva).toEqual([])
    expect(error).toBe('severity_calibration: permission denied')
  })

  it('sin filas devuelve la curva vacía sin error', async () => {
    expect(await cargarCurva(supabaseCon([]))).toEqual({ curva: [], error: null })
  })
})

describe('curvaActiva', () => {
  afterEach(() => { delete process.env.ALERTAS_CURVA })

  it('está activa mientras nadie la apague', () => {
    expect(curvaActiva()).toBe(true)
  })

  it('ALERTAS_CURVA=off la apaga, en cualquier caja', () => {
    process.env.ALERTAS_CURVA = 'off'
    expect(curvaActiva()).toBe(false)
    process.env.ALERTAS_CURVA = 'OFF'
    expect(curvaActiva()).toBe(false)
  })

  it('cualquier otro valor la deja encendida', () => {
    // Un typo en la variable no puede apagar la corrección en silencio.
    process.env.ALERTAS_CURVA = 'no'
    expect(curvaActiva()).toBe(true)
  })

  it('apagada, cargarCurva devuelve la curva vacía sin tocar la base', async () => {
    process.env.ALERTAS_CURVA = 'off'
    const explota = { from: () => { throw new Error('no debería consultarse') } } as never
    expect(await cargarCurva(explota)).toEqual({ curva: [], error: null })
  })
})
