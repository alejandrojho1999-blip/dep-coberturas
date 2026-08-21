import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Sidebar } from './Sidebar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/agentes',
}))

describe('Sidebar', () => {
  it('renderiza los items de navegación', () => {
    render(<Sidebar mobileOpen={false} onMobileClose={() => {}} />)
    expect(screen.getByText('Portafolios')).toBeInTheDocument()
    expect(screen.getByText('Agentes')).toBeInTheDocument()
    expect(screen.getByText('Estrategias')).toBeInTheDocument()
    expect(screen.getByText('Recomendaciones')).toBeInTheDocument()
  })

  it('sitúa Portafolios como primera entrada del menú', () => {
    render(<Sidebar mobileOpen={false} onMobileClose={() => {}} />)
    const labels = screen.getAllByRole('link').map(a => a.textContent)
    expect(labels[0]).toBe('Portafolios')
  })

  it('muestra Mi Perfil al abrir Configuración', () => {
    render(<Sidebar mobileOpen={false} onMobileClose={() => {}} />)
    // El submenú arranca cerrado en rutas que no son /perfil ni /fincept-terminal.
    expect(screen.queryByText('Mi Perfil')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Configuración'))
    expect(screen.getByText('Mi Perfil')).toBeInTheDocument()
  })

  it('no muestra los módulos retirados del menú', () => {
    render(<Sidebar mobileOpen={false} onMobileClose={() => {}} />)
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('ERGOS QUANT')).not.toBeInTheDocument()
  })

  it('colapsa y expande al hacer click en el toggle', () => {
    render(<Sidebar mobileOpen={false} onMobileClose={() => {}} />)
    const toggle = screen.getByRole('button', { name: /colapsar|expandir/i })
    fireEvent.click(toggle)
    expect(toggle).toBeInTheDocument()
  })
})
