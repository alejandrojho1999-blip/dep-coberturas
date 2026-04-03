'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-[#1e1e2e] bg-[#12121a] p-8 shadow-2xl">
        {/* Logo */}
        <div className="text-center">
          <div className="mb-2 text-3xl font-bold text-[#00ff88]">◈</div>
          <h1 className="text-xl font-bold text-[#e2e8f0]">Dep. Coberturas</h1>
          <p className="mt-1 text-sm text-[#64748b]">Sistema de Análisis de Riesgos</p>
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

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[#e2e8f0]">
              Contraseña
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-[#1e1e2e] bg-[#0a0a0f] pr-10 text-[#e2e8f0] focus-visible:ring-[#00ff88]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#e2e8f0]"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
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
            {loading ? 'Ingresando...' : 'INGRESAR AL SISTEMA'}
          </Button>
        </form>

        <div className="space-y-2 text-center text-sm">
          <Link
            href="/reset-password"
            className="block text-[#3b82f6] hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
          <Link
            href="/register"
            className="block text-[#64748b] hover:text-[#e2e8f0] transition-colors"
          >
            ¿No tienes cuenta? Regístrate
          </Link>
        </div>
      </div>
    </div>
  )
}
