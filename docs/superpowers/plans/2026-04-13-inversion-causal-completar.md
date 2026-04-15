# Inversión Causal — Completar Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar 3 gaps en la sección de Inversión Causal: selector de activos, creación de nuevos activos desde la UI, y cableado del algoritmo PC al DagPanel.

**Architecture:** Se introduce `InversionCausalShell` como componente cliente que orquesta la selección de activos y el formulario de creación. `page.tsx` sigue siendo servidor. El algoritmo PC se ejecuta en cliente tras cada análisis y el resultado se pasa a `DagPanel`. Una nueva ruta API (`POST /api/causal/assets`) persiste los activos en Supabase.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Supabase, Vitest + @testing-library/react

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `src/app/api/causal/assets/route.ts` | Crear | POST — crear nuevo activo en `causal_assets` |
| `src/app/(dashboard)/inversion-causal/_components/AssetSelector.tsx` | Crear | Pill buttons para cambiar entre activos + botón "Nuevo activo" |
| `src/app/(dashboard)/inversion-causal/_components/NewAssetForm.tsx` | Crear | Formulario inline (ticker + nombre) para crear activo con template AAPL |
| `src/app/(dashboard)/inversion-causal/_components/InversionCausalShell.tsx` | Crear | Client wrapper: gestiona `activeId`, `assets[]`, `showNewForm` |
| `src/app/(dashboard)/inversion-causal/page.tsx` | Modificar | Simplificar — delegar a `InversionCausalShell` |
| `src/app/(dashboard)/inversion-causal/_components/CausalAnalysisClient.tsx` | Modificar | Ejecutar `runPC` tras análisis, pasar `pcResult` a `DagPanel` |

---

## Task 1: API route `POST /api/causal/assets`

**Files:**
- Create: `src/app/api/causal/assets/route.ts`

- [ ] **Step 1: Crear el archivo de la ruta**

```typescript
// src/app/api/causal/assets/route.ts
import { createClient } from '@/lib/supabase/server'
import type { CausalConfig } from '@/lib/causal/types'

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    ticker?: string
    name?: string
    config?: CausalConfig
  }
  const { ticker, name, config } = body

  if (!ticker || !name || !config) {
    return Response.json(
      { error: 'Missing required fields: ticker, name, config' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('causal_assets')
    .insert({ user_id: user.id, ticker, config })
    .select('id, ticker, config, last_run_at, last_score, last_signal')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ asset: data }, { status: 201 })
}
```

- [ ] **Step 2: Verificar que la ruta compila**

```bash
cd C:/Users/luis.riofrio/Proyectos/dep-coberturas
npx tsc --noEmit
```

Expected: sin errores de tipos.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/causal/assets/route.ts
git commit -m "feat: add POST /api/causal/assets route"
```

---

## Task 2: Componente `AssetSelector`

**Files:**
- Create: `src/app/(dashboard)/inversion-causal/_components/AssetSelector.tsx`
- Create: `src/app/(dashboard)/inversion-causal/_components/AssetSelector.test.tsx`

- [ ] **Step 1: Escribir el test**

```typescript
// src/app/(dashboard)/inversion-causal/_components/AssetSelector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AssetSelector from './AssetSelector'

const assets = [
  { id: 'a1', ticker: 'AAPL', last_score: 72, last_signal: 'AUMENTAR' },
  { id: 'a2', ticker: 'MSFT', last_score: 45, last_signal: 'MANTENER' },
]

