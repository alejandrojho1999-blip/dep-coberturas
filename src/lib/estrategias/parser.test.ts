import { describe, expect, it } from 'vitest'
import {
  concentracion,
  curva,
  parseFecha,
  parseImporte,
  parseTrades,
  pnlDiario,
  porAnio,
  profitFactor,
  regimen,
} from '../../../scripts/build-estrategias.mjs'

/**
 * El parser de los CSV del Strategy Analyzer es la pieza de la que depende toda
 * la sección de Estrategias: si lee mal un importe o una fecha, todas las
 * cifras publicadas quedan mal sin que nada falle a la vista.
 */

const CABECERA =
  'Trade number;Instrument;Account;Strategy;Market pos.;Qty;Entry price;Exit price;' +
  'Entry time;Exit time;Entry name;Exit name;Profit;Cum. net profit;Commission;' +
  'Clearing Fee;Exchange Fee;IP Fee;NFA Fee;MAE;MFE;ETD;Bars;'

function fila(opciones: { salida: string; profit: string; entrada?: string }) {
  const { salida, profit, entrada = salida } = opciones
  return (
    `1;NQ 09-26;Backtest;BOT;Long;1;100,00;110,00;${entrada} 17:00:00;${salida} 17:00:00;` +
    `Ent;Sal;${profit};$0,00;$5,76;$0,00;$0,00;$0,00;$0,00;$10,00;$20,00;$1,00;2;`
  )
}

describe('parseImporte', () => {
  it('lee importes con símbolo, millares y coma decimal', () => {
    expect(parseImporte('$1.155,76')).toBe(1155.76)
    expect(parseImporte('$-1.155,76')).toBe(-1155.76)
    expect(parseImporte('$0,00')).toBe(0)
  })

  it('lee importes sin separador de millares', () => {
    expect(parseImporte('$63686,48')).toBe(63686.48)
    expect(parseImporte('$-705,76')).toBe(-705.76)
  })

  it('devuelve NaN en celdas vacías en vez de cero', () => {
    // Un cero silencioso falsearía el neto; NaN permite descartar la fila.
    expect(parseImporte('')).toBeNaN()
    expect(parseImporte(null)).toBeNaN()
  })
})

describe('parseFecha', () => {
  it('interpreta el día primero, no el mes', () => {
    // 12/2/2015 es 12 de febrero, no 2 de diciembre.
    expect(parseFecha('12/2/2015 10:30:00')).toBe('2015-02-12')
    expect(parseFecha('3/3/2026 17:00:00')).toBe('2026-03-03')
  })

  it('rellena con ceros para que las fechas ordenen como texto', () => {
    expect(parseFecha('5/1/2016 17:00:00')).toBe('2016-01-05')
  })
})

describe('parseTrades', () => {
  const csv = [
    CABECERA,
    fila({ salida: '10/1/2019', profit: '$1.000,00' }),
    fila({ salida: '20/1/2019', profit: '$-400,00' }),
  ].join('\r\n')

  it('escala de NQ a MNQ dividiendo por diez', () => {
    const trades = parseTrades(csv)
    expect(trades).toHaveLength(2)
    expect(trades[0].pnl).toBe(100)
    expect(trades[1].pnl).toBe(-40)
  })

  it('usa la fecha de salida para atribuir el resultado', () => {
    const trades = parseTrades(
      [CABECERA, fila({ entrada: '28/12/2019', salida: '3/1/2020', profit: '$500,00' })].join('\r\n')
    )
    // La operación entra en 2019 y sale en 2020: cuenta en 2020.
    expect(trades[0].salida).toBe('2020-01-03')
    expect(porAnio(trades)[0].anio).toBe('2020')
  })
})

describe('curva y drawdown', () => {
  it('mide el drawdown sobre la curva, no como suma de pérdidas', () => {
    const diario = [
      { fecha: '2020-01-01', pnl: 100 },
      { fecha: '2020-01-02', pnl: -30 },
      { fecha: '2020-01-03', pnl: -20 },
      { fecha: '2020-01-04', pnl: 80 },
    ]
    const { neto, maxDrawdown, fechaMaxDrawdown } = curva(diario)
    expect(neto).toBe(130)
    // Cae de 100 a 50: el peor momento son -50, no los -50 de sumar pérdidas
    // sueltas ni los -30 del peor día.
    expect(maxDrawdown).toBe(-50)
    expect(fechaMaxDrawdown).toBe('2020-01-03')
  })

  it('deja el drawdown en cero si la curva nunca cae', () => {
    const { maxDrawdown } = curva([
      { fecha: '2020-01-01', pnl: 10 },
      { fecha: '2020-01-02', pnl: 5 },
    ])
    expect(maxDrawdown).toBe(0)
  })
})

describe('pnlDiario', () => {
  it('agrupa por día y ordena cronológicamente', () => {
    const trades = parseTrades(
      [
        CABECERA,
        fila({ salida: '20/1/2019', profit: '$300,00' }),
        fila({ salida: '10/1/2019', profit: '$100,00' }),
        fila({ salida: '10/1/2019', profit: '$200,00' }),
      ].join('\r\n')
    )
    const diario = pnlDiario(trades)
    expect(diario).toEqual([
      { fecha: '2019-01-10', pnl: 30 },
      { fecha: '2019-01-20', pnl: 30 },
    ])
  })
})

describe('regimen', () => {
  it('corta en julio de 2020, con junio dentro del periodo antiguo', () => {
    const trades = parseTrades(
      [
        CABECERA,
        fila({ salida: '30/6/2020', profit: '$100,00' }),
        fila({ salida: '1/7/2020', profit: '$200,00' }),
        fila({ salida: '2/7/2020', profit: '$300,00' }),
      ].join('\r\n')
    )
    const r = regimen(trades)
    expect(r.corte).toBe('2020-07-01')
    expect(r.anterior?.operaciones).toBe(1)
    expect(r.posterior?.operaciones).toBe(2)
    expect(r.posterior?.neto).toBe(50)
  })
})

describe('profitFactor', () => {
  it('divide lo ganado entre lo perdido', () => {
    expect(profitFactor([{ pnl: 200 }, { pnl: 100 }, { pnl: -100 }])).toBe(3)
  })

  it('devuelve null si no hay pérdidas, en vez de infinito', () => {
    expect(profitFactor([{ pnl: 10 }])).toBeNull()
  })
})

describe('concentracion', () => {
  it('mide qué parte del neto aportan las mejores operaciones', () => {
    const trades = [{ pnl: 100 }, { pnl: 50 }, { pnl: 30 }, { pnl: 20 }, { pnl: -100 }]
    const tramos = concentracion(trades, 100)
    const top1 = tramos.find(t => t.top === 1)!
    // La mejor operación vale ella sola todo el beneficio neto.
    expect(top1.suma).toBe(100)
    expect(top1.porcentajeDelNeto).toBe(100)
    expect(top1.resto).toBe(0)
  })
})
