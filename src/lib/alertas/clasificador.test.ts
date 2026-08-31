import { describe, expect, it } from 'vitest'
import { extraerJson, normalizar } from '@/lib/alertas/clasificador'

describe('extraerJson', () => {
  it('parsea una respuesta limpia', () => {
    expect(extraerJson('{"relevante":true}')).toEqual({ relevante: true })
  })

  it('rescata el JSON de un bloque de código', () => {
    const raw = 'Claro:\n```json\n{"relevante": false}\n```'
    expect(extraerJson(raw)).toEqual({ relevante: false })
  })

  it('rescata el JSON de un texto con prólogo', () => {
    expect(extraerJson('Aquí tienes {"severidad": 3} listo')).toEqual({ severidad: 3 })
  })

  it('devuelve null si no hay JSON', () => {
    expect(extraerJson('no puedo ayudarte con eso')).toBeNull()
  })
})

describe('normalizar', () => {
  it('convierte una respuesta válida', () => {
    const c = normalizar(
      { relevante: true, severidad: 4, evento_key: 'Dron Ruso Polonia 2026', resumen: 'r', motivo: 'm' },
      'guerra',
    )
    expect(c).toMatchObject({ relevante: true, severidad: 4, eventoKey: 'dron-ruso-polonia-2026', tipo: 'guerra' })
  })

  it('normaliza acentos y símbolos en la clave del evento', () => {
    const c = normalizar({ relevante: true, severidad: 2, evento_key: 'Invasión aérea — Báltico!' }, 'guerra')
    expect(c.eventoKey).toBe('invasion-aerea-baltico')
  })

  it('acota la severidad al rango 1-5', () => {
    expect(normalizar({ relevante: true, severidad: 9, evento_key: 'x' }, 'guerra').severidad).toBe(5)
    expect(normalizar({ relevante: true, severidad: 0, evento_key: 'x' }, 'guerra').severidad).toBe(1)
  })

  it('degrada a no relevante si falta la clave del evento', () => {
    expect(normalizar({ relevante: true, severidad: 4 }, 'guerra').relevante).toBe(false)
  })

  it('degrada a no relevante si la severidad no es numérica', () => {
    expect(normalizar({ relevante: true, severidad: 'alta', evento_key: 'x' }, 'guerra').relevante).toBe(false)
  })

  it('una respuesta ilegible nunca es relevante', () => {
    expect(normalizar(null, 'fed_tesoro')).toMatchObject({ relevante: false, tipo: 'fed_tesoro' })
  })
})