describe('AssetSelector', () => {
  it('renders all asset tickers', () => {
    render(
      <AssetSelector
        assets={assets}
        activeId="a1"
        onSelect={vi.fn()}
        onNewAsset={vi.fn()}
      />
    )
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('MSFT')).toBeInTheDocument()
  })

  it('calls onSelect with asset id when a pill is clicked', () => {
    const onSelect = vi.fn()
    render(
      <AssetSelector
        assets={assets}
        activeId="a1"
        onSelect={onSelect}
        onNewAsset={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('MSFT'))
    expect(onSelect).toHaveBeenCalledWith('a2')
  })

  it('calls onNewAsset when + Nuevo activo is clicked', () => {
    const onNewAsset = vi.fn()
    render(
      <AssetSelector
        assets={assets}
        activeId="a1"
        onSelect={vi.fn()}
        onNewAsset={onNewAsset}
      />
    )
    fireEvent.click(screen.getByText('+ Nuevo activo'))
    expect(onNewAsset).toHaveBeenCalled()
  })

  it('applies active style to activeId pill', () => {
    const { container } = render(
      <AssetSelector
        assets={assets}
        activeId="a1"
        onSelect={vi.fn()}
        onNewAsset={vi.fn()}
      />
    )
    const pills = container.querySelectorAll('button')
    // First pill (AAPL) has active border class
    expect(pills[0].className).toContain('border-[#00ff88]')
    expect(pills[1].className).not.toContain('border-[#00ff88]')
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx vitest run src/app/\(dashboard\)/inversion-causal/_components/AssetSelector.test.tsx
```

Expected: FAIL — cannot find module `./AssetSelector`

- [ ] **Step 3: Implementar el componente**

```typescript
// src/app/(dashboard)/inversion-causal/_components/AssetSelector.tsx
'use client'

interface CausalAsset {
  id: string
  ticker: string
  last_score: number | null
  last_signal: string | null
}

interface Props {
  assets: CausalAsset[]
  activeId: string | null
  onSelect: (id: string) => void
  onNewAsset: () => void
}

function signalColor(signal: string | null): string {
  if (signal === 'AUMENTAR') return 'text-[#00ff88]'
  if (signal === 'REDUCIR') return 'text-red-400'
  return 'text-blue-400'
}

export default function AssetSelector({ assets, activeId, onSelect, onNewAsset }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {assets.map((asset) => (
        <button
          key={asset.id}
          onClick={() => onSelect(asset.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
            activeId === asset.id
              ? 'border-[#00ff88] bg-[#00ff88]/10 text-[#e2e8f0]'
              : 'border-[#1e1e2e] bg-[#12121a] text-[#64748b] hover:border-[#3b82f6] hover:text-[#e2e8f0]'
          }`}
        >
          <span>{asset.ticker}</span>
          {asset.last_signal && (
            <span className={`text-xs ${signalColor(asset.last_signal)}`}>
              {asset.last_score?.toFixed(0)}
            </span>
          )}
        </button>
      ))}

      <button
        onClick={onNewAsset}
        className="px-4 py-2 rounded-xl border border-dashed border-[#1e1e2e] text-[#64748b] text-sm font-medium hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors"
      >
        + Nuevo activo
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npx vitest run src/app/\(dashboard\)/inversion-causal/_components/AssetSelector.test.tsx
```

Expected: PASS — 4 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/inversion-causal/_components/AssetSelector.tsx \
        src/app/\(dashboard\)/inversion-causal/_components/AssetSelector.test.tsx
git commit -m "feat: add AssetSelector component for causal assets"
```

---

## Task 3: Componente `NewAssetForm`

**Files:**
- Create: `src/app/(dashboard)/inversion-causal/_components/NewAssetForm.tsx`
- Create: `src/app/(dashboard)/inversion-causal/_components/NewAssetForm.test.tsx`

- [ ] **Step 1: Escribir el test**

```typescript
// src/app/(dashboard)/inversion-causal/_components/NewAssetForm.test.tsx
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
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx vitest run src/app/\(dashboard\)/inversion-causal/_components/NewAssetForm.test.tsx
```

Expected: FAIL — cannot find module `./NewAssetForm`

- [ ] **Step 3: Implementar el componente**

```typescript
// src/app/(dashboard)/inversion-causal/_components/NewAssetForm.tsx
'use client'

import { useState } from 'react'
import { AAPL_DEFAULT_CONFIG } from '@/lib/causal/dag'
import type { CausalConfig } from '@/lib/causal/types'

interface CreatedAsset {
  id: string
  ticker: string
  config: CausalConfig
  last_run_at: string | null
  last_score: number | null
  last_signal: string | null
}

interface Props {
  onCreated: (asset: CreatedAsset) => void
  onCancel: () => void
}

export default function NewAssetForm({ onCreated, onCancel }: Props) {
  const [ticker, setTicker] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const t = ticker.trim().toUpperCase()
    const n = name.trim()
    if (!t || !n) return

    setLoading(true)
    setError(null)

    try {
      const config: CausalConfig = { ...AAPL_DEFAULT_CONFIG, ticker: t, name: n }

      const res = await fetch('/api/causal/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: t, name: n, config }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }

      const body = await res.json() as { asset: CreatedAsset }
      onCreated(body.asset)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando activo')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = ticker.trim().length > 0 && name.trim().length > 0 && !loading

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5 max-w-sm space-y-4"
    >
      <div>
        <h3 className="text-sm font-medium text-[#e2e8f0]">Nuevo activo causal</h3>
        <p className="text-xs text-[#64748b] mt-1">
          Usa la configuración de AAPL como plantilla. Puedes ajustar el DAG después.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-[#64748b]">Ticker</label>
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="MSFT"
          required
          className="w-full px-3 py-2 rounded-lg bg-[#0a0a0f] border border-[#1e1e2e] text-[#e2e8f0] text-sm font-mono placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6] transition-colors"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-[#64748b]">Nombre</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Microsoft Corporation"
          required
          className="w-full px-3 py-2 rounded-lg bg-[#0a0a0f] border border-[#1e1e2e] text-[#e2e8f0] text-sm placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6] transition-colors"
        />
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-4 py-2 rounded-lg bg-[#00ff88] text-[#0a0a0f] text-sm font-semibold hover:bg-[#00ff88]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creando...' : 'Crear activo'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-[#1e1e2e] text-[#64748b] text-sm hover:text-[#e2e8f0] transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npx vitest run src/app/\(dashboard\)/inversion-causal/_components/NewAssetForm.test.tsx
```

Expected: PASS — 5 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/inversion-causal/_components/NewAssetForm.tsx \
        src/app/\(dashboard\)/inversion-causal/_components/NewAssetForm.test.tsx
git commit -m "feat: add NewAssetForm component for causal asset creation"
```

---

## Task 4: `InversionCausalShell` + refactor `page.tsx`

**Files:**
- Create: `src/app/(dashboard)/inversion-causal/_components/InversionCausalShell.tsx`
- Create: `src/app/(dashboard)/inversion-causal/_components/InversionCausalShell.test.tsx`
- Modify: `src/app/(dashboard)/inversion-causal/page.tsx`

- [ ] **Step 1: Escribir el test del shell**

```typescript
// src/app/(dashboard)/inversion-causal/_components/InversionCausalShell.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import InversionCausalShell from './InversionCausalShell'

// Mock heavy child components
vi.mock('./CausalAnalysisClient', () => ({
  default: ({ config }: { config: { ticker: string } }) => (
    <div data-testid="causal-client">{config.ticker}</div>
  ),
}))
vi.mock('./AssetSelector', () => ({
  default: ({ assets, activeId, onSelect, onNewAsset }: {
    assets: Array<{ id: string; ticker: string }>
    activeId: string | null
    onSelect: (id: string) => void
    onNewAsset: () => void
  }) => (
    <div>
      {assets.map((a) => (
        <button key={a.id} onClick={() => onSelect(a.id)} data-active={activeId === a.id}>
          {a.ticker}
        </button>
      ))}
      <button onClick={onNewAsset}>+ Nuevo activo</button>
    </div>
  ),
}))
vi.mock('./NewAssetForm', () => ({
  default: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="new-form">
      <button onClick={onCancel}>Cancelar</button>
    </div>
  ),
}))

const assets = [
  { id: 'a1', ticker: 'AAPL', config: { ticker: 'AAPL', name: 'Apple' } as never, last_run_at: null, last_score: 72, last_signal: 'AUMENTAR' },
  { id: 'a2', ticker: 'MSFT', config: { ticker: 'MSFT', name: 'Microsoft' } as never, last_run_at: null, last_score: null, last_signal: null },
]

describe('InversionCausalShell', () => {
  it('renders the first asset as active by default', () => {
    render(<InversionCausalShell initialAssets={assets} />)
    expect(screen.getByTestId('causal-client')).toHaveTextContent('AAPL')
  })

  it('switches to MSFT config when MSFT pill is selected', () => {
    render(<InversionCausalShell initialAssets={assets} />)
    fireEvent.click(screen.getByText('MSFT'))
    expect(screen.getByTestId('causal-client')).toHaveTextContent('MSFT')
  })

  it('shows NewAssetForm when + Nuevo activo is clicked', () => {
    render(<InversionCausalShell initialAssets={assets} />)
    fireEvent.click(screen.getByText('+ Nuevo activo'))
    expect(screen.getByTestId('new-form')).toBeInTheDocument()
    expect(screen.queryByTestId('causal-client')).not.toBeInTheDocument()
  })

  it('hides NewAssetForm when Cancelar is clicked', () => {
    render(<InversionCausalShell initialAssets={assets} />)
    fireEvent.click(screen.getByText('+ Nuevo activo'))
    fireEvent.click(screen.getByText('Cancelar'))
    expect(screen.queryByTestId('new-form')).not.toBeInTheDocument()
    expect(screen.getByTestId('causal-client')).toBeInTheDocument()
  })

  it('renders AAPL_DEFAULT_CONFIG when no assets provided', () => {
    render(<InversionCausalShell initialAssets={[]} />)
    expect(screen.getByTestId('causal-client')).toHaveTextContent('AAPL')
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx vitest run src/app/\(dashboard\)/inversion-causal/_components/InversionCausalShell.test.tsx
```

Expected: FAIL — cannot find module `./InversionCausalShell`

- [ ] **Step 3: Implementar `InversionCausalShell`**

```typescript
// src/app/(dashboard)/inversion-causal/_components/InversionCausalShell.tsx
'use client'

import { useState } from 'react'
import type { CausalConfig } from '@/lib/causal/types'
import { AAPL_DEFAULT_CONFIG } from '@/lib/causal/dag'
import AssetSelector from './AssetSelector'
import NewAssetForm from './NewAssetForm'
import CausalAnalysisClient from './CausalAnalysisClient'

interface CausalAsset {
  id: string
  ticker: string
  config: CausalConfig
  last_run_at: string | null
  last_score: number | null
  last_signal: string | null
}

interface Props {
  initialAssets: CausalAsset[]
  userId?: string
}

export default function InversionCausalShell({ initialAssets, userId }: Props) {
  const [assets, setAssets] = useState<CausalAsset[]>(initialAssets)
  const [activeId, setActiveId] = useState<string | null>(initialAssets[0]?.id ?? null)
  const [showNewForm, setShowNewForm] = useState(false)

  const activeAsset = assets.find((a) => a.id === activeId) ?? null
  const activeConfig: CausalConfig = activeAsset?.config ?? AAPL_DEFAULT_CONFIG

  function handleAssetCreated(asset: CausalAsset) {
    setAssets((prev) => [asset, ...prev])
    setActiveId(asset.id)
    setShowNewForm(false)
  }

  function handleSelect(id: string) {
    setActiveId(id)
    setShowNewForm(false)
  }

  return (
    <div className="space-y-6">
      <AssetSelector
        assets={assets}
        activeId={activeId}
        onSelect={handleSelect}
        onNewAsset={() => setShowNewForm(true)}
      />

      {showNewForm ? (
        <NewAssetForm
          onCreated={handleAssetCreated}
          onCancel={() => setShowNewForm(false)}
        />
      ) : (
        <CausalAnalysisClient
          config={activeConfig}
          assetId={activeAsset?.id}
          userId={userId}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npx vitest run src/app/\(dashboard\)/inversion-causal/_components/InversionCausalShell.test.tsx
```

Expected: PASS — 5 tests passed

- [ ] **Step 5: Refactorizar `page.tsx`**

Reemplazar el contenido completo de `src/app/(dashboard)/inversion-causal/page.tsx`:

```typescript
// src/app/(dashboard)/inversion-causal/page.tsx
import { createClient } from '@/lib/supabase/server'
import InversionCausalShell from './_components/InversionCausalShell'
import type { CausalConfig } from '@/lib/causal/types'

interface CausalAsset {
  id: string
  ticker: string
  config: CausalConfig
  last_run_at: string | null
  last_score: number | null
  last_signal: string | null
}

export default async function InversionCausalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let assets: CausalAsset[] = []

  if (user) {
    const { data } = await supabase
      .from('causal_assets')
      .select('id, ticker, config, last_run_at, last_score, last_signal')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    assets = (data as CausalAsset[]) ?? []
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#e2e8f0]">Inversión Causal</h1>
        <p className="text-[#64748b] text-sm mt-1">
          Framework López de Prado &amp; Zoonekynd (2025)
        </p>
      </div>

      <InversionCausalShell initialAssets={assets} userId={user?.id} />
    </div>
  )
}
```

- [ ] **Step 6: Verificar que compila sin errores**

```bash
npx tsc --noEmit
```

Expected: sin errores de tipos.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/inversion-causal/_components/InversionCausalShell.tsx \
        src/app/\(dashboard\)/inversion-causal/_components/InversionCausalShell.test.tsx \
        src/app/\(dashboard\)/inversion-causal/page.tsx
git commit -m "feat: add InversionCausalShell and refactor page to support multi-asset selection"
```

---

## Task 5: Cablear algoritmo PC en `CausalAnalysisClient`

**Files:**
- Modify: `src/app/(dashboard)/inversion-causal/_components/CausalAnalysisClient.tsx`

El `DagPanel` ya acepta `pcResult?: PCResult`. Solo falta ejecutar `runPC` tras el análisis y pasarlo.

- [ ] **Step 1: Leer el archivo actual**

(Ya leído en sesión — ver estado en `src/app/(dashboard)/inversion-causal/_components/CausalAnalysisClient.tsx`)

- [ ] **Step 2: Agregar import y estado de pcResult**

Agregar al bloque de imports (línea 1-9):

```typescript
import { runPC } from '@/lib/causal/discovery'
import type { PCResult } from '@/lib/causal/discovery'
```

Agregar estado tras la línea `const [error, setError] = useState<string | null>(null)`:

```typescript
const [pcResult, setPcResult] = useState<PCResult | null>(null)
```

- [ ] **Step 3: Ejecutar PC tras el análisis**

En `handleRunAnalysis`, justo después de `setPipelineResult(body.result)` y antes de `setActiveTab('results')`:

```typescript
// Run PC algorithm on merged data to show data-driven DAG
const variables = [
  config.treatment,
  config.outcome,
  ...config.confounders,
]

// Convert DataRow[] to aligned Record<string, number[]>
// Use only rows where ALL target variables are finite numbers
const dataByVar: Record<string, number[]> = Object.fromEntries(
  variables.map((v) => [v, [] as number[]])
)

for (const row of mergedData) {
  const allFinite = variables.every((v) => {
    const val = row[v]
    return typeof val === 'number' && isFinite(val)
  })
  if (!allFinite) continue
  for (const v of variables) {
    dataByVar[v].push(row[v] as number)
  }
}

const n = dataByVar[variables[0]]?.length ?? 0
if (n > variables.length + 3) {
  // Run in a microtask so the UI renders the results first
  setTimeout(() => {
    const pc = runPC(dataByVar, variables, n)
    setPcResult(pc)
  }, 0)
}
```

- [ ] **Step 4: Pasar `pcResult` a `DagPanel`**

Buscar la línea donde se renderiza `<DagPanel config={config} />` y reemplazarla:

```typescript
<DagPanel config={config} pcResult={pcResult ?? undefined} />
```

- [ ] **Step 5: El archivo final completo de `CausalAnalysisClient.tsx`**

```typescript
// src/app/(dashboard)/inversion-causal/_components/CausalAnalysisClient.tsx
'use client'

import { useState } from 'react'
import type { CausalConfig, DataRow, PipelineResult } from '@/lib/causal/types'
import { runPC } from '@/lib/causal/discovery'
import type { PCResult } from '@/lib/causal/discovery'
import DataPanel from './DataPanel'
import DagPanel from './DagPanel'
import ModelComparisonPanel from './ModelComparison'
import PortfolioScorePanel from './PortfolioScore'
import BacktestPanelComponent from './BacktestPanel'
import PlaceboPanelComponent from './PlaceboPanel'

interface Props {
  config: CausalConfig
  assetId?: string
  userId?: string
}

type ActiveTab = 'data' | 'dag' | 'results'

export default function CausalAnalysisClient({ config, assetId }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('data')
  const [mergedData, setMergedData] = useState<DataRow[] | null>(null)
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null)
  const [pcResult, setPcResult] = useState<PCResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRunAnalysis() {
    if (!mergedData) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/causal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, config, data: mergedData }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      const body = await res.json() as { result: PipelineResult }
      setPipelineResult(body.result)

      // Run PC algorithm in background after results are shown
      const variables = [config.treatment, config.outcome, ...config.confounders]
      const dataByVar: Record<string, number[]> = Object.fromEntries(
        variables.map((v) => [v, [] as number[]])
      )
      for (const row of mergedData) {
        const allFinite = variables.every((v) => {
          const val = row[v]
          return typeof val === 'number' && isFinite(val)
        })
        if (!allFinite) continue
        for (const v of variables) {
          dataByVar[v].push(row[v] as number)
        }
      }
      const n = dataByVar[variables[0]]?.length ?? 0
      if (n > variables.length + 3) {
        setTimeout(() => {
          const pc = runPC(dataByVar, variables, n)
          setPcResult(pc)
        }, 0)
      }

      setActiveTab('results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'data', label: 'Datos' },
    { id: 'dag', label: 'DAG' },
    { id: 'results', label: 'Resultados' },
  ]

  return (
    <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] overflow-hidden">
      <div className="flex border-b border-[#1e1e2e]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-[#00ff88] border-b-2 border-[#00ff88]'
                : 'text-[#64748b] hover:text-[#e2e8f0]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === 'data' && (
          <div className="space-y-6">
            <DataPanel config={config} onDataReady={setMergedData} />

            {mergedData && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-[#64748b]">
                  {mergedData.length} observaciones listas
                </span>
                <button
                  onClick={handleRunAnalysis}
                  disabled={loading}
                  className="px-5 py-2 rounded-lg bg-[#00ff88] text-[#0a0a0f] text-sm font-semibold hover:bg-[#00ff88]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Ejecutando...' : 'Ejecutar Análisis'}
                </button>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>
            )}
          </div>
        )}

        {activeTab === 'dag' && (
          <DagPanel config={config} pcResult={pcResult ?? undefined} />
        )}

        {activeTab === 'results' && (
          <div className="space-y-4">
            {pipelineResult ? (
              <div className="space-y-6">
                <p className="text-[#64748b] text-xs">
                  Análisis completado —{' '}
                  {new Date(pipelineResult.runAt).toLocaleString('es-ES')}
                </p>
                <ModelComparisonPanel models={pipelineResult.models} />
                <PortfolioScorePanel portfolio={pipelineResult.portfolio} />
                <BacktestPanelComponent backtest={pipelineResult.backtest} />
                <PlaceboPanelComponent multipleTesting={pipelineResult.multipleTesting} />
              </div>
            ) : (
              <p className="text-[#64748b]">Ejecuta el análisis para ver los resultados.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verificar tipos**

```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 7: Correr todos los tests**

```bash
npx vitest run
```

Expected: todos los tests existentes siguen pasando.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(dashboard\)/inversion-causal/_components/CausalAnalysisClient.tsx
git commit -m "feat: wire PC algorithm to DagPanel after causal analysis"
```

---

## Self-Review

**Spec coverage:**
- [x] Asset selector con pills — Task 2 + Task 4
- [x] Creación de nuevo activo desde UI — Task 3 + Task 4
- [x] API route para persistir activo — Task 1
- [x] PC algorithm wired al DagPanel — Task 5
- [x] `userId` prop era irrelevante para el guardado (el guardado usa `assetId`) — el gap real era el selector

**Placeholder scan:** ninguno. Todos los pasos tienen código completo.

**Type consistency:**
- `CausalAsset` definido consistentemente en `InversionCausalShell`, `AssetSelector`, `page.tsx`
- `PCResult` importado de `@/lib/causal/discovery` en ambos lugares donde se usa
- `CreatedAsset` en `NewAssetForm` coincide con la forma que devuelve la API route

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |

**VERDICT:** NO REVIEWS YET — ejecutar `/autoplan` para pipeline completo.
