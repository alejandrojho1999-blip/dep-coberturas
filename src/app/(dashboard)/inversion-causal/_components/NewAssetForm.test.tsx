'use client'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import NewAssetForm from './NewAssetForm'

const mockFetch = vi.fn()
global.fetch = mockFetch

// Helper: build a resolved fetch Response-like object
function ok(body: unknown) {
  return Promise.resolve({ ok: true, json: async () => body })
}
function fail(body: unknown = {}) {
  return Promise.resolve({ ok: false, json: async () => body })
}

// Default URL-routed mock — avoids crashing the component's useEffect
function defaultMock(url: string, opts?: RequestInit) {
  const u = String(url)
  if (u.includes('/api/causal/ir-discover')) return fail()        // triggers error path → default confounders
  if (u.includes('/api/causal/ir-extract'))  return ok({ treatment: 'FED_RATE', label: 'Fed Rate', rationale: '', confounders: [], colliders: [] })
  if (opts?.method === 'POST' && u.includes('/api/causal/variables')) return ok({})
  return ok({ variables: [], results: [] })                       // covers variables + search fallback
}

describe('NewAssetForm', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockFetch.mockReset()
    mockFetch.mockImplementation(defaultMock)
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

  it('does not fetch search when query is less than 2 chars', async () => {
    render(<NewAssetForm onCreated={vi.fn()} onCancel={vi.fn()} />)

    const input = screen.getByPlaceholderText(/Buscar ticker/i)
    fireEvent.change(input, { target: { value: 'a' } })

    await act(async () => { vi.runAllTimers() })

    const searchCalls = mockFetch.mock.calls.filter(([url]) =>
      String(url).includes('/api/causal/search')
    )
    expect(searchCalls.length).toBe(0)
  })

  it('fetches suggestions after typing at least 2 chars with debounce', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (String(url).includes('/api/causal/search')) {
        return ok({ results: [{ symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NMS' }] })
      }
      return defaultMock(url)
    })

    render(<NewAssetForm onCreated={vi.fn()} onCancel={vi.fn()} />)

    const input = screen.getByPlaceholderText(/Buscar ticker/i)
    fireEvent.change(input, { target: { value: 'ap' } })

    // No search call before debounce fires
    const searchBefore = mockFetch.mock.calls.filter(([url]) => String(url).includes('search'))
    expect(searchBefore.length).toBe(0)

    await act(async () => {
      vi.runAllTimers()
      await Promise.resolve()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/causal/search?q=ap')
  })

  it('selecting a suggestion enables the submit button and updates input', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (String(url).includes('/api/causal/search')) {
        return ok({ results: [{ symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NMS' }] })
      }
      return defaultMock(url)
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

    await act(async () => {
      fireEvent.click(screen.getByText('MSFT'))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect((input as HTMLInputElement).value).toBe('MSFT — Microsoft Corporation')
    expect(screen.getByRole('button', { name: /Crear activo/i })).not.toBeDisabled()
  })

  it('POSTs to /api/causal/assets and calls onCreated with result', async () => {
    const fakeAsset = {
      id: 'new-id', ticker: 'MSFT', config: {},
      last_run_at: null, last_score: null, last_signal: null,
    }

    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (String(url).includes('/api/causal/search')) {
        return ok({ results: [{ symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NMS' }] })
      }
      if (opts?.method === 'POST' && String(url).includes('/api/causal/assets')) {
        return ok({ asset: fakeAsset })
      }
      return defaultMock(url, opts)
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

    await act(async () => {
      fireEvent.click(screen.getByText('MSFT'))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    vi.useRealTimers()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Crear activo/i }))
    })

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(fakeAsset))

    const postCall = mockFetch.mock.calls.find(
      ([url, opts]) => (opts as RequestInit)?.method === 'POST' && String(url).includes('/api/causal/assets')
    )
    expect(postCall).toBeDefined()
    const body = JSON.parse((postCall![1] as RequestInit).body as string) as { ticker: string }
    expect(body.ticker).toBe('MSFT')
  })

  it('shows error message when API fails', async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (String(url).includes('/api/causal/search')) {
        return ok({ results: [{ symbol: 'GOOG', name: 'Alphabet Inc.', exchange: 'NMS' }] })
      }
      if (opts?.method === 'POST' && String(url).includes('/api/causal/assets')) {
        return fail({ error: 'Supabase error' })
      }
      return defaultMock(url, opts)
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

    await act(async () => {
      fireEvent.click(screen.getByText('GOOG'))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    vi.useRealTimers()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Crear activo/i }))
    })

    await waitFor(() => expect(screen.getByText('Supabase error')).toBeInTheDocument())
  })
})
