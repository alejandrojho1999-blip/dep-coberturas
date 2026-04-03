'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      })

      if (error) {
        setError(error.message)
        return
      }

      setEmailSent(true)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-[#1e1e2e] bg-[#12121a] p-8 text-center shadow-2xl">
          <div className="mb-4 text-3xl text-[#00ff88]">✉</div>
          <h2 className="mb-2 text-xl font-bold text-[#e2e8f0]">Email enviado</h2>
          <p className="mb-6 text-[#64748b]">
            Revisa tu correo en{' '}
            <strong className="text-[#e2e8f0]">{email}</strong> y sigue las instrucciones
            para restablecer tu contraseña.
          </p>
          <Link href="/login" className="text-[#3b82f6] hover:underline">
            Volver al login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-[#1e1e2e] bg-[#12121a] p-8 shadow-2xl">
        <div className="text-center">
          <div className="mb-2 text-3xl font-bold text-[#00ff88]">◈</div>
          <h1 className="text-xl font-bold text-[#e2e8f0]">Restablecer contraseña</h1>
          <p className="mt-1 text-sm text-[#64748b]">Te enviamos un link a tu correo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#e2e8f0]">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
              className="border-[#1e1e2e] bg-[#0a0a0f] text-[#e2e8f0] placeholder:text-[#64748b] focus-visible:ring-[#00ff88]"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00ff88] font-semibold text-black hover:bg-[#00cc6a] disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'ENVIAR INSTRUCCIONES'}
          </Button>
        </form>

        <div className="text-center text-sm">
          <Link href="/login" className="text-[#64748b] hover:text-[#e2e8f0] transition-colors">
            Volver al login
          </Link>
        </div>
      </div>
    </div>
  )
}
