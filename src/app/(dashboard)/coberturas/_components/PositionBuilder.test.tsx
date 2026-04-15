import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PositionBuilder from './PositionBuilder'

describe('PositionBuilder', () => {
  it('renders empty state message when no positions', () => {
    render(<PositionBuilder />)
    expect(screen.getByText('Agrega posiciones para ver el análisis')).toBeInTheDocument()
  })

  it('can add a stock position and see it in the list', () => {
    render(<PositionBuilder />)

    // Open form
    fireEvent.click(screen.getByText('+ Agregar posición'))

    // Stock is selected by default — just set quantity and S then submit
    const inputs = screen.getAllByRole('spinbutton')
    // inputs[0] = quantity, inputs[1] = S
    fireEvent.change(inputs[0], { target: { value: '100' } })
    fireEvent.change(inputs[1], { target: { value: '150' } })

    fireEvent.click(screen.getByText('Agregar'))

    // Position should now appear in the list
    expect(screen.getByText(/acciones/)).toBeInTheDocument()

    // Empty state message should be gone
    expect(screen.queryByText('Agrega posiciones para ver el análisis')).not.toBeInTheDocument()
  })

  it('can remove a position', () => {
    render(<PositionBuilder />)

    // Add a stock position
    fireEvent.click(screen.getByText('+ Agregar posición'))
    fireEvent.click(screen.getByText('Agregar'))

    // Position exists
    expect(screen.getByLabelText('Eliminar posición')).toBeInTheDocument()

    // Remove it
    fireEvent.click(screen.getByLabelText('Eliminar posición'))

    // Empty state returns
    expect(screen.getByText('Agrega posiciones para ver el análisis')).toBeInTheDocument()
  })

  it('portfolio delta updates when positions are added', () => {
    render(<PositionBuilder />)

    // Before adding — no delta shown (aggregate metrics section absent)
    expect(screen.queryByText('Delta total del portafolio')).not.toBeInTheDocument()

    // Add a stock position (100 shares, S=100 → delta = 100)
    fireEvent.click(screen.getByText('+ Agregar posición'))
    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[0], { target: { value: '100' } })
    fireEvent.click(screen.getByText('Agregar'))

    // Aggregate metrics should now be visible
    expect(screen.getByText('Delta total del portafolio')).toBeInTheDocument()

    // Delta value: 100 shares × 1.0 = 100.00
    expect(screen.getByText('100.00')).toBeInTheDocument()
  })

  it('shows "Agregar opción analizada" button when defaultOption is provided', () => {
    const opt = { type: 'call' as const, S: 100, K: 100, T: 0.25, r: 0.05, sigma: 0.25 }
    render(<PositionBuilder defaultOption={opt} />)
    expect(screen.getByText('+ Agregar opción analizada')).toBeInTheDocument()
  })

  it('pre-fills form when "Agregar opción analizada" is clicked', () => {
    const opt = { type: 'call' as const, S: 200, K: 210, T: 0.5, r: 0.04, sigma: 0.30 }
    render(<PositionBuilder defaultOption={opt} />)

    fireEvent.click(screen.getByText('+ Agregar opción analizada'))

    // Form should be visible with the option's S pre-filled (value="200")
    const inputs = screen.getAllByRole('spinbutton')
    const sInput = inputs.find((el) => (el as HTMLInputElement).value === '200')
    expect(sInput).toBeDefined()
  })
})
