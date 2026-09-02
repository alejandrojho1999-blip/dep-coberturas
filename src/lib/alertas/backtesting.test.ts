import { describe, expect, it } from 'vitest'
import { UMBRAL_MATERIAL } from '@/lib/alertas/calibracion'
import {
  eventoMovioElPrecio,
  lineaBase,
  soloCurados,
  movimientoDe,
  movimientosDeJuicio,
  pctConSigno,
  percentil,
  perfilNormalidad,
  resumirGlobal,
  resumirPorClase,
  type EventoMedido,
} from '@/lib/alertas/backtesting'

/**
 * Un movimiento en múltiplos del umbral del activo, para que los tests
 * sobrevivan a una recalibración. Los umbrales se duplicaron el 2026-09-02.
 */
function mov(ticker: string, factor: number, ventana = 5) {
  const extremo = UMBRAL_MATERIAL[ticker] * factor
  return { ticker, ventana, retorno: extremo, extremo }
}

function evento(parcial: Partial<EventoMedido> = {}): EventoMedido {
  return {
    fecha: '2022-02-24',
    titulo: 'Un hecho',
    tramo: 'principal',
    tema: 'guerra',
    clase: 'invasion',
    severidad: 3,
    nota: null,
    movimientos: [],
    ...parcial,
  }
}

describe('movimientoDe', () => {
  const e = evento({
    movimientos: [
      { ticker: 'GC=F', ventana: 1, retorno: 0.01, extremo: 0.02 },
      { ticker: 'GC=F', ventana: 5, retorno: 0.03, extremo: 0.06 },
    ],
  })

  it('devuelve la ventana de juicio por defecto, no la primera que encuentra', () => {
    expect(movimientoDe(e, 'GC=F')?.retorno).toBe(0.03)
  })

  it('deja pedir otra ventana', () => {
    expect(movimientoDe(e, 'GC=F', 1)?.retorno).toBe(0.01)
  })

  it('sin medición devuelve null, que no es cero', () => {
    // Bitcoin no cotizaba en 2001: «no se sabe» nunca debe leerse como «no movió».
    expect(movimientoDe(e, 'BTC-USD')).toBeNull()
  })
})

describe('movimientosDeJuicio', () => {
  it('se queda solo con la ventana de cinco sesiones', () => {
    const e = evento({
      movimientos: [
        { ticker: 'GC=F', ventana: 1, retorno: 0.01, extremo: 0.01 },
        { ticker: 'GC=F', ventana: 3, retorno: 0.02, extremo: 0.02 },
        { ticker: 'GC=F', ventana: 5, retorno: 0.03, extremo: 0.03 },
      ],
    })
    expect(movimientosDeJuicio(e)).toHaveLength(1)
    expect(movimientosDeJuicio(e)[0].ventana).toBe(5)
  })
})

describe('eventoMovioElPrecio', () => {
  it('es cierto cuando un activo pasa su umbral en la ventana de juicio', () => {
    expect(eventoMovioElPrecio(evento({
      movimientos: [mov('GC=F', 1.4)],
    }))).toBe(true)
  })

  it('ignora lo que pasó en ventanas más cortas', () => {
    // Un susto de un día que se deshizo no cuenta: el veredicto es a cinco sesiones.
    expect(eventoMovioElPrecio(evento({
      movimientos: [mov('GC=F', 3, 1)],
    }))).toBe(false)
  })

  it('sin mediciones no movió nada', () => {
    expect(eventoMovioElPrecio(evento())).toBe(false)
  })
})

