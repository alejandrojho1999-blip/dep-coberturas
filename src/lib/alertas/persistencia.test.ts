import { afterEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cargarCurva, curvaActiva, registrarVistas, urlsRecientes } from '@/lib/alertas/persistencia'
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

/**
 * Supabase de mentira para las dos tablas que consulta `urlsRecientes`.
 * Aplica el filtro de fecha de verdad, que es lo que decide la ventana.
 */
function supabaseDeUrls(
  senales: Array<{ url: string; created_at: string }>,
  vistas: Array<{ url: string; created_at: string }>,
) {
  const consultar = (filas: Array<{ url: string; created_at: string }>) => {
    const constructor = {
      gte: (_c: string, desde: string) => {
        const data = filas.filter((f) => f.created_at >= desde).map((f) => ({ url: f.url }))
        return Object.assign(Promise.resolve({ data, error: null }), {
          not: () => Promise.resolve({ data, error: null }),
        })
      },
    }
    return constructor
  }
  return {
    from: (tabla: string) => ({
      select: () => consultar(tabla === 'alert_signals' ? senales : vistas),
    }),
  } as unknown as SupabaseClient
}

describe('urlsRecientes', () => {
  const hace1h = new Date(Date.now() - 3_600_000).toISOString()
  const hace3d = new Date(Date.now() - 3 * 86_400_000).toISOString()

  it('une las señales publicadas con los titulares descartados', async () => {
    // La fuga del 2026-09-08: `b` se clasificó y se descartó, así que no está
    // en alert_signals. Sin la unión volvía al modelo cada dos minutos.
    const urls = await urlsRecientes(
      supabaseDeUrls([{ url: 'a', created_at: hace1h }], [{ url: 'b', created_at: hace1h }]),
      24,
    )
    expect(urls).toEqual(new Set(['a', 'b']))
  })

  it('deja fuera lo anterior a la ventana', async () => {
    const urls = await urlsRecientes(
      supabaseDeUrls([], [{ url: 'viejo', created_at: hace3d }, { url: 'nuevo', created_at: hace1h }]),
      24,
    )
    expect(urls).toEqual(new Set(['nuevo']))
  })
})

describe('registrarVistas', () => {
  it('no toca la base cuando no hay nada que anotar', async () => {
    const explota = { from: () => { throw new Error('no debería consultarse') } } as never
    await expect(registrarVistas(explota, [])).resolves.toBeUndefined()
  })

  it('anota también lo que el modelo descartó', async () => {
    let recibido: Array<Record<string, unknown>> = []
    const admin = {
      from: () => ({
        upsert: (filas: Array<Record<string, unknown>>) => {
          recibido = filas
          return Promise.resolve({ error: null })
        },
      }),
    } as unknown as SupabaseClient

    await registrarVistas(admin, [
      { url: 'u1', tipo: 'guerra', titular: 'sí', fuente: 'Reuters', relevante: true },
      { url: 'u2', tipo: 'guerra', titular: 'no', fuente: 'Reuters', relevante: false },
    ])

    expect(recibido.map((f) => f.url)).toEqual(['u1', 'u2'])
    expect(recibido.map((f) => f.relevante)).toEqual([true, false])
  })
})

describe('urlsRecientes ante la tabla que aún no existe', () => {
  const conError = (code: string) => ({
    from: (tabla: string) => ({
      select: () => ({
        gte: () => {
          if (tabla === 'alert_seen_urls') return Promise.resolve({ data: null, error: { code, message: 'nope' } })
          const data = [{ url: 'a' }]
          return Object.assign(Promise.resolve({ data, error: null }), {
            not: () => Promise.resolve({ data, error: null }),
          })
        },
      }),
    }),
  }) as unknown as SupabaseClient

  it('sigue con la memoria vieja mientras falte la migración 028', async () => {
    expect(await urlsRecientes(conError('PGRST205'), 24)).toEqual(new Set(['a']))
    expect(await urlsRecientes(conError('42P01'), 24)).toEqual(new Set(['a']))
  })

  it('cualquier otro error sí revienta: un permiso mal puesto no es un hueco', async () => {
    await expect(urlsRecientes(conError('42501'), 24)).rejects.toThrow('alert_seen_urls')
  })
})
