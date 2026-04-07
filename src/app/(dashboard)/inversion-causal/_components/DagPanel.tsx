'use client'
import { useState, useMemo } from 'react'
import { ReactFlow, Background, Controls, MiniMap, MarkerType } from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { CausalConfig } from '@/lib/causal/types'
import type { PCResult } from '@/lib/causal/discovery'

interface DagPanelProps {
  config: CausalConfig
  pcResult?: PCResult
}

const ROLE_COLORS: Record<string, string> = {
  treatment: '#2196F3',
  outcome: '#4CAF50',
  confounder: '#FF9800',
  mediator: '#9C27B0',
  collider: '#f87171',
}

function nodeStyle(role: string) {
  const color = ROLE_COLORS[role] ?? '#64748b'
  return {
    background: `${color}26`, // ~15% opacity
    border: `1px ${role === 'collider' ? 'dashed' : 'solid'} ${color}`,
    color: '#e2e8f0',
    padding: '8px 16px',
    borderRadius: '8px',
    minWidth: '140px',
    textAlign: 'center' as const,
    fontSize: '12px',
    fontWeight: 500,
  }
}

function buildNodes(config: CausalConfig): Node[] {
  const nodes: Node[] = []

  const confounders = config.confounders
  const mediators = config.mediators ?? []
  const colliders = Object.keys(config.excluded)

  const confCenter = Math.max(0, (confounders.length - 1) * 80) / 2
  const totalHeight = Math.max(
    confounders.length * 80,
    (mediators.length + 1) * 80,
    200,
  )
  const centerY = totalHeight / 2

  // Confounders — left column
  confounders.forEach((v, i) => {
    nodes.push({
      id: v,
      data: { label: v },
      position: { x: 50, y: i * 80 },
      style: nodeStyle('confounder'),
    })
  })

  // Treatment — center-left
  nodes.push({
    id: config.treatment,
    data: { label: config.treatment },
    position: { x: 300, y: centerY - confCenter / 2 },
    style: nodeStyle('treatment'),
  })

  // Mediators — center, above treatment
  mediators.forEach((v, i) => {
    nodes.push({
      id: v,
      data: { label: v },
      position: { x: 500, y: centerY - 60 - i * 80 },
      style: nodeStyle('mediator'),
    })
  })

  // Outcome — right
  nodes.push({
    id: config.outcome,
    data: { label: config.outcome },
    position: { x: 700, y: centerY },
    style: nodeStyle('outcome'),
  })

  // Colliders — bottom row (visual reference only)
  colliders.forEach((v, i) => {
    nodes.push({
      id: v,
      data: { label: v },
      position: { x: 200 + i * 160, y: totalHeight + 80 },
      style: nodeStyle('collider'),
    })
  })

  return nodes
}

function buildManualEdges(config: CausalConfig): Edge[] {
  return config.dagEdges.map((e, i) => ({
    id: `manual-${i}-${e.from}-${e.to}`,
    source: e.from,
    target: e.to,
    label: e.label,
    style: { stroke: '#64748b' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
    animated: true,
  }))
}

function buildPCEdges(config: CausalConfig, pcResult: PCResult): Edge[] {
  // Create a set of manual edge pairs for conflict detection
  const manualPairs = new Set(config.dagEdges.map(e => `${e.from}|${e.to}`))

  return pcResult.edges.map((e, i) => {
    const key = `${e.from}|${e.to}`
    const reverseKey = `${e.to}|${e.from}`
    const conflicts = manualPairs.has(key) === false && manualPairs.has(reverseKey) === false
    const color = conflicts ? '#3b82f6' : '#3b82f6'
    return {
      id: `pc-${i}-${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      style: { stroke: color, strokeDasharray: '5,5' },
      markerEnd: e.oriented ? { type: MarkerType.ArrowClosed, color } : undefined,
    }
  })
}

type ViewMode = 'manual' | 'pc'

export default function DagPanel({ config, pcResult }: DagPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('manual')

  const nodes = useMemo(() => buildNodes(config), [config])

  const edges = useMemo(() => {
    if (viewMode === 'pc' && pcResult) {
      return buildPCEdges(config, pcResult)
    }
    return buildManualEdges(config)
  }, [config, pcResult, viewMode])

  const colliders = Object.entries(config.excluded)

  return (
    <div className="space-y-4">
      {/* Header + toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#e2e8f0]">Grafo Causal (DAG)</h3>
        {pcResult && (
          <div className="flex rounded-lg overflow-hidden border border-[#1e1e2e]">
            <button
              onClick={() => setViewMode('manual')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'manual'
                  ? 'bg-[#1e1e2e] text-[#00ff88]'
                  : 'text-[#64748b] hover:text-[#e2e8f0]'
              }`}
            >
              Ver DAG Manual
            </button>
            <button
              onClick={() => setViewMode('pc')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'pc'
                  ? 'bg-[#1e1e2e] text-[#00ff88]'
                  : 'text-[#64748b] hover:text-[#e2e8f0]'
              }`}
            >
              Ver PC Algorithm
            </button>
          </div>
        )}
      </div>

      {/* React Flow canvas */}
      <div style={{ background: '#0a0a0f', height: '500px', borderRadius: '12px', overflow: 'hidden' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          colorMode="dark"
        >
          <Background color="#1e1e2e" />
          <Controls style={{ background: '#12121a', border: '1px solid #1e1e2e' }} />
          <MiniMap
            style={{ background: '#12121a', border: '1px solid #1e1e2e' }}
            nodeColor={(n) => {
              const style = n.style as Record<string, string> | undefined
              return style?.borderColor ?? '#64748b'
            }}
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-1">
        {Object.entries(ROLE_COLORS).map(([role, color]) => (
          <div key={role} className="flex items-center gap-1.5">
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: `${color}26`,
                border: `1px solid ${color}`,
              }}
            />
            <span className="text-xs text-[#64748b] capitalize">{role}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div style={{ width: 24, height: 2, background: '#64748b' }} />
          <span className="text-xs text-[#64748b]">Manual</span>
        </div>
        {pcResult && (
          <div className="flex items-center gap-1.5">
            <div
              style={{
                width: 24,
                height: 2,
                background: '#3b82f6',
                borderTop: '2px dashed #3b82f6',
              }}
            />
            <span className="text-xs text-[#64748b]">PC Algorithm</span>
          </div>
        )}
      </div>

      {/* Excluded variables */}
      {colliders.length > 0 && (
        <div className="rounded-lg border border-[#1e1e2e] p-4 space-y-2">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">
            Excluidos (Colisionadores — NO controlar)
          </p>
          <div className="flex flex-wrap gap-2">
            {colliders.map(([variable, reason]) => (
              <div
                key={variable}
                className="flex flex-col gap-0.5 rounded-md border border-dashed border-[#f87171] px-3 py-1.5"
              >
                <span className="text-xs font-medium text-[#f87171]">{variable}</span>
                <span className="text-[10px] text-[#64748b]">{reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
