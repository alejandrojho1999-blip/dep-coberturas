import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import LoginPage from './page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}))

describe('LoginPage', () => {
  it('renderiza el formulario de login', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ingresar al sistema/i })).toBeInTheDocument()
  })

  it('muestra links a register y reset-password', () => {
    render(<LoginPage />)
    expect(screen.getByText(/olvidaste tu contraseña/i)).toBeInTheDocument()
    expect(screen.getByText(/no tienes cuenta/i)).toBeInTheDocument()
  })
})