describe('resumirPorClase', () => {
  const eventos = [
    evento({
      clase: 'invasion', severidad: 5,
      movimientos: [
        { ticker: 'GC=F', ventana: 5, retorno: 0.06, extremo: 0.08 },
        { ticker: '^VIX', ventana: 5, retorno: 0.30, extremo: 0.40 },
      ],
    }),
    evento({
      clase: 'invasion', severidad: 3,
      movimientos: [
        { ticker: 'GC=F', ventana: 5, retorno: 0.02, extremo: 0.02 },
        { ticker: '^VIX', ventana: 5, retorno: 0.10, extremo: 0.10 },
      ],
    }),
    evento({
      clase: 'declaracion', severidad: 1,
      movimientos: [{ ticker: 'GC=F', ventana: 5, retorno: 0.001, extremo: 0.001 }],
    }),
  ]

  it('agrupa por familia y promedia la severidad', () => {
    const [invasion] = resumirPorClase(eventos)
    expect(invasion.clase).toBe('invasion')
    expect(invasion.n).toBe(2)
    expect(invasion.severidadMedia).toBe(4)
  })

  it('cuenta cuántos de la familia movieron el precio', () => {
    const [invasion, declaracion] = resumirPorClase(eventos)
    expect(invasion.movieron).toBe(1)
    expect(declaracion.movieron).toBe(0)
  })

  it('promedia el oro y el extremo del VIX', () => {
    const [invasion] = resumirPorClase(eventos)
    expect(invasion.oroMedio).toBeCloseTo(0.04, 5)
    expect(invasion.vixExtremoMedio).toBeCloseTo(0.25, 5)
  })

  it('ordena por número de casos: lo más respaldado arriba', () => {
    expect(resumirPorClase(eventos).map((r) => r.clase)).toEqual(['invasion', 'declaracion'])
  })

  it('deja en null la media de un activo sin ninguna medición', () => {
    const [declaracion] = resumirPorClase(eventos).filter((r) => r.clase === 'declaracion')
    expect(declaracion.vixExtremoMedio).toBeNull()
  })

  it('con la lista vacía no devuelve filas', () => {
    expect(resumirPorClase([])).toEqual([])
  })
})

describe('resumirGlobal', () => {
  it('cuenta eventos y mediciones de todas las ventanas', () => {
    const r = resumirGlobal([
      evento({
        movimientos: [
          { ticker: 'GC=F', ventana: 1, retorno: 0.01, extremo: 0.01 },
          { ticker: 'GC=F', ventana: 5, retorno: 0.01, extremo: 0.01 },
        ],
      }),
    ])
    expect(r.eventos).toBe(1)
    expect(r.mediciones).toBe(2)
  })

  it('señala los graves que no movieron nada', () => {
    const r = resumirGlobal([
      evento({ severidad: 5, movimientos: [mov('GC=F', 0.02)] }),
      evento({ severidad: 4, movimientos: [mov('GC=F', 1.5)] }),
    ])
    expect(r.gravesSinEfecto).toBe(1)
  })

  it('señala los leves que sí movieron', () => {
    const r = resumirGlobal([
      evento({ severidad: 2, movimientos: [mov('^VIX', 1.2)] }),
      evento({ severidad: 1, movimientos: [mov('GC=F', 0.02)] }),
    ])
    expect(r.levesConEfecto).toBe(1)
  })

  it('con la lista vacía devuelve ceros, no NaN', () => {
    expect(resumirGlobal([])).toEqual({
      eventos: 0, mediciones: 0, movieron: 0, gravesSinEfecto: 0, levesConEfecto: 0,
    })
  })
})

describe('pctConSigno', () => {
  it('pone el signo siempre, también en positivo', () => {
    expect(pctConSigno(0.034)).toBe('+3.4%')
    expect(pctConSigno(-0.087)).toBe('-8.7%')
  })

  it('un nulo se escribe como raya, nunca como cero', () => {
    expect(pctConSigno(null)).toBe('—')
    expect(pctConSigno(Number.NaN)).toBe('—')
  })
})

describe('el grupo de control', () => {
  const conPlacebo: EventoMedido[] = [
    evento({
      clase: 'invasion', severidad: 5,
      movimientos: [{ ticker: 'GC=F', ventana: 5, retorno: 0.06, extremo: 0.08 }],
    }),
    evento({
      fecha: '2023-04-11', tramo: 'placebo', clase: 'dia-corriente', severidad: 1,
      titulo: 'Sesión de control 2023-04-11',
      movimientos: [mov('GC=F', 1.5)],
    }),
    evento({
      fecha: '2023-05-02', tramo: 'placebo', clase: 'dia-corriente', severidad: 1,
      titulo: 'Sesión de control 2023-05-02',
      movimientos: [{ ticker: 'GC=F', ventana: 5, retorno: 0.001, extremo: 0.001 }],
    }),
  ]

  it('aparta el control de los hechos curados', () => {
    expect(soloCurados(conPlacebo)).toHaveLength(1)
    expect(soloCurados(conPlacebo)[0].clase).toBe('invasion')
  })

  it('la línea base es la proporción del control, no del corpus entero', () => {
    // Una de las dos fechas al azar movió el precio.
    expect(lineaBase(conPlacebo)).toEqual({ base: 0.5, n: 2 })
  })

  it('sin control devuelve null, que no es una base del 0%', () => {
    // Distinguirlos importa: con null la pantalla avisa, con 0 mentiría.
    expect(lineaBase(soloCurados(conPlacebo))).toBeNull()
  })

  it('el control no ensucia las medias del corpus', () => {
    // Sus severidades son todas 1 y no significan «leve»: hundirían la media.
    const soloReales = resumirGlobal(soloCurados(conPlacebo))
    expect(soloReales.eventos).toBe(1)
    expect(soloReales.levesConEfecto).toBe(0)
  })
})

