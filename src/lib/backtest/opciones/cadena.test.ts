import { describe, it, expect } from 'vitest'
import { computeGreeks } from '@/lib/options/blackScholes'
import {
  tercerViernes, vencimientosDisponibles, fechasDeRebalanceo, pasoDeStrike, strikeCotizable,
  strikePorDelta, horquillaFraccion, construirContrato, elegirContrato,
} from './cadena'

describe('vencimientos estándar', () => {
  it('encuentra el tercer viernes de meses conocidos', () => {
    // Comprobados contra el calendario: son los días de vencimiento reales.
    expect(tercerViernes(2026, 0).toISOString().slice(0, 10)).toBe('2026-01-16')
    expect(tercerViernes(2026, 7).toISOString().slice(0, 10)).toBe('2026-08-21')
    // Enero de 2021 empezaba en viernes: el tercero es el día 15, no el 22.
    expect(tercerViernes(2021, 0).toISOString().slice(0, 10)).toBe('2021-01-15')
  })

  it('siempre cae en viernes y en la tercera semana', () => {
    for (let anio = 2005; anio <= 2026; anio++) {
      for (let mes = 0; mes < 12; mes++) {
        const d = tercerViernes(anio, mes)
        expect(d.getUTCDay()).toBe(5)
        expect(d.getUTCDate()).toBeGreaterThanOrEqual(15)
        expect(d.getUTCDate()).toBeLessThanOrEqual(21)
      }
    }
  })

  it('solo ofrece vencimientos dentro de la ventana pedida', () => {
    const vs = vencimientosDisponibles('2026-01-16', 21, 45)
    expect(vs.length).toBeGreaterThan(0)
    for (const v of vs) {
      expect(v.dte).toBeGreaterThanOrEqual(21)
      expect(v.dte).toBeLessThanOrEqual(45)
    }
    // Ordenados de más cercano a más lejano: el motor toma el primero.
    expect(vs).toEqual([...vs].sort((a, b) => a.dte - b.dte))
  })

  it('devuelve lista vacía cuando ningún vencimiento cae en la ventana', () => {
    // Ventana de un solo día: es casi imposible que un tercer viernes caiga ahí.
    expect(vencimientosDisponibles('2026-01-05', 3, 4)).toEqual([])
  })

  it('a mitad de mes puede no haber ningún vencimiento operable', () => {
    // Este es el motivo de que el motor decida en los vencimientos y no a
    // diario: el 5 de enero de 2026 los vencimientos están a 11 y 46 días, y
    // Theta pide entre 21 y 45. Ningún contrato disponible.
    expect(vencimientosDisponibles('2026-01-05', 21, 45)).toEqual([])
  })
})

describe('fechas de rebalanceo', () => {
  it('desde un vencimiento, el siguiente siempre cae en la ventana de los agentes', () => {
    // La propiedad que sostiene todo el diseño: decidiendo en el vencimiento,
    // el siguiente queda a 28-35 días, dentro de [21,45] de Theta y de [21,90]
    // de Gamma. Se comprueba en los 21 años del estudio, no en un caso suelto.
    const fechas = fechasDeRebalanceo('2005-01-01', '2026-08-27')
    expect(fechas.length).toBeGreaterThan(250)
    for (const f of fechas) {
      const theta = vencimientosDisponibles(f, 21, 45)
      const gamma = vencimientosDisponibles(f, 21, 90)
      expect(theta.length, `Theta sin contrato el ${f}`).toBeGreaterThan(0)
      expect(gamma.length, `Gamma sin contrato el ${f}`).toBeGreaterThan(0)
    }
  })

  it('respeta los extremos del intervalo pedido', () => {
    const fechas = fechasDeRebalanceo('2026-01-01', '2026-03-31')
    expect(fechas).toEqual(['2026-01-16', '2026-02-20', '2026-03-20'])
  })
})

describe('strikes cotizables', () => {
  it('usa el paso que corresponde al precio del subyacente', () => {
    expect(pasoDeStrike(12)).toBe(1)
    expect(pasoDeStrike(100)).toBe(2.5)
    expect(pasoDeStrike(500)).toBe(5)
  })

  it('redondea al strike negociable más cercano', () => {
    // Con spot 100 el paso es 2,50: 101,3 está más cerca de 102,50 que de 100.
    expect(strikeCotizable(101.3, 100)).toBe(102.5)
    expect(strikeCotizable(100.9, 100)).toBe(100)
    expect(strikeCotizable(487.4, 500)).toBe(485)
  })
})

