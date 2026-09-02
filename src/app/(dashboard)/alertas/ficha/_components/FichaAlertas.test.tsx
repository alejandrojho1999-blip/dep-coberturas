import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { FichaAlertas } from './FichaAlertas'

/**
 * La ficha es documentación: lo que se prueba no es el maquetado sino que las
 * secciones que dan sentido al sistema estén presentes. Una ficha a la que le
 * falta la sección de límites es peor que no tener ficha, porque se lee como si
 * no los tuviera.
 */
describe('FichaAlertas', () => {
  it('documenta las secciones obligatorias', () => {
    render(<FichaAlertas />)
    for (const titulo of [
      'Dónde corre y por qué ahí',
      'Los ocho ciclos',
      'De dónde salen los datos',
      'Cómo se decide que algo importa',
      'Cómo llega el aviso',
      'Las curvas de probabilidad',
      'Lo que este sistema no sabe hacer',
    ]) {
      expect(screen.getByText(titulo)).toBeInTheDocument()
    }
  })

  it('lista los ocho ciclos con su cadencia', () => {
    render(<FichaAlertas />)
    expect(screen.getByText('Escalada Rusia–OTAN')).toBeInTheDocument()
    expect(screen.getByText('cada 2 min')).toBeInTheDocument()
    expect(screen.getByText('Probabilidad del día')).toBeInTheDocument()
    expect(screen.getByText('07:00')).toBeInTheDocument()
  })

  it('nombra las series macro que alimentan el panel, incluida la inflación', () => {
    render(<FichaAlertas />)
    const fred = screen.getByText(/CPIAUCSL/)
    expect(fred).toHaveTextContent('CPILFESL')
    expect(fred).toHaveTextContent('DFII10')
  })

  it('vuelve al registro', () => {
    render(<FichaAlertas />)
    expect(screen.getByRole('link', { name: /volver al registro/i })).toHaveAttribute('href', '/alertas')
  })
})
