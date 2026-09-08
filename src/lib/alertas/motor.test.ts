import { afterEach, describe, expect, it, vi } from 'vitest'
import { corregirSeveridad, silencioPorLaCurva, horaEnEcuador, SALTO_PROB_RELEVANTE, tocaDigest } from '@/lib/alertas/motor'

afterEach(() => vi.useRealTimers())

describe('horaEnEcuador', () => {
  it('convierte UTC a la hora local de Guayaquil', () => {
    // Ecuador está en UTC-5 todo el año.
    expect(horaEnEcuador(new Date('2026-08-31T13:00:00Z'))).toBe(8)
    expect(horaEnEcuador(new Date('2026-08-31T03:00:00Z'))).toBe(22)
    expect(horaEnEcuador(new Date('2026-08-31T05:00:00Z'))).toBe(0)
  })
})

describe('tocaDigest', () => {
  const ochoAm = new Date('2026-08-31T13:00:00Z')
  const mediodia = new Date('2026-08-31T17:00:00Z')

  it('envía en la franja programada', () => {
    expect(tocaDigest({ ahora: ochoAm, ultimoTomadoAt: null, probSubidaActual: 40, probSubidaPrevia: 40 }))
      .toEqual({ enviar: true, motivo: 'digest-programado' })
  })

  it('no repite dentro de la misma franja', () => {
    const d = tocaDigest({
      ahora: ochoAm,
      ultimoTomadoAt: '2026-08-31T13:30:00Z',
      probSubidaActual: 40,
      probSubidaPrevia: 40,
    })
    expect(d).toEqual({ enviar: false, motivo: 'ya-enviado-esta-franja' })
  })

  it('calla fuera de las franjas si nada se mueve', () => {
    expect(tocaDigest({ ahora: mediodia, ultimoTomadoAt: null, probSubidaActual: 40, probSubidaPrevia: 38 }).enviar)
      .toBe(false)
  })

  it('un salto grande de probabilidad rompe el horario', () => {
    const d = tocaDigest({
      ahora: mediodia,
      ultimoTomadoAt: '2026-08-31T16:00:00Z',
      probSubidaActual: 40 + SALTO_PROB_RELEVANTE,
      probSubidaPrevia: 40,
    })
    expect(d).toEqual({ enviar: true, motivo: 'salto-probabilidad' })
  })

  it('una caída grande también avisa', () => {
    expect(tocaDigest({ ahora: mediodia, ultimoTomadoAt: null, probSubidaActual: 10, probSubidaPrevia: 45 }).enviar)
      .toBe(true)
  })

  it('sin foto previa no compara saltos', () => {
    expect(tocaDigest({ ahora: mediodia, ultimoTomadoAt: null, probSubidaActual: 90, probSubidaPrevia: null }).enviar)
      .toBe(false)
  })
})

describe('corregirSeveridad', () => {
  const curva = [
    { tema: 'guerra', severidadLlm: 4, severidadFinal: 2 },
    { tema: 'fed_tesoro', severidadLlm: 5, severidadFinal: 4 },
  ]

  it('baja el peldaño del modelo al que la curva midió', () => {
    // El hallazgo central de la calibración: los "4" de guerra mueven el precio
    // como un 2, así que dejan de sonar el teléfono.
    expect(corregirSeveridad(4, 'guerra', curva))
      .toEqual({ severidad: 2, severidadLlm: 4, corregida: true })
  })

  it('no toca un peldaño sin punto de curva', () => {
    // guerra 3/5 y 5/5 tienen menos de N_MINIMO_PARA_CORREGIR casos, así que
    // cargarCurva no los devuelve y aquí se publican tal cual.
    expect(corregirSeveridad(5, 'guerra', curva))
      .toEqual({ severidad: 5, severidadLlm: 5, corregida: false })
  })

  it('no cruza los temas', () => {
    // El 5 de fed_tesoro baja a 4; el 5 de guerra no, y son curvas distintas.
    expect(corregirSeveridad(5, 'fed_tesoro', curva).severidad).toBe(4)
    expect(corregirSeveridad(5, 'guerra', curva).severidad).toBe(5)
  })

  it('con la curva vacía publica lo que dijo el modelo', () => {
    // Es el degradado cuando falla la lectura de severity_calibration: se
    // pierde la corrección, no la alerta.
    expect(corregirSeveridad(4, 'guerra', []))
      .toEqual({ severidad: 4, severidadLlm: 4, corregida: false })
  })

  it('marca corregida solo cuando el peldaño cambia', () => {
    const igual = [{ tema: 'guerra', severidadLlm: 2, severidadFinal: 2 }]
    expect(corregirSeveridad(2, 'guerra', igual).corregida).toBe(false)
  })
})

describe('silencioPorLaCurva', () => {
  // El suelo se lee del entorno en cada llamada, así que se fija por prueba.
  const conSuelo = (suelo: string, f: () => void) => {
    const previo = process.env.ALERTAS_SEVERIDAD_MINIMA
    process.env.ALERTAS_SEVERIDAD_MINIMA = suelo
    try { f() } finally {
      if (previo === undefined) delete process.env.ALERTAS_SEVERIDAD_MINIMA
      else process.env.ALERTAS_SEVERIDAD_MINIMA = previo
    }
  }

  it('nombra el caso que importa: el modelo la quería, la curva la apagó', () => {
    conSuelo('2', () => {
      const linea = silencioPorLaCurva({ severidadLlm: 3, severidad: 1 })
      expect(linea).toMatch(/modelo puso en 3/)
      expect(linea).toMatch(/curva bajó a 1/)
      expect(linea).toMatch(/suelo 2/)
      // La escotilla se nombra en el propio aviso: quien lo lea en el log del
      // cron no debería tener que buscar cómo desactivar la corrección.
      expect(linea).toMatch(/ALERTAS_CURVA=off/)
    })
  })

  it('calla cuando el modelo ya la había puesto por debajo del suelo', () => {
    // Aquí la curva no decidió nada: el hecho ya era menor para el clasificador.
    conSuelo('2', () => {
      expect(silencioPorLaCurva({ severidadLlm: 1, severidad: 1 })).toBeNull()
    })
  })

  it('calla cuando la corrección no cruzó el suelo', () => {
    conSuelo('2', () => {
      expect(silencioPorLaCurva({ severidadLlm: 4, severidad: 2 })).toBeNull()
    })
  })

  it('con el suelo en 3 el margen es mayor, y el mismo caso ya no cruza', () => {
    // El motivo de vigilar esto: bajar el suelo de 3 a 2 no cambia la curva,
    // cambia cuántas correcciones acaban cruzándolo.
    conSuelo('3', () => {
      expect(silencioPorLaCurva({ severidadLlm: 4, severidad: 3 })).toBeNull()
      expect(silencioPorLaCurva({ severidadLlm: 4, severidad: 2 })).toMatch(/suelo 3/)
    })
  })

  it('sin datos de calibración no inventa una atribución', () => {
    expect(silencioPorLaCurva(undefined)).toBeNull()
  })
})
