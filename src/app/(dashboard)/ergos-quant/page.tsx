export default function ErgosQuantPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)' }}
      >
        <span className="text-3xl">⚛</span>
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-[#e2e8f0] font-mono">ERGOS QUANT</h1>
        <p className="text-sm text-[#475569]">Próximamente — sección en desarrollo</p>
      </div>
    </div>
  )
}
