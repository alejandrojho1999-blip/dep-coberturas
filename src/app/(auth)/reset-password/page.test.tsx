import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ResetPasswordPage from './page'

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}))

describe('ResetPasswordPage', () => {
  it('renderiza el formulario de reset', () => {
    render(<ResetPasswordPage />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enviar instrucciones/i })).toBeInTheDocument()
  })

  it('muestra link de vuelta al login', () => {
    render(<ResetPasswordPage />)
    expect(screen.getByText(/volver al login/i)).toBeInTheDocument()
  })
})
