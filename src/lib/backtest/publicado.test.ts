import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { catalogoDataset } from './dataset'
import { DATASET_BACKTEST, entradaDataset } from './dataset-source'
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

  it('enlaza ficheros que la ruta de API sabe construir', () => {
    // Si el catálogo y el resumen se desincronizan, el enlace da un 404 que la
    // pantalla no tiene forma de detectar hasta que alguien lo pulsa.
    for (const d of RESUMEN_BACKTEST.descargas) {
      expect(d.ruta).toBe(`/api/backtest/dataset?fichero=${encodeURIComponent(d.fichero)}`)
      const entrada = entradaDataset(d.fichero)
      expect(entrada, `el catálogo no sirve ${d.fichero}`).toBeDefined()
      expect(entrada!.formato).toBe(d.formato)
    }
  })

  it('construye cada descarga con el tamaño que anuncia', () => {
    for (const d of RESUMEN_BACKTEST.descargas) {
      const contenido = entradaDataset(d.fichero)!.construir()
      const bytes = typeof contenido === 'string' ? Buffer.byteLength(contenido) : contenido.byteLength
      expect(bytes, `${d.fichero} pesa distinto de lo anunciado`).toBe(d.bytes)
    }
  })

  it('no sirve ficheros fuera del catálogo', () => {
    // El nombre llega por parámetro de consulta: si el catálogo no lo filtrara,
    // sería la puerta natural a un recorrido de directorios.
    expect(entradaDataset('../../.env.local')).toBeUndefined()
    expect(entradaDataset('backtest-peter.xlsx/../../secreto')).toBeUndefined()
    expect(entradaDataset('')).toBeUndefined()
  })

  it('cubre en el dataset las mismas variantes que la pantalla', () => {
    expect(DATASET_BACKTEST.variantes.map(v => v.id)).toEqual(variantes.map(v => v.id))
    for (const v of DATASET_BACKTEST.variantes) {
      const enPantalla = variantes.find(x => x.id === v.id)!
      expect(v.operaciones.length).toBe(enPantalla.base.nOperaciones)
    }
    expect(catalogoDataset(DATASET_BACKTEST)).toHaveLength(RESUMEN_BACKTEST.descargas.length)
  })

  it('mantiene el dataset pesado fuera de lo que importa la pantalla', () => {
    // `dataset-publicado.json` ronda el medio mega. Si algún componente llegara
    // a importarlo, viajaría al navegador entero en cada visita a la pantalla.
    const cliente = readFileSync(
      path.join(process.cwd(), 'src/app/(dashboard)/agentes/backtest/_components/BacktestClient.tsx'),
      'utf8',
    )
    expect(cliente).not.toContain('dataset-source')
    expect(cliente).not.toContain('dataset-publicado')
  })

  it('localiza una variante por su identificador', () => {
    expect(varianteBacktest('small-lynch')?.agente).toBe('Small')
    expect(varianteBacktest('no-existe')).toBeUndefined()
  })
})
