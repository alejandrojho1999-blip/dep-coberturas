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
    expect(pills[0].className).toContain('border-[#00ff88]')
    expect(pills[1].className).not.toContain('border-[#00ff88]')
  })
})