describe('percentil', () => {
  it('devuelve null sin datos, que no es un cero', () => {
    expect(percentil([], 0.5)).toBeNull()
  })

  it('con un solo valor lo devuelve para cualquier percentil', () => {
    expect(percentil([0.07], 0.9)).toBe(0.07)
  })

  it('interpola entre los dos valores que rodean la posición', () => {
    // Cuatro valores: la mediana cae entre el segundo y el tercero.
    expect(percentil([0, 1, 2, 3], 0.5)).toBe(1.5)
    expect(percentil([0, 1, 2, 3], 0)).toBe(0)
    expect(percentil([0, 1, 2, 3], 1)).toBe(3)
  })

  it('no depende del orden de entrada', () => {
    expect(percentil([3, 0, 2, 1], 0.5)).toBe(1.5)
  })
})

describe('perfilNormalidad', () => {
  /** Una fecha de control con un solo activo medido. */
  const control = (ticker: string, factor: number, fecha: string) =>
    evento({
      fecha, tramo: 'placebo', clase: 'dia-corriente', severidad: 1,
      titulo: `Sesión de control ${fecha}`,
      movimientos: [mov(ticker, factor)],
    })

  const curado = (ticker: string, factor: number, fecha: string) =>
    evento({ fecha, movimientos: [mov(ticker, factor)] })

  it('separa el día normal de los hechos y mide la distancia al umbral', () => {
    const perfil = perfilNormalidad([
      control('GC=F', 0.25, '2023-01-02'),
      control('GC=F', 0.75, '2023-01-03'),
      curado('GC=F', 2, '2022-02-24'),
    ])
    const oro = perfil.find((p) => p.ticker === 'GC=F')

    expect(oro).toMatchObject({ n: 2, cruces: 0, nCurados: 1, crucesCurados: 1 })
    // Mediana del control = 0,5 umbrales, así que el umbral está al doble.
    expect(oro?.vecesLaMediana).toBeCloseTo(2)
    // Cruza el 100% de los hechos y el 0% del control.
    expect(oro?.separacion).toBeCloseTo(1)
  })

  it('en el VIX una caída no acerca al umbral: solo cuenta la subida', () => {
    // Un desplome del VIX es el mercado calmándose, no un susto.
    const perfil = perfilNormalidad([control('^VIX', -3, '2023-01-02')])
    const vix = perfil.find((p) => p.ticker === '^VIX')

    expect(vix?.cruces).toBe(0)
    expect(vix?.p50).toBeLessThan(0)
    // Con mediana negativa el múltiplo no significa nada y no se inventa.
    expect(vix?.vecesLaMediana).toBeNull()
  })

  it('ordena por poder discriminante, no por número de cruces', () => {
    const perfil = perfilNormalidad([
      // El oro cruza en el control y en los hechos: no distingue nada.
      control('GC=F', 2, '2023-01-02'),
      curado('GC=F', 2, '2022-02-24'),
      // La plata solo cruza con noticia detrás.
      control('SI=F', 0.1, '2023-01-02'),
      curado('SI=F', 2, '2022-02-24'),
    ])

    expect(perfil[0].ticker).toBe('SI=F')
    expect(perfil.find((p) => p.ticker === 'SI=F')?.separacion).toBeCloseTo(1)
    expect(perfil.find((p) => p.ticker === 'GC=F')?.separacion).toBeCloseTo(0)
  })

  it('sin control ni hechos deja la separación en null en vez de en cero', () => {
    // Cero significaría «no distingue»; null significa «no se sabe».
    const perfil = perfilNormalidad([])
    expect(perfil.every((p) => p.separacion === null)).toBe(true)
    expect(perfil.every((p) => p.n === 0)).toBe(true)
  })
})
