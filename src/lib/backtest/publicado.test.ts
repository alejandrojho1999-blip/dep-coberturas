import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  RESUMEN_BACKTEST, varianteBacktest,
  ETIQUETA_CAPA, ETIQUETA_CRITERIO, ETIQUETA_ROBUSTEZ,
} from './publicado'

/**
 * El resumen publicado es un fichero generado que se versiona a mano con
 * `npm run backtest:publicar`. Estas pruebas no comprueban el cálculo —eso es
 * cosa de `engine.test.ts` y `stats.test.ts`— sino que lo que entró en el
 * repositorio siga siendo dibujable: si una regeneración cambia la forma de los
 * datos, la pantalla se rompería en producción y no en el CI.
 */
describe('resumen publicado del backtest', () => {
  const { variantes, ventana } = RESUMEN_BACKTEST

  it('publica las cuatro variantes del estudio', () => {
    expect(variantes.map(v => v.id)).toEqual(['peter', 'peter-lynch', 'small', 'small-lynch'])
  })

  it('mide todas las variantes sobre la misma ventana', () => {
    for (const v of variantes) {
      expect(v.muestra.desde).toBe(ventana.desde)
      expect(v.muestra.hasta).toBe(ventana.hasta)
      expect(v.base.nPeriodos).toBe(ventana.nMeses)
    }
  })

  it('alinea la curva de la cartera con la de su benchmark', () => {
    for (const v of variantes) {
      expect(v.curvas.cartera.length).toBe(v.curvas.benchmark.length)
      expect(v.curvas.cartera[0].valor).toBe(1)
      expect(v.curvas.cartera[0].fecha).toBe(v.curvas.benchmark[0].fecha)
      // La curva del mercado amplio solo existe cuando no coincide con el
      // benchmark; si está, debe cubrir los mismos meses.
      if (v.curvas.mercadoAmplio) {
        expect(v.curvas.mercadoAmplio.length).toBe(v.curvas.cartera.length)
      }
    }
  })

  it('usa el índice que corresponde a la clase de activo', () => {
    for (const v of variantes) {
      const esperado = v.universo === 'small_cap' ? 'IJR' : 'SPY'
      expect(v.benchmark.ticker).toBe(esperado)
      // En gran capitalización el benchmark ya es el mercado amplio: publicarlo
      // dos veces sugeriría dos varas de medir donde solo hay una.
      if (v.universo === 'large_cap') expect(v.mercadoAmplio).toBeNull()
      else expect(v.mercadoAmplio?.ticker).toBe('SPY')
    }
  })

  it('solo declara la cascada completa en la corrida que la simula', () => {
    for (const v of variantes) {
      expect('cascada' in v.porCapa).toBe(v.capas === 'lynch+tecnico')
    }
  })

  it('tiene etiqueta legible para toda clave técnica que llega a pantalla', () => {
    for (const v of variantes) {
      for (const k of Object.keys(v.porCapa)) expect(ETIQUETA_CAPA[k]).toBeTruthy()
      for (const k of Object.keys(v.robustez)) expect(ETIQUETA_ROBUSTEZ[k]).toBeTruthy()
      for (const k of Object.keys(v.leaveOneOut)) {
        expect(ETIQUETA_CRITERIO[k.replace('sin_', '')]).toBeTruthy()
      }
      for (const k of Object.keys(v.paridad?.acuerdoPorCriterio ?? {})) {
        expect(ETIQUETA_CRITERIO[k]).toBeTruthy()
      }
    }
  })

  it('conserva los tramos sin datos como nulos, no como ceros', () => {
    const tramosVacios = variantes
      .flatMap(v => v.subperiodos)
      .filter(s => s.nPeriodos === 0)
    expect(tramosVacios.length).toBeGreaterThan(0)
    for (const s of tramosVacios) {
      expect(s.retornoAcumulado).toBeNull()
      expect(s.retornoActivoMedio).toBeNull()
    }
  })

  it('publica un dataset descargable por variante y por agente', () => {
    const { descargas } = RESUMEN_BACKTEST
    // Un libro por agente y un CSV de operaciones por variante, más el CSV de
    // métricas que compara las cuatro.
    expect(descargas.filter(d => d.formato === 'xlsx')).toHaveLength(2)
    expect(descargas.filter(d => d.fichero.startsWith('operaciones-'))).toHaveLength(variantes.length)
    expect(descargas.some(d => d.fichero === 'metricas-backtest.csv')).toBe(true)
  })

  it('enlaza ficheros que existen en public/ y no están vacíos', () => {
    // El enlace de descarga es estático: si el fichero no se generó, el usuario
    // se lleva un 404 y la pantalla no tiene forma de avisarlo en tiempo real.
    for (const d of RESUMEN_BACKTEST.descargas) {
      expect(d.ruta).toBe(`/descargas/backtest/${d.fichero}`)
      const enDisco = path.join(process.cwd(), 'public', d.ruta)
      expect(existsSync(enDisco), `falta ${d.ruta}`).toBe(true)
      expect(statSync(enDisco).size).toBe(d.bytes)
    }
  })

  it('localiza una variante por su identificador', () => {
    expect(varianteBacktest('small-lynch')?.agente).toBe('Small')
    expect(varianteBacktest('no-existe')).toBeUndefined()
  })
})
