'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setError(
          error.message === 'Invalid login credentials'
            ? 'Email o contraseña incorrectos'
            : error.message
        )
        return
      }

      router.push('/agentes')
      router.refresh()
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-border-subtle bg-surface p-8 shadow-2xl">
        {/* Logotipo vertical + slogan de imagen (comunicación externa) */}
        <div className="flex flex-col items-center text-center">
          <Image
            src="/brand/logo-vrt-blanco.png"
            alt="SynerGy"
            width={132}
            height={132}
            priority
            className="h-24 w-auto"
          />
          <p className="mt-3 font-brand text-sm font-extrabold tracking-[0.18em] text-text-primary uppercase">
            Find your Freedom
          </p>
          <p className="mt-1 text-sm text-text-secondary">Emporium Quant Desk</p>
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

          <div className="space-y-2">
            <Label htmlFor="password" className="text-text-primary">
              Contraseña
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-border-subtle bg-background pr-10 text-text-primary focus-visible:ring-accent-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
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
            {loading ? 'Ingresando...' : 'INGRESAR AL SISTEMA'}
          </Button>
        </form>

        <div className="space-y-2 text-center text-sm">
          <Link
            href="/reset-password"
            className="block text-info hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
          <Link
            href="/register"
            className="block text-text-secondary hover:text-text-primary transition-colors"
          >
            ¿No tienes cuenta? Regístrate
          </Link>
        </div>
      </div>
    </div>
  )
}
