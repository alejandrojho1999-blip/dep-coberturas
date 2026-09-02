import { render, screen, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { UMBRAL_MATERIAL } from '@/lib/alertas/calibracion'
import type { EventoMedido } from '@/lib/alertas/backtesting'
import { FichaBacktesting } from './FichaBacktesting'

/**
 * Lo que se prueba no es el maquetado sino que la pantalla no mienta: que un
 * nulo no se lea como un cero, que el veredicto de «movió» coincida con los
 * umbrales, y que la advertencia del sesgo del corpus siga ahí. Una tabla de
 * backtesting sin esa advertencia se lee como si fuera concluyente.
 */

const EVENTOS: EventoMedido[] = [
  {
    fecha: '2022-02-24',
    titulo: 'Rusia invade Ucrania',
    tramo: 'principal',
    tema: 'guerra',
    clase: 'invasion',
    severidad: 5,
    nota: null,
    movimientos: [
      { ticker: 'GC=F', ventana: 5, retorno: 0.006, extremo: UMBRAL_MATERIAL['GC=F'] * 1.3 },
      { ticker: '^VIX', ventana: 5, retorno: 0.20, extremo: UMBRAL_MATERIAL['^VIX'] * 1.1 },
      { ticker: 'ES=F', ventana: 5, retorno: -0.03, extremo: -UMBRAL_MATERIAL['ES=F'] * 1.2 },
    ],
  },
  {
    fecha: '2023-06-24',
    titulo: 'Motín del grupo Wagner',
    tramo: 'principal',
    tema: 'guerra',
    clase: 'inestabilidad-interna',
    severidad: 2,
    nota: null,
    movimientos: [
      { ticker: 'GC=F', ventana: 5, retorno: 0.001, extremo: UMBRAL_MATERIAL['GC=F'] * 0.03 },
      { ticker: '^VIX', ventana: 5, retorno: 0.094, extremo: UMBRAL_MATERIAL['^VIX'] * 0.24 },
      // Sin ES=F: la celda debe salir como raya, no como 0,0%.
    ],
  },
  {
    fecha: '2001-09-11',
    titulo: 'Atentados del 11 de septiembre',
    tramo: 'control_shocks',
    tema: 'guerra',
    clase: 'invasion',
    severidad: 5,
    nota: null,
    movimientos: [{ ticker: 'GC=F', ventana: 5, retorno: 0.064, extremo: UMBRAL_MATERIAL['GC=F'] * 1.4 }],
  },
]

describe('FichaBacktesting', () => {
  /** El valor de una tarjeta del resumen, buscado por su etiqueta. */
  function cifra(etiqueta: string): string {
    const dt = screen.getByText(etiqueta)
    return dt.parentElement?.querySelector('dd')?.textContent ?? ''
  }

  it('resume el corpus en cifras', () => {
    render(<FichaBacktesting eventos={EVENTOS} />)
    expect(cifra('Eventos')).toBe('3')
    // Seis mediciones entre los tres eventos: 3 + 2 + 1.
    expect(cifra('Mediciones')).toBe('6')
    // Wagner no llega a ningún umbral: las dos invasiones sí.
    expect(cifra('Movieron el precio')).toBe('2 de 3')
  })

  it('cuenta los leves que sí movieron, que es el caso que corrige el sistema', () => {
    render(<FichaBacktesting eventos={EVENTOS} />)
    // Wagner es severidad 2 y no movió; ninguno de los otros es leve.
    expect(cifra('Leves con efecto')).toBe('0')
    expect(cifra('Graves sin efecto')).toBe('0')
  })

  it('separa los tramos, que no son comparables entre sí', () => {
    render(<FichaBacktesting eventos={EVENTOS} />)
    expect(screen.getByText('Principal (2022→hoy)')).toBeInTheDocument()
    expect(screen.getByText('Control de shocks')).toBeInTheDocument()
  })

  it('agrupa por familia de suceso con sus casos', () => {
    render(<FichaBacktesting eventos={EVENTOS} />)
    const invasion = screen.getByText('invasion').closest('tr')
    expect(invasion).not.toBeNull()
    // Las dos invasiones, y las dos movieron el precio.
    expect(within(invasion!).getByText('2 de 2')).toBeInTheDocument()
  })

  it('escribe una raya donde no hay medición, nunca un cero', () => {
    render(<FichaBacktesting eventos={EVENTOS} />)
    const wagner = screen.getByText('Motín del grupo Wagner').closest('tr')
    expect(within(wagner!).getByText('—')).toBeInTheDocument()
  })

  it('el veredicto de "movió" sigue los umbrales, no la severidad', () => {
    render(<FichaBacktesting eventos={EVENTOS} />)
    const wagner = screen.getByText('Motín del grupo Wagner').closest('tr')
    // Severidad 2 pero el VIX no llegó a su umbral del 20%: no movió.
    expect(within(wagner!).getByText('no')).toBeInTheDocument()

    const invasion = screen.getByText('Rusia invade Ucrania').closest('tr')
    expect(within(invasion!).getByText('sí')).toBeInTheDocument()
  })

  it('advierte del sesgo de selección que impide aplicar la curva', () => {
    render(<FichaBacktesting eventos={EVENTOS} />)
    expect(screen.getByText('Qué NO se puede concluir de esta tabla')).toBeInTheDocument()
    expect(screen.getByText(/elegidos por\s+haber sido importantes/)).toBeInTheDocument()
    expect(screen.getByText(/Correlación no es causa/)).toBeInTheDocument()
  })

  it('publica los umbrales con los que se juzga cada activo', () => {
    render(<FichaBacktesting eventos={EVENTOS} />)
    const fila = screen.getByText('BTC-USD').closest('tr')
    // Contra la constante y no contra una cifra: los umbrales se recalibran.
    const esperado = `${(UMBRAL_MATERIAL['BTC-USD'] * 100).toFixed(1)}%`
    expect(within(fila!).getByText(esperado)).toBeInTheDocument()
  })

  it('vuelve al registro', () => {
    render(<FichaBacktesting eventos={EVENTOS} />)
    expect(screen.getByRole('link', { name: /volver al registro/i })).toHaveAttribute('href', '/alertas')
  })

  it('no revienta con el corpus vacío', () => {
    render(<FichaBacktesting eventos={[]} />)
    expect(screen.getByText('El corpus en cifras')).toBeInTheDocument()
  })
})
