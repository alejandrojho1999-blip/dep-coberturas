import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Sidebar } from './Sidebar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

describe('Sidebar', () => {
  it('renderiza los items de navegación', () => {
    render(<Sidebar />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Inversión Causal')).toBeInTheDocument()
    expect(screen.getByText('Portafolios Híbridos')).toBeInTheDocument()
    expect(screen.getByText('Agente PPO')).toBeInTheDocument()
    expect(screen.getByText('Coberturas')).toBeInTheDocument()
    expect(screen.getByText('Mi Perfil')).toBeInTheDocument()
  })

  it('colapsa y expande al hacer click en el toggle', () => {
    render(<Sidebar />)
    const toggle = screen.getByRole('button', { name: /colapsar|expandir/i })
    fireEvent.click(toggle)
    expect(toggle).toBeInTheDocument()
  })
})
