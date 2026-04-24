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
vi.mock('./EmptyState', () => ({
  default: ({ onStart }: { onStart: () => void }) => (
    <div data-testid="empty-state">
      <button onClick={onStart}>Agregar primer activo</button>
    </div>
  ),
}))
vi.mock('./NewAssetForm', () => ({
  default: ({ onCancel, onCreated }: {
    onCancel: () => void
    onCreated: (asset: { id: string; ticker: string; config: never; last_run_at: null; last_score: null; last_signal: null }) => void
  }) => (
    <div data-testid="new-form">
      <button onClick={onCancel}>Cancelar</button>
      <button onClick={() => onCreated({ id: 'new-id', ticker: 'GOOG', config: { ticker: 'GOOG' } as never, last_run_at: null, last_score: null, last_signal: null })}>
        Simular creación
      </button>
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

  it('shows EmptyState when no assets provided', () => {
    render(<InversionCausalShell initialAssets={[]} />)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.queryByTestId('causal-client')).not.toBeInTheDocument()
  })

  it('shows NewAssetForm when EmptyState CTA is clicked', () => {
    render(<InversionCausalShell initialAssets={[]} />)
    fireEvent.click(screen.getByText('Agregar primer activo'))
    expect(screen.getByTestId('new-form')).toBeInTheDocument()
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument()
  })

  it('adds new asset to list and sets it active when onCreated is called', () => {
    render(<InversionCausalShell initialAssets={assets} />)
    // Open the new asset form
    fireEvent.click(screen.getByText('+ Nuevo activo'))
    expect(screen.getByTestId('new-form')).toBeInTheDocument()
    // Simulate asset creation
    fireEvent.click(screen.getByText('Simular creación'))
    // Form should be hidden, new asset should be active
    expect(screen.queryByTestId('new-form')).not.toBeInTheDocument()
    expect(screen.getByTestId('causal-client')).toHaveTextContent('GOOG')
  })
})
