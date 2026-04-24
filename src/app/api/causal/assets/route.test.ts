import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
import type { CausalConfig } from '@/lib/causal/types'

// Mock the supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'

// Helper to create a NextRequest-like object
function makeRequest(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost/api/causal/assets', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/causal/assets', () => {
  const mockCreateClient = vi.mocked(createClient)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      // Mock getUser returning no user
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
          }),
        },
      }
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const request = makeRequest({
        ticker: 'AAPL',
        config: { ticker: 'AAPL', name: 'Apple' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('calls getUser to check authentication', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
          }),
        },
      }
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const request = makeRequest({
        ticker: 'AAPL',
        config: { ticker: 'AAPL', name: 'Apple' },
      })

      await POST(request)

      expect(mockSupabase.auth.getUser).toHaveBeenCalled()
    })
  })

  describe('Validation', () => {
    it('returns 400 when ticker is missing', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
      }
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const request = makeRequest({
        config: { ticker: 'AAPL', name: 'Apple' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing required fields')
    })

    it('returns 400 when config is missing', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
      }
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const request = makeRequest({
        ticker: 'AAPL',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing required fields')
    })

    it('returns 400 when both ticker and config are missing', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
      }
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const request = makeRequest({})

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing required fields')
    })

    it('returns 400 when ticker is empty string', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
      }
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const request = makeRequest({
        ticker: '',
        config: { ticker: 'AAPL', name: 'Apple' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
    })

    it('returns 400 when config is null', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
      }
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const request = makeRequest({
        ticker: 'AAPL',
        config: null,
      })

      const response = await POST(request)

      // config is null, which is falsy
      expect(response.status).toBe(400)
    })
  })

  describe('Success - Insert and Return Asset', () => {
    it('returns 201 with created asset when valid request', async () => {
      const mockAsset = {
        id: 'asset-123',
        ticker: 'AAPL',
        config: { ticker: 'AAPL', name: 'Apple Inc.' },
        last_run_at: null,
        last_score: null,
        last_signal: null,
      }

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockAsset,
                error: null,
              }),
            }),
          }),
        }),
      }
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const config: CausalConfig = {
        ticker: 'AAPL',
        name: 'Apple Inc.',
        treatment: 'CAPEX_Growth',
        outcome: 'Future_Return',
        horizon: 2,
        confounders: ['FED_RATE', 'VIX'],
        excluded: {},
        dagEdges: [],
      }

      const request = makeRequest({
        ticker: 'AAPL',
        config,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.asset).toBeDefined()
      expect(data.asset.id).toBe('asset-123')
      expect(data.asset.ticker).toBe('AAPL')
      expect(data.asset.config.name).toBe('Apple Inc.')
    })

    it('inserts asset with correct user_id', async () => {
      const mockAsset = {
        id: 'asset-123',
        ticker: 'AAPL',
        config: { ticker: 'AAPL', name: 'Apple Inc.' },
        last_run_at: null,
        last_score: null,
        last_signal: null,
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockAsset,
            error: null,
          }),
        }),
      })

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      }
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const config: CausalConfig = {
        ticker: 'AAPL',
        name: 'Apple Inc.',
        treatment: 'CAPEX_Growth',
        outcome: 'Future_Return',
        horizon: 2,
        confounders: [],
        excluded: {},
        dagEdges: [],
      }

      const request = makeRequest({
        ticker: 'AAPL',
        config,
      })

      await POST(request)

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'user-123',
        ticker: 'AAPL',
        name: 'AAPL',
        config,
        ir_url: undefined,
        treatment: undefined,
        sector: undefined,
      })
    })

    it('selects correct columns when inserting', async () => {
      const mockAsset = {
        id: 'asset-123',
        ticker: 'AAPL',
        config: { ticker: 'AAPL', name: 'Apple Inc.' },
        last_run_at: null,
        last_score: null,
        last_signal: null,
      }

      const mockSelect = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockAsset,
          error: null,
        }),
      })

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: mockSelect,
          }),
        }),
      }
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const request = makeRequest({
        ticker: 'AAPL',
        config: { ticker: 'AAPL', name: 'Apple Inc.' },
      })

      await POST(request)

      expect(mockSelect).toHaveBeenCalledWith(
        'id, ticker, config, last_run_at, last_score, last_signal'
      )
    })

    it('returns asset with all expected fields', async () => {
      const mockAsset = {
        id: 'asset-456',
        ticker: 'GOOGL',
        config: { ticker: 'GOOGL', name: 'Alphabet Inc.' },
        last_run_at: '2026-04-14T10:00:00Z',
        last_score: 0.85,
        last_signal: 'BUY',
      }

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-456' } },
          }),
        },
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockAsset,
                error: null,
              }),
            }),
          }),
        }),
      }
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const request = makeRequest({
        ticker: 'GOOGL',
        config: { ticker: 'GOOGL', name: 'Alphabet Inc.' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.asset.id).toBe('asset-456')
      expect(data.asset.ticker).toBe('GOOGL')
      expect(data.asset.last_run_at).toBe('2026-04-14T10:00:00Z')
      expect(data.asset.last_score).toBe(0.85)
      expect(data.asset.last_signal).toBe('BUY')
    })
  })

  describe('Error Handling', () => {
    it('returns 500 when insert fails', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Unique constraint violation' },
              }),
            }),
          }),
        }),
      }
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const request = makeRequest({
        ticker: 'AAPL',
        config: { ticker: 'AAPL', name: 'Apple Inc.' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Unique constraint violation')
    })

    it('returns error message from database', async () => {
      const errorMessage = 'Database connection failed'

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: errorMessage },
              }),
            }),
          }),
        }),
      }
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const request = makeRequest({
        ticker: 'AAPL',
        config: { ticker: 'AAPL', name: 'Apple Inc.' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.error).toBe(errorMessage)
    })
  })

  describe('Integration', () => {
    it('handles complete flow: auth -> validate -> insert -> return', async () => {
      const mockAsset = {
        id: 'asset-789',
        ticker: 'MSFT',
        config: { ticker: 'MSFT', name: 'Microsoft' },
        last_run_at: null,
        last_score: null,
        last_signal: null,
      }

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-789' } },
          }),
        },
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockAsset,
                error: null,
              }),
            }),
          }),
        }),
      }
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const config: CausalConfig = {
        ticker: 'MSFT',
        name: 'Microsoft',
        treatment: 'R&D_Spend',
        outcome: 'Revenue_Growth',
        horizon: 2,
        confounders: ['Tech_Index'],
        excluded: {},
        dagEdges: [],
      }

      const request = makeRequest({
        ticker: 'MSFT',
        config,
      })

      const response = await POST(request)
      const data = await response.json()

      // Verify complete flow
      expect(mockCreateClient).toHaveBeenCalled()
      expect(mockSupabase.auth.getUser).toHaveBeenCalled()
      expect(mockSupabase.from).toHaveBeenCalledWith('causal_assets')
      expect(response.status).toBe(201)
      expect(data.asset.ticker).toBe('MSFT')
    })

    it('does not call database if auth fails', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
          }),
        },
        from: vi.fn(),
      }
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const request = makeRequest({
        ticker: 'AAPL',
        config: { ticker: 'AAPL', name: 'Apple Inc.' },
      })

      await POST(request)

      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('does not call database if validation fails', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
        from: vi.fn(),
      }
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const request = makeRequest({
        ticker: 'AAPL',
        // missing config
      })

      await POST(request)

      expect(mockSupabase.from).not.toHaveBeenCalled()
    })
  })
})
