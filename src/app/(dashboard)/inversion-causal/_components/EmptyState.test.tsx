'use client'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  it('renders the hero headline', () => {
    render(<EmptyState onStart={vi.fn()} />)
    expect(screen.getByText(/Inversión basada en/i)).toBeInTheDocument()
  })

  it('renders the Causal Inference badge', () => {
    render(<EmptyState onStart={vi.fn()} />)
    expect(screen.getByText(/Causal Inference/i)).toBeInTheDocument()
  })

  it('renders the CTA button', () => {
    render(<EmptyState onStart={vi.fn()} />)
    const buttons = screen.getAllByRole('button', { name: /Agregar mi primer activo/i })
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it('calls onStart when primary CTA is clicked', () => {
    const onStart = vi.fn()
    render(<EmptyState onStart={onStart} />)
    const btn = screen.getAllByRole('button', { name: /Agregar mi primer activo/i })[0]
    fireEvent.click(btn)
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('renders the three pipeline steps', () => {
    render(<EmptyState onStart={vi.fn()} />)
    expect(screen.getByText('Identifica el Ticker')).toBeInTheDocument()
    expect(screen.getByText('Construye el DAG')).toBeInTheDocument()
    expect(screen.getByText('Obtén la Señal Causal')).toBeInTheDocument()
  })

  it('renders the mini DAG section label', () => {
    render(<EmptyState onStart={vi.fn()} />)
    expect(screen.getByText(/Ejemplo de estructura causal/i)).toBeInTheDocument()
  })

  it('renders ghost metric placeholders', () => {
    render(<EmptyState onStart={vi.fn()} />)
    expect(screen.getByText('Score Causal')).toBeInTheDocument()
    expect(screen.getByText('Señal')).toBeInTheDocument()
    expect(screen.getByText('p-valor placebo')).toBeInTheDocument()
    expect(screen.getByText('β ajustado')).toBeInTheDocument()
  })

  it('secondary CTA button calls onStart', () => {
    const onStart = vi.fn()
    render(<EmptyState onStart={onStart} />)
    const btn = screen.getByRole('button', { name: /Comenzar ahora/i })
    fireEvent.click(btn)
    expect(onStart).toHaveBeenCalledOnce()
  })
})
