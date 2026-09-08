import { describe, expect, it, vi } from 'vitest'
import { conReintentos, esFalloPasajero } from '@/lib/reintentos'

/** Espera falsa: registra lo que se habría dormido y sigue al momento. */
function relojFalso() {
  const esperas: number[] = []
  return {
    esperas,
    dormir: async (ms: number) => {
      esperas.push(ms)
    },
  }
}

describe('esFalloPasajero', () => {
  it('reconoce los errores que tumbaron los ciclos del 2026-09-08', () => {
    expect(esFalloPasajero({ message: 'Gateway Timeout' })).toBe(true)
    expect(esFalloPasajero(new Error('FRED API error for series EFFR: 502 Bad Gateway'))).toBe(true)
  })

  it('mira dentro de la causa, porque fetch siempre dice lo mismo por fuera', () => {
    const error = new Error('fetch failed', { cause: new Error('ECONNRESET') })
    expect(esFalloPasajero(error)).toBe(true)
  })

  it('no reintenta lo que fallaría igual las tres veces', () => {
    expect(esFalloPasajero({ code: '42501', message: 'permission denied for table' })).toBe(false)
    expect(esFalloPasajero({ code: 'PGRST205', message: 'Could not find the table' })).toBe(false)
    expect(esFalloPasajero(null)).toBe(false)
  })
})

describe('conReintentos', () => {
  it('devuelve a la primera cuando no hay fallo', async () => {
    const operacion = vi.fn().mockResolvedValue('ok')
    const reloj = relojFalso()

    await expect(conReintentos(operacion, { dormir: reloj.dormir })).resolves.toBe('ok')
    expect(operacion).toHaveBeenCalledTimes(1)
    expect(reloj.esperas).toEqual([])
  })

  it('reintenta un fallo pasajero y devuelve el resultado bueno', async () => {
    const operacion = vi
      .fn()
      .mockRejectedValueOnce(new Error('Gateway Timeout'))
      .mockResolvedValue('ok')
    const reloj = relojFalso()

    await expect(conReintentos(operacion, { dormir: reloj.dormir })).resolves.toBe('ok')
    expect(operacion).toHaveBeenCalledTimes(2)
    expect(reloj.esperas).toEqual([500])
  })

  it('duplica la espera en cada vuelta', async () => {
    const operacion = vi.fn().mockRejectedValue(new Error('503 Service Unavailable'))
    const reloj = relojFalso()

    await expect(conReintentos(operacion, { dormir: reloj.dormir })).rejects.toThrow('503')
    expect(operacion).toHaveBeenCalledTimes(3)
    expect(reloj.esperas).toEqual([500, 1000])
  })

  it('sube el error permanente sin gastar reintentos', async () => {
    const operacion = vi.fn().mockRejectedValue(new Error('permission denied'))
    const reloj = relojFalso()

    await expect(conReintentos(operacion, { dormir: reloj.dormir })).rejects.toThrow(
      'permission denied',
    )
    expect(operacion).toHaveBeenCalledTimes(1)
    expect(reloj.esperas).toEqual([])
  })

  it('avisa de cada reintento para que quede rastro en el log', async () => {
    const avisos: Array<[number, number]> = []
    const operacion = vi.fn().mockRejectedValue(new Error('Bad Gateway'))
    const reloj = relojFalso()

    await expect(
      conReintentos(operacion, {
        dormir: reloj.dormir,
        alReintentar: (intento, _error, esperaMs) => avisos.push([intento, esperaMs]),
      }),
    ).rejects.toThrow('Bad Gateway')

    expect(avisos).toEqual([
      [1, 500],
      [2, 1000],
    ])
  })
})
