'use client'

import { useState } from 'react'
import Image from 'next/image'
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
        <div className="w-full max-w-md rounded-xl border border-border-subtle bg-surface p-8 text-center shadow-2xl">
          <div className="mb-4 text-3xl text-positive">✉</div>
          <h2 className="mb-2 text-xl font-bold text-text-primary">Email enviado</h2>
          <p className="mb-6 text-text-secondary">
            Revisa tu correo en{' '}
            <strong className="text-text-primary">{email}</strong> y sigue las instrucciones
            para restablecer tu contraseña.
          </p>
          <Link href="/login" className="text-info hover:underline">
            Volver al login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-border-subtle bg-surface p-8 shadow-2xl">
        <div className="text-center">
          <Image
            src="/brand/logo-vrt-blanco.png"
            alt="SynerGy"
            width={110}
            height={110}
            priority
            className="mx-auto h-20 w-auto"
          />
          <h1 className="mt-3 font-brand text-xl font-extrabold text-text-primary">Restablecer contraseña</h1>
          <p className="mt-1 text-sm text-text-secondary">Te enviamos un link a tu correo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-text-primary">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
              className="border-border-subtle bg-background text-text-primary placeholder:text-text-secondary focus-visible:ring-accent-ring"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-negative">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-accent font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'ENVIAR INSTRUCCIONES'}
          </Button>
        </form>

        <div className="text-center text-sm">
          <Link href="/login" className="text-text-secondary hover:text-text-primary transition-colors">
            Volver al login
          </Link>
        </div>
      </div>
    </div>
  )
}
