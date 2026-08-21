'use client'

import { useState, useEffect } from 'react'
import { Loader2, User, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function PerfilPage() {
  const [fullName, setFullName]   = useState('')
  const [email, setEmail]         = useState('')
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [message, setMessage]     = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? '')
        setFullName((data.user.user_metadata?.full_name as string | undefined) ?? '')
      }
      setLoading(false)
    })
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = fullName.trim()
    if (!name) return
    setSaving(true)
    setMessage(null)
    try {
      const supabase = createClient()
      // Update auth metadata
      const { error: authErr } = await supabase.auth.updateUser({ data: { full_name: name } })
      if (authErr) { setMessage({ text: authErr.message, ok: false }); return }
      // Upsert profiles table (for layout display)
      await supabase
        .from('profiles')
        .upsert({ id: (await supabase.auth.getUser()).data.user!.id, full_name: name, updated_at: new Date().toISOString() })
      setMessage({ text: 'Perfil actualizado correctamente.', ok: true })
    } catch {
      setMessage({ text: 'Error inesperado. Inténtalo de nuevo.', ok: false })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 size={22} className="animate-spin text-text-muted" />
      </div>
    )
  }

  return (
    <div className="min-h-full">
      {/* Page header */}
      <div className="mb-6 flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'rgba(0, 61, 102,0.1)', border: '1px solid rgba(0, 61, 102,0.2)' }}
        >
          <User size={20} style={{ color: 'var(--color-text-primary)' }} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Mi Perfil</h1>
          <p className="text-sm text-text-secondary">SynerGy — Datos de cuenta</p>
        </div>
      </div>

      <div className="max-w-md">
        <div className="rounded-xl border border-border-subtle bg-surface p-6">
          <form onSubmit={handleSave} className="flex flex-col gap-5">

            {/* Nombre completo */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Nombre completo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Tu nombre y apellido"
                className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2.5 text-sm text-text-primary placeholder-text-muted transition-colors focus:border-accent focus:outline-none"
              />
              <p className="text-xs text-text-muted">
                Este nombre aparece automáticamente en la firma de los informes Word generados.
              </p>
            </div>

            {/* Email (readonly) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Email</label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full cursor-not-allowed rounded-lg border border-border-subtle bg-background px-3 py-2.5 text-sm text-text-muted opacity-60"
              />
              <p className="text-xs text-text-muted">El email no puede modificarse desde aquí.</p>
            </div>

            {/* Feedback */}
            {message && (
              <p
                className="rounded-lg border px-3 py-2 text-xs"
                style={{
                  background: message.ok ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                  borderColor: message.ok ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)',
                  color: message.ok ? 'var(--color-positive)' : 'var(--color-negative)',
                }}
              >
                {message.text}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={saving || !fullName.trim()}
              className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 hover:brightness-90 active:scale-[0.98]"
              style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
