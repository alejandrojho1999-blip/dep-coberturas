import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import NewAssetForm from './NewAssetForm'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('NewAssetForm', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders search input and buttons', () => {
    render(<NewAssetForm onCreated={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByPlaceholderText(/Buscar ticker/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancelar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Crear activo/i })).toBeDisabled()
  })

  it('calls onCancel when Cancelar is clicked', () => {
    const onCancel = vi.fn()
    render(<NewAssetForm onCreated={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('disables submit button when nothing is selected', () => {
    render(<NewAssetForm onCreated={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Crear activo/i })).toBeDisabled()
  })

  it('does not fetch when query is less than 2 chars', async () => {
    render(<NewAssetForm onCreated={vi.fn()} onCancel={vi.fn()} />)

    const input = screen.getByPlaceholderText(/Buscar ticker/i)
    fireEvent.change(input, { target: { value: 'a' } })

    await act(async () => {
      vi.runAllTimers()
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches suggestions after typing at least 2 chars with debounce', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NMS' }],
      }),
    })

    render(<NewAssetForm onCreated={vi.fn()} onCancel={vi.fn()} />)

    const input = screen.getByPlaceholderText(/Buscar ticker/i)
    fireEvent.change(input, { target: { value: 'ap' } })

    // Should not fetch yet (debounce)
    expect(mockFetch).not.toHaveBeenCalled()

    // Advance timers past debounce and flush promises
    await act(async () => {
      vi.runAllTimers()
      await Promise.resolve()
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/causal/search?q=ap'
    )
  })

  it('shows suggestions in dropdown after search', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NMS' },
          { symbol: 'AAPX', name: 'Apple Express', exchange: 'NYSE' },
        ],
      }),
    })

    render(<NewAssetForm onCreated={vi.fn()} onCancel={vi.fn()} />)

    const input = screen.getByPlaceholderText(/Buscar ticker/i)
    fireEvent.change(input, { target: { value: 'aapl' } })

    await act(async () => {
      vi.runAllTimers()
      // Flush the fetch promise chain
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
  })

  it('selecting a suggestion enables the submit button and updates input', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NMS' }],
      }),
    })

    render(<NewAssetForm onCreated={vi.fn()} onCancel={vi.fn()} />)

    const input = screen.getByPlaceholderText(/Buscar ticker/i)
    fireEvent.change(input, { target: { value: 'msft' } })

    await act(async () => {
      vi.runAllTimers()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    fireEvent.click(screen.getByText('MSFT'))

    expect((input as HTMLInputElement).value).toBe('MSFT — Microsoft Corporation')
    expect(screen.getByRole('button', { name: /Crear activo/i })).not.toBeDisabled()
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

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NMS' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ asset: fakeAsset }),
      })

    const onCreated = vi.fn()
    render(<NewAssetForm onCreated={onCreated} onCancel={vi.fn()} />)

    const input = screen.getByPlaceholderText(/Buscar ticker/i)
    fireEvent.change(input, { target: { value: 'msft' } })

    await act(async () => {
      vi.runAllTimers()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    fireEvent.click(screen.getByText('MSFT'))

    // Switch to real timers before awaiting the POST
    vi.useRealTimers()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Crear activo/i }))
    })

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(fakeAsset))

    const postCall = mockFetch.mock.calls.find(
      (call) => typeof call[1] === 'object' && (call[1] as RequestInit).method === 'POST'
    )
    expect(postCall).toBeDefined()
    const body = JSON.parse((postCall![1] as RequestInit).body as string) as { ticker: string }
    expect(body.ticker).toBe('MSFT')
  })

  it('shows error message when API fails', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ symbol: 'GOOG', name: 'Alphabet Inc.', exchange: 'NMS' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Supabase error' }),
      })

    render(<NewAssetForm onCreated={vi.fn()} onCancel={vi.fn()} />)

    const input = screen.getByPlaceholderText(/Buscar ticker/i)
    fireEvent.change(input, { target: { value: 'goog' } })

    await act(async () => {
      vi.runAllTimers()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    fireEvent.click(screen.getByText('GOOG'))

    // Switch to real timers before awaiting the POST
    vi.useRealTimers()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Crear activo/i }))
    })

    await waitFor(() => expect(screen.getByText('Supabase error')).toBeInTheDocument())
  })
})
