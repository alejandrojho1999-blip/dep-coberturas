import { describe, it, expect } from 'vitest'
import { RESUMEN_OPCIONES, varianteOpciones } from './opciones-publicado'
import { REJILLA_K } from './opciones/config'

/**
 * El resumen de opciones es un fichero generado que se versiona a mano. Estas
 * pruebas no comprueban el cálculo —de eso se ocupan los tests de `opciones/`—
 * sino que lo que entró en el repositorio siga siendo dibujable y coherente.
 */
describe('resumen publicado del backtest de opciones', () => {
  const { variantes, ventana, primaDeVarianzaObservada: prima } = RESUMEN_OPCIONES

  it('publica las cuatro corridas del estudio', () => {
    expect(variantes.map(v => v.id)).toEqual(['constante', 'regimen', 'skew', 'sin-niveles'])
  })

  it('cada corrida lleva a Gamma y a Theta con su índice correcto', () => {
    for (const v of variantes) {
      expect(v.agentes.map(a => a.id)).toEqual(['gamma', 'theta'])
      // El índice lo fija lo que hace el agente: Gamma compra acciones vía
      // opciones y se mide contra el mercado; Theta vende puts y se mide contra
      // un índice que vende puts. Medir Theta contra SPY compararía vender
      // opciones con comprar acciones.
      expect(v.agentes.find(a => a.id === 'gamma')!.benchmark.ticker).toBe('SPY')
      expect(v.agentes.find(a => a.id === 'theta')!.benchmark.ticker).toBe('^PUT')
    }
  })

  it('mide todas las corridas sobre la misma ventana', () => {
    expect(ventana.nVencimientos).toBeGreaterThan(200)
    for (const v of variantes) {
      for (const a of v.agentes) {
        expect(a.curva.length).toBe(ventana.nVencimientos)
        expect(a.curva[0].fecha).toBe(ventana.desde)
      }
    }
  })

  it('alinea la curva de cada agente con la de su índice', () => {
    for (const [id, curva] of Object.entries(RESUMEN_OPCIONES.benchmarkCurvas)) {
      expect(curva.length).toBe(ventana.nVencimientos)
      const agente = variantes[0].agentes.find(a => a.id === id)!
      expect(curva[0].fecha).toBe(agente.curva[0].fecha)
    }
  })

  it('la calibración recorre la rejilla completa y marca un solo óptimo', () => {
    for (const v of variantes) {
      expect(v.calibracion.rejilla.map(p => p.k)).toEqual([...REJILLA_K])
      const marcados = v.calibracion.rejilla.filter(p => p.calibrado)
      expect(marcados).toHaveLength(1)
      expect(marcados[0].k).toBe(v.calibracion.kOptimo)
    }
  })

  it('el óptimo de calibración no cae en el borde de la rejilla', () => {
    // Un óptimo pegado al borde no es un óptimo: significa que la rejilla estaba
    // mal puesta y el verdadero mínimo queda fuera de lo explorado.
    const bordes = [REJILLA_K[0], REJILLA_K[REJILLA_K.length - 1]]
    for (const v of variantes) {
      expect(bordes, `${v.id} calibra en el borde`).not.toContain(v.calibracion.kOptimo)
    }
  })

  it('la réplica de ^PUT sigue al índice real', () => {
    // Es la prueba que sostiene el estudio entero: si la cadena sintética no
    // reprodujera un índice de opciones real, no habría nada que publicar.
    for (const v of variantes) {
      expect(v.calibracion.correlacion, `${v.id}`).toBeGreaterThan(0.85)
      expect(v.calibracion.errorSeguimiento, `${v.id}`).toBeLessThan(0.10)
    }
  })

  it('el barrido cubre la rejilla y marca el punto calibrado', () => {
    for (const v of variantes) {
      for (const a of v.agentes) {
        expect(a.barrido.map(p => p.k)).toEqual([...REJILLA_K])
        expect(a.barrido.filter(p => p.calibrado)).toHaveLength(1)
        expect(a.barrido.find(p => p.calibrado)!.k).toBe(v.calibracion.kOptimo)
      }
    }
  })

  it('las métricas del agente coinciden con su punto calibrado del barrido', () => {
    // Si divergieran, la pantalla estaría enseñando dos resultados distintos del
    // mismo agente en dos paneles contiguos.
    for (const v of variantes) {
      for (const a of v.agentes) {
        const calibrado = a.barrido.find(p => p.calibrado)!
        expect(a.metricas.cagr, `${v.id}/${a.id}`).toBeCloseTo(calibrado.cagr, 4)
        expect(a.metricas.informationRatio, `${v.id}/${a.id}`).toBeCloseTo(calibrado.informationRatio, 4)
      }
    }
  })

  it('no publica valores no finitos en ninguna curva', () => {
    // El motor puede arruinar una cartera; lo que no puede es emitir NaN, que
    // ocultaría justo el peor resultado tras un guion en la pantalla.
    for (const v of variantes) {
      for (const a of v.agentes) {
        for (const p of a.curva) {
          expect(Number.isFinite(p.valor), `${v.id}/${a.id} ${p.fecha}`).toBe(true)
          expect(p.valor).toBeGreaterThanOrEqual(0)
        }
        expect(Number.isFinite(a.metricas.cagr)).toBe(true)
      }
    }
  })

  it('publica la prima de varianza observada, que impide leer mal el ajuste', () => {
    // El parámetro calibrado cae por debajo de 1 y la prima real está por
    // encima: sin este dato al lado, alguien concluiría que el mercado vende
    // volatilidad barata, que es lo contrario de lo que ocurre.
    expect(prima.mediana).toBeGreaterThan(1)
    expect(prima.p10).toBeLessThan(prima.mediana)
    expect(prima.p90).toBeGreaterThan(prima.mediana)
    for (const v of variantes) {
      expect(v.calibracion.kOptimo).toBeLessThan(prima.mediana)
    }
  })

  it('localiza una corrida por su identificador', () => {
    expect(varianteOpciones('sin-niveles')?.conNivelesDeSalida).toBe(false)
    expect(varianteOpciones('constante')?.conNivelesDeSalida).toBe(true)
    expect(varianteOpciones('no-existe')).toBeUndefined()
  })
})
