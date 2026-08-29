import { describe, it, expect } from 'vitest'
import { settleOption } from '@/lib/options/settlement'
import {
  simularOpciones, posicionDeLiquidacion, diasEntre, repreciar,
  type Orden, type EstadoSubyacente, type PosicionAbierta,
} from './motor'
import { construirContrato } from './cadena'
import { COMISION_POR_CONTRATO, CONTRACT_MULTIPLIER } from './config'

/** Estado plano: mismo spot, IV y tipo todos los días. */
function estadoFijo(spot: number, iv = 0.30, r = 0.04) {
  return (): EstadoSubyacente => ({ spot, iv, r })
}

/** Sesiones diarias entre dos fechas, fines de semana incluidos (da igual aquí). */
function sesiones(desde: string, hasta: string): string[] {
  const out: string[] = []
  const d = new Date(`${desde}T00:00:00Z`)
  const fin = new Date(`${hasta}T00:00:00Z`)
  while (d <= fin) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

describe('liquidación por lado', () => {
  it('mapea cada combinación al tipo que espera settlement.ts', () => {
    expect(posicionDeLiquidacion('long', 'call')).toBe('LONG_CALL')
    expect(posicionDeLiquidacion('long', 'put')).toBe('LONG_PUT')
    expect(posicionDeLiquidacion('short', 'put')).toBe('SHORT_PUT')
    expect(posicionDeLiquidacion('short', 'call')).toBe('COVERED_CALL')
  })

  it('coincide con settlement.ts en los cuatro lados', () => {
    // El motor delega la liquidación en el módulo de producción; esta prueba
    // fija que la delegación es correcta y no una reimplementación paralela.
    for (const lado of ['long', 'short'] as const) {
      for (const tipo of ['call', 'put'] as const) {
        const s = settleOption({
          position: posicionDeLiquidacion(lado, tipo),
          strike: 100, premium: 3, underlyingAtExpiry: 110, contracts: 1,
        })
        expect(s, `${lado} ${tipo}`).not.toBeNull()
        // Una call vale 10 al vencer con el subyacente en 110; un put, 0.
        expect(s!.intrinsicValue).toBe(tipo === 'call' ? 10 : 0)
      }
    }
  })
})

describe('días entre fechas', () => {
  it('cuenta días naturales y admite el pasado', () => {
    expect(diasEntre('2026-01-01', '2026-01-31')).toBe(30)
    expect(diasEntre('2026-01-31', '2026-01-01')).toBe(-30)
  })
})

describe('repreciado', () => {
  const contrato = construirContrato({
    tipo: 'call', spot: 100, strike: 100,
    vencimiento: '2026-02-20', dte: 30, ivBase: 0.30, r: 0.04,
  })!
  const posicion: PosicionAbierta = {
    ticker: 'X', tipo: 'call', lado: 'long', contrato,
    fechaEntrada: '2026-01-21', primaEntrada: contrato.compra,
    contratos: 1, garantia: contrato.compra * 100,
  }

  it('pierde valor temporal según se acerca el vencimiento', () => {
    const lejos = repreciar(posicion, '2026-01-21', { spot: 100, iv: 0.30, r: 0.04 })!
    const cerca = repreciar(posicion, '2026-02-18', { spot: 100, iv: 0.30, r: 0.04 })!
    expect(cerca).toBeLessThan(lejos)
  })

  it('devuelve null cuando ya venció, para que el llamador liquide', () => {
    expect(repreciar(posicion, '2026-02-20', { spot: 100, iv: 0.30, r: 0.04 })).toBeNull()
  })
})

describe('contabilidad de la cartera', () => {
  const contrato = (tipo: 'call' | 'put', strike: number) => construirContrato({
    tipo, spot: 100, strike, vencimiento: '2026-02-20', dte: 30, ivBase: 0.30, r: 0.04,
  })!

  /** Un solo día de rebalanceo y una sola orden. */
  function correr(orden: Orden, capital: number, spotFinal: number) {
    let emitida = false
    return simularOpciones({
      capital,
      fechasRebalanceo: ['2026-01-21', '2026-02-20'],
      sesiones: sesiones('2026-01-21', '2026-02-20'),
      generarOrdenes: () => {
        if (emitida) return []
        emitida = true
        return [orden]
      },
      estadoEn: (_t, fecha) => ({
        spot: fecha === '2026-02-20' ? spotFinal : 100, iv: 0.30, r: 0.04,
      }),
      maxPosiciones: 1,
      usarNivelesDeSalida: false,
    })
  }

  it('abrir una posición larga solo cuesta la comisión y media horquilla', () => {
    // El error clásico aquí sería contar la prima dos veces: como salida de caja
    // y como posición sin valor, lo que hundiría el patrimonio al abrir. Lo que
    // sí debe costar es cruzar el mercado: se compra al precio de oferta y se
    // valora al medio, así que media horquilla se pierde en el acto.
    const c = contrato('call', 100)
    const r = correr({ ticker: 'X', tipo: 'call', lado: 'long', contrato: c }, 100_000, 100)
    // Mismo dimensionado que el motor: la comisión de ida y vuelta entra en el
    // coste unitario, para que gastar todo el capital no deje la caja en rojo.
    const contratos = Math.floor(100_000 / (c.compra * CONTRACT_MULTIPLIER + COMISION_POR_CONTRATO * 2))
    const mediaHorquilla = (c.compra - c.mid) * CONTRACT_MULTIPLIER * contratos
    const esperado = 100_000 - COMISION_POR_CONTRATO * contratos - mediaHorquilla
    expect(r.curva[0].valor).toBeCloseTo(esperado, 2)
    // Y esa pérdida instantánea es pequeña, no un agujero: si fuera enorme,
    // apuntaría a que la prima se está contando dos veces.
    expect(100_000 - r.curva[0].valor).toBeLessThan(100_000 * 0.02)
  })

  it('abrir una posición corta tampoco resta la garantía del patrimonio', () => {
    // La garantía la bloquea el bróker pero sigue siendo del titular. Restarla
    // haría que vender un put pareciera una pérdida instantánea del 20 %.
    const c = contrato('put', 95)
    const r = correr({ ticker: 'X', tipo: 'put', lado: 'short', contrato: c }, 300_000, 100)
    // Patrimonio inicial ≈ capital: la prima cobrada entra en caja y sale como
    // valor negativo de la posición, así que se cancelan.
    expect(r.curva[0].valor).toBeGreaterThan(300_000 * 0.99)
    expect(r.curva[0].valor).toBeLessThanOrEqual(300_000)
  })

  it('un put vendido que expira sin valor deja la prima íntegra', () => {
    const c = contrato('put', 95)
    const r = correr({ ticker: 'X', tipo: 'put', lado: 'short', contrato: c }, 300_000, 120)
    expect(r.operaciones).toHaveLength(1)
    const op = r.operaciones[0]
    expect(op.motivoSalida).toBe('vencimiento')
    expect(op.primaSalida).toBe(0)
    expect(op.resultado).toBeGreaterThan(0)
    // Y el patrimonio final sube exactamente ese resultado.
    expect(r.curva.at(-1)!.valor).toBeCloseTo(300_000 + op.resultado, 2)
  })

  it('un put vendido que acaba dentro del dinero pierde dinero', () => {
    const c = contrato('put', 95)
    const r = correr({ ticker: 'X', tipo: 'put', lado: 'short', contrato: c }, 300_000, 60)
    const op = r.operaciones[0]
    // Strike 95 con el subyacente en 60: valor intrínseco 35 por acción.
    expect(op.primaSalida).toBe(35)
    expect(op.resultado).toBeLessThan(0)
    expect(r.curva.at(-1)!.valor).toBeLessThan(300_000)
  })

  it('una call comprada que expira sin valor pierde toda la prima', () => {
    const c = contrato('call', 105)
    const r = correr({ ticker: 'X', tipo: 'call', lado: 'long', contrato: c }, 100_000, 90)
    const op = r.operaciones[0]
    expect(op.primaSalida).toBe(0)
    // Pierde la prima pagada más las dos comisiones, ni un céntimo más.
    const esperado = -(op.primaEntrada * CONTRACT_MULTIPLIER * op.contratos)
      - COMISION_POR_CONTRATO * op.contratos * 2
    expect(op.resultado).toBeCloseTo(esperado, 2)
  })

  it('nunca compromete más capital del que hay', () => {
    const c = contrato('put', 95)
    const r = correr({ ticker: 'X', tipo: 'put', lado: 'short', contrato: c }, 300_000, 100)
    const op = r.operaciones[0]
    // Garantía = strike × 100 × 20 %, y no puede pasar del capital.
    expect(op.contratos * c.strike * CONTRACT_MULTIPLIER * 0.20).toBeLessThanOrEqual(300_000)
  })
})

describe('niveles de salida', () => {
  it('cierran antes del vencimiento cuando la prima toca el objetivo', () => {
    const c = construirContrato({
      tipo: 'call', spot: 100, strike: 100,
      vencimiento: '2026-02-20', dte: 30, ivBase: 0.30, r: 0.04,
    })!
    let emitida = false
    // El subyacente se dispara: la call se multiplica y debe saltar el objetivo
    // (2,5× la prima) sin esperar al vencimiento.
    const r = simularOpciones({
      capital: 100_000,
      fechasRebalanceo: ['2026-01-21', '2026-02-20'],
      sesiones: sesiones('2026-01-21', '2026-02-20'),
      generarOrdenes: () => { if (emitida) return []; emitida = true; return [{ ticker: 'X', tipo: 'call', lado: 'long', contrato: c }] },
      estadoEn: (_t, fecha) => ({ spot: fecha >= '2026-01-28' ? 140 : 100, iv: 0.30, r: 0.04 }),
      maxPosiciones: 1,
      usarNivelesDeSalida: true,
    })
    expect(r.operaciones).toHaveLength(1)
    expect(r.operaciones[0].motivoSalida).toBe('objetivo')
    expect(r.operaciones[0].fechaSalida < '2026-02-20').toBe(true)
  })

  it('sin niveles activos la posición vive hasta el vencimiento', () => {
    // Es el comportamiento que hoy tiene producción: `stop_loss` se guarda y
    // ningún proceso lo lee. Poder simular las dos variantes es lo que permite
    // medir cuánto aportan los niveles.
    const c = construirContrato({
      tipo: 'call', spot: 100, strike: 100,
      vencimiento: '2026-02-20', dte: 30, ivBase: 0.30, r: 0.04,
    })!
    let emitida = false
    const r = simularOpciones({
      capital: 100_000,
      fechasRebalanceo: ['2026-01-21', '2026-02-20'],
      sesiones: sesiones('2026-01-21', '2026-02-20'),
      generarOrdenes: () => { if (emitida) return []; emitida = true; return [{ ticker: 'X', tipo: 'call', lado: 'long', contrato: c }] },
      estadoEn: (_t, fecha) => ({ spot: fecha >= '2026-01-28' ? 140 : 100, iv: 0.30, r: 0.04 }),
      maxPosiciones: 1,
      usarNivelesDeSalida: false,
    })
    expect(r.operaciones[0].motivoSalida).toBe('vencimiento')
  })
})

describe('límite de pérdida', () => {
  it('una cartera que solo compra opciones nunca cruza el cero', () => {
    // El fallo que esta prueba fija: si el dimensionado usa el capital inicial
    // en vez del patrimonio vivo, una cartera que ha perdido sigue abriendo
    // como si no hubiera perdido, la caja se va a negativo y el CAGR sale NaN.
    // Aquí cada call comprada expira sin valor, mes tras mes, veinte veces.
    const meses = Array.from({ length: 20 }, (_, i) => {
      const d = new Date(Date.UTC(2020, i, 20))
      return d.toISOString().slice(0, 10)
    })
    const r = simularOpciones({
      capital: 100_000,
      fechasRebalanceo: meses,
      sesiones: sesiones('2020-01-20', '2021-09-20'),
      // Cinco huecos y una sola orden: cada mes arriesga un quinto del
      // patrimonio, así que la cartera se desangra despacio en vez de morir de
      // golpe y la serie es lo bastante larga para que el fallo aflore.
      maxPosiciones: 5,
      usarNivelesDeSalida: false,
      // El subyacente se desploma poco a poco: todas las calls acaban sin valor.
      estadoEn: (_t, fecha) => {
        const t = (new Date(fecha).getTime() - new Date('2020-01-20').getTime()) / 86_400_000
        return { spot: 100 * Math.exp(-0.0003 * t), iv: 0.30, r: 0.04 }
      },
      generarOrdenes: (fecha) => {
        const i = meses.indexOf(fecha)
        if (i < 0 || i >= meses.length - 1) return []
        const c = construirContrato({
          tipo: 'call', spot: 100, strike: 130,
          vencimiento: meses[i + 1], dte: 30, ivBase: 0.30, r: 0.04,
        })
        return c ? [{ ticker: 'X', tipo: 'call', lado: 'long', contrato: c }] : []
      },
    })

    // Varias operaciones encadenadas: lo que importa no es cuántas —eso depende
    // de cuánto tarde en agotarse el capital— sino que la invariante aguante en
    // todas ellas.
    expect(r.operaciones.length).toBeGreaterThanOrEqual(3)
    // Pierde casi todo, pero nunca debe cruzar el cero ni producir NaN.
    for (const punto of r.curva) {
      expect(Number.isFinite(punto.valor), `valor no finito el ${punto.fecha}`).toBe(true)
      expect(punto.valor, `patrimonio negativo el ${punto.fecha}`).toBeGreaterThan(0)
    }
    expect(r.curva.at(-1)!.valor).toBeLessThan(100_000)
  })
})

describe('ruina', () => {
  it('una cartera de puts vendidos que se desploma queda arruinada, no en NaN', () => {
    // Vender opciones puede costar más que la prima cobrada. Si el subyacente
    // se hunde, la obligación de recomprar supera la caja. Eso es la ruina y hay
    // que declararla: dejar que el patrimonio cruce el cero produce métricas
    // NaN que ocultan justo el peor resultado posible.
    const c = construirContrato({
      tipo: 'put', spot: 100, strike: 95,
      vencimiento: '2026-02-20', dte: 30, ivBase: 0.30, r: 0.04,
    })!
    let emitida = false
    const r = simularOpciones({
      capital: 100_000,
      fechasRebalanceo: ['2026-01-21', '2026-02-20'],
      sesiones: sesiones('2026-01-21', '2026-02-20'),
      maxPosiciones: 1,
      usarNivelesDeSalida: false,
      // El subyacente pierde el 95 % a mitad de mes.
      estadoEn: (_t, fecha) => ({ spot: fecha >= '2026-02-01' ? 5 : 100, iv: 0.30, r: 0.04 }),
      generarOrdenes: () => { if (emitida) return []; emitida = true; return [{ ticker: 'X', tipo: 'put', lado: 'short', contrato: c }] },
    })

    expect(r.fechaDeRuina).not.toBeNull()
    for (const p of r.curva) {
      expect(Number.isFinite(p.valor), `valor no finito el ${p.fecha}`).toBe(true)
      expect(p.valor).toBeGreaterThanOrEqual(0)
    }
    expect(r.curva.at(-1)!.valor).toBe(0)
  })

  it('una cartera que sobrevive no declara ruina', () => {
    const c = construirContrato({
      tipo: 'put', spot: 100, strike: 95,
      vencimiento: '2026-02-20', dte: 30, ivBase: 0.30, r: 0.04,
    })!
    let emitida = false
    const r = simularOpciones({
      capital: 300_000,
      fechasRebalanceo: ['2026-01-21', '2026-02-20'],
      sesiones: sesiones('2026-01-21', '2026-02-20'),
      maxPosiciones: 1,
      usarNivelesDeSalida: false,
      estadoEn: () => ({ spot: 100, iv: 0.30, r: 0.04 }),
      generarOrdenes: () => { if (emitida) return []; emitida = true; return [{ ticker: 'X', tipo: 'put', lado: 'short', contrato: c }] },
    })
    expect(r.fechaDeRuina).toBeNull()
  })
})

describe('cartera vacía', () => {
  it('cuenta las fechas sin posiciones y no rompe la curva', () => {
    const r = simularOpciones({
      capital: 100_000,
      fechasRebalanceo: ['2026-01-21', '2026-02-20'],
      sesiones: sesiones('2026-01-21', '2026-02-20'),
      generarOrdenes: () => [],
      estadoEn: estadoFijo(100),
      maxPosiciones: 3,
      usarNivelesDeSalida: true,
    })
    expect(r.fechasSinPosiciones).toBe(2)
    expect(r.curva.every(p => p.valor === 100_000)).toBe(true)
    expect(r.retornos.every(x => x.retorno === 0)).toBe(true)
  })
})
