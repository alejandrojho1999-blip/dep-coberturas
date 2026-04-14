import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import NewAssetForm from './NewAssetForm'

describe('NewAssetForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders ticker and name inputs and two buttons', () => {
    render(<NewAssetForm onCreated={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByPlaceholderText('MSFT')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Microsoft Corporation')).toBeInTheDocument()
    expect(screen.getByText('Crear activo')).toBeInTheDocument()
    expect(screen.getByText('Cancelar')).toBeInTheDocument()
  })

  it('calls onCancel when Cancelar is clicked', () => {
    const onCancel = vi.fn()
    render(<NewAssetForm onCreated={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancelar'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('disables submit button when inputs are empty', () => {
    render(<NewAssetForm onCreated={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Crear activo')).toBeDisabled()
  })

  it('POSTs to /api/causal/assets and calls onCreated with result', async () => {
    const fakeAsset = {
      id: 'new-id',
      ticker: 'MSFT',
      config: {},
      last_run_at: null,
      last_score: null,
      last_signal: null,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ asset: fakeAsset }),
    }))

    const onCreated = vi.fn()
    render(<NewAssetForm onCreated={onCreated} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('MSFT'), { target: { value: 'MSFT' } })
    fireEvent.change(screen.getByPlaceholderText('Microsoft Corporation'), {
      target: { value: 'Microsoft Corporation' },
    })
    fireEvent.click(screen.getByText('Crear activo'))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(fakeAsset))

    expect(fetch).toHaveBeenCalledWith(
      '/api/causal/assets',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls
    const body = JSON.parse((calls[0][1] as RequestInit).body as string) as { ticker: string }
    expect(body.ticker).toBe('MSFT')
  })

  it('shows error message when API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Supabase error' }),
    }))

    render(<NewAssetForm onCreated={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('MSFT'), { target: { value: 'GOOG' } })
    fireEvent.change(screen.getByPlaceholderText('Microsoft Corporation'), {
      target: { value: 'Alphabet' },
    })
    fireEvent.click(screen.getByText('Crear activo'))

    await waitFor(() => expect(screen.getByText('Supabase error')).toBeInTheDocument())
  })
})
