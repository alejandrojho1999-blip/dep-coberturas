'use client'

export default function PpoAgent() {
  return (
    <div className="space-y-4">
      <div className="rounded border border-border bg-background px-6 py-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl"
            style={{ background: 'rgba(0, 61, 102,0.08)', border: '1px solid rgba(0, 61, 102,0.2)' }}
          >
            🤖
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold font-mono text-text-primary">PPO Agent — M3</h3>
            <p className="text-sm text-text-muted max-w-md">
              El agente de Reinforcement Learning (PPO) requiere entrenamiento offline.
              El modelo pre-entrenado se carga desde el backend una vez desplegado.
            </p>
          </div>
          <div className="mt-2 rounded border border-accent/20 bg-accent/5 px-4 py-3 text-xs font-mono text-text-primary">
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
            className="rounded border border-border bg-background px-4 py-5 text-center"
          >
            <p className="text-[10px] font-semibold font-mono tracking-widest text-text-muted">{stage.toUpperCase()}</p>
            <p className="mt-2 text-sm font-mono text-border">—</p>
          </div>
        ))}
      </div>
    </div>
  )
}
