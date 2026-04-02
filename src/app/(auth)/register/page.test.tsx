import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RegisterPage from './page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}))

describe('RegisterPage', () => {
  it('renderiza el formulario de registro', () => {
    render(<RegisterPage />)
    expect(screen.getByLabelText('Nombre completo')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirmar contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crear cuenta/i })).toBeInTheDocument()
  })

  it('muestra link de vuelta al login', () => {
    render(<RegisterPage />)
    expect(screen.getByText(/ya tienes cuenta/i)).toBeInTheDocument()
  })
})