describe('inversión de delta', () => {
  const base = { spot: 100, T: 30 / 365, r: 0.04, iv: 0.30 }

  it('devuelve un strike cuyo delta real coincide con el objetivo', () => {
    // La prueba que de verdad importa: se invierte el delta y luego se comprueba
    // en sentido directo con la misma función que usa producción.
    for (const tipo of ['call', 'put'] as const) {
      for (const objetivo of [0.15, 0.25, 0.35, 0.50, 0.65]) {
        const K = strikePorDelta({ tipo, deltaObjetivo: objetivo, ...base })
        expect(K, `${tipo} Δ${objetivo}`).not.toBeNull()
        const real = Math.abs(
          computeGreeks({ type: tipo, S: base.spot, K: K!, T: base.T, r: base.r, sigma: base.iv }).delta,
        )
        expect(real, `${tipo} Δ${objetivo}`).toBeCloseTo(objetivo, 3)
      }
    }
  })

  it('coloca los strikes en el lado correcto del dinero', () => {
    // Una call con delta bajo está por encima del spot; un put con delta bajo,
    // por debajo. Si esto se invirtiera, Theta estaría vendiendo ITM sin saberlo.
    const callOtm = strikePorDelta({ tipo: 'call', deltaObjetivo: 0.20, ...base })!
    const putOtm = strikePorDelta({ tipo: 'put', deltaObjetivo: 0.20, ...base })!
    expect(callOtm).toBeGreaterThan(base.spot)
    expect(putOtm).toBeLessThan(base.spot)
  })

  it('rechaza entradas imposibles en vez de devolver un número inventado', () => {
    expect(strikePorDelta({ tipo: 'call', deltaObjetivo: 0.3, spot: 0, T: 0.1, r: 0.04, iv: 0.3 })).toBeNull()
    expect(strikePorDelta({ tipo: 'call', deltaObjetivo: 0.3, spot: 100, T: 0, r: 0.04, iv: 0.3 })).toBeNull()
    expect(strikePorDelta({ tipo: 'call', deltaObjetivo: 0.3, spot: 100, T: 0.1, r: 0.04, iv: 0 })).toBeNull()
  })
})

describe('horquilla', () => {
  it('se ensancha al alejarse del dinero', () => {
    const atm = horquillaFraccion(100, 100)
    const otm = horquillaFraccion(100, 130)
    expect(otm).toBeGreaterThan(atm)
  })

  it('es simétrica en log-moneyness', () => {
    // Un strike un 25 % por encima y otro un 20 % por debajo distan lo mismo en
    // logaritmo; la horquilla no debe favorecer un lado.
    expect(horquillaFraccion(100, 125)).toBeCloseTo(horquillaFraccion(100, 80), 6)
  })
})

describe('construcción del contrato', () => {
  const args = {
    tipo: 'call' as const, spot: 100, strike: 105,
    vencimiento: '2026-02-20', dte: 30, ivBase: 0.30, r: 0.04,
  }

  it('la horquilla siempre juega en contra de quien cruza', () => {
    const c = construirContrato(args)!
    expect(c.compra).toBeGreaterThan(c.mid)
    expect(c.venta).toBeLessThan(c.mid)
  })

  it('nunca cotiza una venta a cero o negativa', () => {
    // Un contrato muy OTM tiene mid minúsculo; sin suelo, la horquilla lo
    // llevaría a negativo y el motor cobraría por vender aire.
    const c = construirContrato({ ...args, strike: 400 })
    if (c) expect(c.venta).toBeGreaterThan(0)
  })

  it('rechaza plazos vencidos y subyacentes imposibles', () => {
    expect(construirContrato({ ...args, dte: 0 })).toBeNull()
    expect(construirContrato({ ...args, spot: 0 })).toBeNull()
    expect(construirContrato({ ...args, strike: 0 })).toBeNull()
  })

  it('el skew encarece los puts por debajo del dinero', () => {
    const plano = construirContrato({ ...args, tipo: 'put', strike: 85, skew: 0 })!
    const conSkew = construirContrato({ ...args, tipo: 'put', strike: 85, skew: 0.15 })!
    expect(conSkew.iv).toBeGreaterThan(plano.iv)
    expect(conSkew.mid).toBeGreaterThan(plano.mid)
  })
})

describe('elección de contrato', () => {
  const args = {
    tipo: 'put' as const, fecha: '2026-01-16', spot: 100,
    deltaObjetivo: 0.25, dteMin: 21, dteMax: 45, iv: 0.30, r: 0.04,
  }

  it('devuelve un contrato dentro de la ventana de plazo y con el delta pedido', () => {
    const c = elegirContrato(args)!
    expect(c).not.toBeNull()
    expect(c.dte).toBeGreaterThanOrEqual(21)
    expect(c.dte).toBeLessThanOrEqual(45)
    // El redondeo al strike cotizable desplaza algo el delta: se admite holgura.
    expect(Math.abs(c.delta)).toBeCloseTo(0.25, 1)
  })

  it('devuelve null cuando no hay vencimiento estándar en la ventana', () => {
    // Que no haya contrato es información: ese día el agente no habría operado.
    expect(elegirContrato({ ...args, dteMin: 3, dteMax: 4 })).toBeNull()
  })
})
