'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      })

      if (error) {
        const msg = error.message.toLowerCase()
        const isRateLimit = msg.includes('rate limit') || msg.includes('email rate') || msg.includes('over_email_send')
        setError(
          isRateLimit
            ? 'El sistema alcanzó el límite de registros por hora. Por favor espera unos minutos o contacta al administrador.'
            : error.message
        )
        return
      }

      setEmailSent(true)
    } catch {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-border-subtle bg-surface p-8 text-center shadow-2xl">
          <div className="mb-4 text-3xl text-positive">✓</div>
          <h2 className="mb-2 text-xl font-bold text-text-primary">Revisa tu correo</h2>
          <p className="mb-6 text-text-secondary">
            Te enviamos un email de confirmación a{' '}
            <strong className="text-text-primary">{email}</strong>.
            Confirma tu cuenta para poder ingresar.
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
          <h1 className="mt-3 font-brand text-xl font-extrabold text-text-primary">Crear cuenta</h1>
          <p className="mt-1 text-sm text-text-secondary">SynerGy — Plataforma Quant</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-text-primary">
              Nombre completo
            </Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Juan Pérez"
              className="border-border-subtle bg-background text-text-primary placeholder:text-text-secondary focus-visible:ring-accent-ring"
            />
          </div>

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

          <div className="space-y-2">
            <Label htmlFor="password" className="text-text-primary">
              Contraseña
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Mínimo 8 caracteres"
              className="border-border-subtle bg-background text-text-primary placeholder:text-text-secondary focus-visible:ring-accent-ring"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-text-primary">
              Confirmar contraseña
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="border-border-subtle bg-background text-text-primary focus-visible:ring-accent-ring"
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
            {loading ? 'Creando cuenta...' : 'CREAR CUENTA'}
          </Button>
        </form>

        <div className="text-center text-sm">
          <Link href="/login" className="text-text-secondary hover:text-text-primary transition-colors">
            ¿Ya tienes cuenta? Inicia sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
