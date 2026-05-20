'use client'

export default function PpoAgent() {
  return (
    <div className="space-y-4">
      <div className="rounded border border-[#1e293b] bg-[#060d1a] px-6 py-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            🤖
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold font-mono text-[#e2e8f0]">PPO Agent — M3</h3>
            <p className="text-sm text-[#475569] max-w-md">
              El agente de Reinforcement Learning (PPO) requiere entrenamiento offline.
              El modelo pre-entrenado se carga desde el backend una vez desplegado.
            </p>
          </div>
          <div className="mt-2 rounded border border-[#f59e0b]/20 bg-[#f59e0b]/5 px-4 py-3 text-xs font-mono text-[#f59e0b]">
            Estado: pendiente de training — ejecuta{' '}
            <code className="font-bold">python train_ppo.py</code> en el backend
            y sube el checkpoint <code className="font-bold">.zip</code> a Render.
          </div>
        </div>
      </div>

      {/* Placeholder allocation display */}
      <div className="grid grid-cols-3 gap-4">
        {['Entrenamiento', 'Checkpoint', 'Inferencia'].map((stage) => (
          <div
            key={stage}
            className="rounded border border-[#1e293b] bg-[#060d1a] px-4 py-5 text-center"
          >
            <p className="text-[10px] font-semibold font-mono tracking-widest text-[#475569]">{stage.toUpperCase()}</p>
            <p className="mt-2 text-sm font-mono text-[#334155]">—</p>
          </div>
        ))}
      </div>
    </div>
  )
}
