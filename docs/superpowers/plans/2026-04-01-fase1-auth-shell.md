# Fase 1: Auth + Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir autenticación (login/registro/reset) con Supabase SSR y el shell de navegación (sidebar colapsable + dashboard home) para el sistema Departamento de Coberturas.

**Architecture:** Supabase SSR con `@supabase/ssr` — cliente server para componentes protegidos, cliente browser para acciones de auth client-side. `proxy.ts` intercepta rutas protegidas y redirige usuarios sin sesión a `/login`. Route groups `(auth)` y `(dashboard)` proveen layouts separados sin afectar las URLs.

**Tech Stack:** Next.js 16.2.1, React 19, Tailwind CSS v4, shadcn v4, @supabase/supabase-js, @supabase/ssr, lucide-react, Vitest, @testing-library/react, @testing-library/user-event, jsdom

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `src/app/page.tsx` | Modificar | Redirect a `/dashboard` |
| `src/app/layout.tsx` | Modificar | Metadata del sistema |
| `src/app/globals.css` | Modificar | Variables CSS del tema dark |
| `src/app/(auth)/layout.tsx` | Crear | Layout sin sidebar para páginas de auth |
| `src/app/(auth)/login/page.tsx` | Crear | Página de login |
| `src/app/(auth)/register/page.tsx` | Crear | Página de registro |
| `src/app/(auth)/reset-password/page.tsx` | Crear | Página de reset de contraseña |
| `src/app/(dashboard)/layout.tsx` | Crear | Layout con sidebar para rutas protegidas |
| `src/app/(dashboard)/dashboard/page.tsx` | Crear | Dashboard home (`/dashboard`) |
| `src/app/(dashboard)/inversion-causal/page.tsx` | Crear | Placeholder Fase 2 |
| `src/app/(dashboard)/portafolios/page.tsx` | Crear | Placeholder Fase 3 |
| `src/app/(dashboard)/agente-ppo/page.tsx` | Crear | Placeholder Fase 4 |
| `src/app/(dashboard)/coberturas/page.tsx` | Crear | Placeholder Fases 5-6 |
| `src/app/(dashboard)/perfil/page.tsx` | Crear | Placeholder Fase 7 |
| `src/lib/supabase/client.ts` | Crear | Supabase browser client |
| `src/lib/supabase/server.ts` | Crear | Supabase server client (SSR) |
| `src/components/layout/Sidebar.tsx` | Crear | Sidebar colapsable con navegación |
| `src/components/layout/TopBar.tsx` | Crear | Barra superior con toggle y logout |
| `src/proxy.ts` | Crear | Middleware de protección de rutas |
| `src/test/setup.ts` | Crear | Setup de Vitest |
| `vitest.config.ts` | Crear | Configuración de Vitest |
| `.env.local` | Crear | Variables de entorno de Supabase |

---

## Task 1: Instalar dependencias

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Instalar dependencias de runtime**

```bash
cd C:\Users\luis.riofrio\Proyectos\dep-coberturas
npm install @supabase/supabase-js @supabase/ssr lucide-react
```

Expected output: `added N packages`

- [ ] **Step 2: Instalar dependencias de testing**

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom @types/testing-library__user-event
```

Expected output: `added N packages`

- [ ] **Step 3: Verificar instalación**

```bash
node -e "require('@supabase/ssr'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: instalar supabase-ssr, lucide-react y vitest"
```

---

## Task 2: Inicializar shadcn

**Files:**
- Create: `components.json`, `src/components/ui/` (auto-generado por shadcn)
- Modify: `src/app/globals.css`, `src/lib/utils.ts`

- [ ] **Step 1: Leer el docs de Next.js 16 antes de cualquier configuración de CSS**

```bash
ls node_modules/next/dist/docs/
```

Nota: Si existe documentación sobre cambios en CSS/Tailwind para Next.js 16, leerla antes de continuar.

- [ ] **Step 2: Inicializar shadcn**

```bash
npx shadcn@latest init
```

Cuando pregunte, seleccionar:
- Style: **Default**
- Base color: **Neutral** (se sobreescribirá con el tema dark custom)
- CSS variables: **Yes**

- [ ] **Step 3: Instalar componentes shadcn necesarios para Fase 1**

```bash
npx shadcn@latest add button input label card
```

Expected: Se crean archivos en `src/components/ui/`

- [ ] **Step 4: Verificar que los componentes existen**

```bash
ls src/components/ui/
```

Expected: `button.tsx  card.tsx  input.tsx  label.tsx`

- [ ] **Step 5: Commit**

```bash
git add components.json src/components/ src/lib/utils.ts src/app/globals.css
git commit -m "chore: inicializar shadcn y agregar componentes base"
```

---

## Task 3: Configurar Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `package.json` (agregar script test)

- [ ] **Step 1: Crear vitest.config.ts**

Crear `vitest.config.ts` en la raíz del proyecto:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 2: Crear src/test/setup.ts**

```bash
mkdir -p src/test
```

Crear `src/test/setup.ts`:

```ts
import '@testing-library/react'
```

- [ ] **Step 3: Agregar script de test a package.json**

Editar `package.json` para agregar en `"scripts"`:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 4: Verificar que Vitest funciona**

Crear `src/test/smoke.test.ts` temporal:

```ts
import { describe, it, expect } from 'vitest'

describe('smoke test', () => {
  it('works', () => {
    expect(1 + 1).toBe(2)
  })
})
```

```bash
npm run test:run
```

Expected: `1 passed`

- [ ] **Step 5: Eliminar el test de smoke**

```bash
rm src/test/smoke.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts src/test/setup.ts package.json
git commit -m "chore: configurar vitest con jsdom y react testing library"
```

---

## Task 4: Configurar tema dark en globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Actualizar globals.css con el tema dark financiero**

Reemplazar el contenido de `src/app/globals.css` con:

```css
@import "tailwindcss";

@theme inline {
  --color-background: #0a0a0f;
  --color-surface: #12121a;
  --color-border: #1e1e2e;
  --color-accent-green: #00ff88;
  --color-accent-green-hover: #00cc6a;
  --color-accent-blue: #3b82f6;
  --color-text-primary: #e2e8f0;
  --color-text-secondary: #64748b;
  --color-danger: #ef4444;
}

* {
  box-sizing: border-box;
}

body {
  background-color: #0a0a0f;
  color: #e2e8f0;
  font-family: var(--font-geist-sans), sans-serif;
}
```

- [ ] **Step 2: Verificar que el build no tiene errores de CSS**

```bash
npm run build 2>&1 | head -30
```

Expected: Sin errores de CSS/Tailwind

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: configurar tema dark financiero con variables CSS"
```

---

## Task 5: Crear variables de entorno y clientes Supabase

**Files:**
- Create: `.env.local`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`

- [ ] **Step 1: Crear .env.local**

Crear `.env.local` en la raíz del proyecto:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

**IMPORTANTE:** Reemplazar los valores con las credenciales reales del proyecto Supabase antes de correr el servidor. Obtenerlos en: Supabase Dashboard → Settings → API.

- [ ] **Step 2: Verificar que .env.local está en .gitignore**

```bash
grep ".env.local" .gitignore
```

Expected: `.env.local` aparece en el output. Si no aparece, agregar la línea `.env.local` al `.gitignore`.

- [ ] **Step 3: Crear directorio lib/supabase**

```bash
mkdir -p src/lib/supabase
```

- [ ] **Step 4: Crear src/lib/supabase/client.ts**

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 5: Crear src/lib/supabase/server.ts**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // En Server Components no se pueden setear cookies.
            // El proxy.ts se encarga de refrescar la sesión.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: Sin errores en los archivos de supabase

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase/ .gitignore
git commit -m "feat: agregar clientes Supabase SSR (browser y server)"
```

---

## Task 6: Crear proxy.ts (middleware de rutas protegidas)

**Files:**
- Create: `src/proxy.ts`

**Nota:** Next.js 16 renombró `middleware.ts` a `proxy.ts`. Leer `node_modules/next/dist/docs/` si hay dudas sobre el export API antes de implementar.

- [ ] **Step 1: Crear src/proxy.ts**

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/reset-password'

  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/inversion-causal') ||
    pathname.startsWith('/portafolios') ||
    pathname.startsWith('/agente-ppo') ||
    pathname.startsWith('/coberturas') ||
    pathname.startsWith('/perfil')

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: Sin errores en proxy.ts

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts
git commit -m "feat: agregar proxy.ts con protección de rutas y redirect de auth"
```

---

## Task 7: Crear layouts de grupos de rutas

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/(auth)/layout.tsx`

- [ ] **Step 1: Actualizar src/app/layout.tsx con metadata del sistema**

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dep. Coberturas — Sistema de Análisis de Riesgos",
  description: "Sistema de análisis de mercados financieros y cobertura de riesgos para carteras de inversión",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0a0a0f]">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Reemplazar src/app/page.tsx con redirect a /dashboard**

```tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");
}
```

- [ ] **Step 3: Crear directorio (auth)**

```bash
mkdir -p "src/app/(auth)/login" "src/app/(auth)/register" "src/app/(auth)/reset-password"
```

- [ ] **Step 4: Crear src/app/(auth)/layout.tsx**

```tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: Sin errores

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx "src/app/(auth)/layout.tsx"
git commit -m "feat: actualizar root layout y crear layout del grupo auth"
```

---

## Task 8: Crear página de Login

**Files:**
- Create: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Escribir test del componente de login**

Crear `src/app/(auth)/login/page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import LoginPage from './page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}))

describe('LoginPage', () => {
  it('renderiza el formulario de login', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ingresar al sistema/i })).toBeInTheDocument()
  })

  it('muestra links a register y reset-password', () => {
    render(<LoginPage />)
    expect(screen.getByText(/olvidaste tu contraseña/i)).toBeInTheDocument()
    expect(screen.getByText(/no tienes cuenta/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npm run test:run -- src/app/\(auth\)/login/page.test.tsx
```

Expected: FAIL — `page.tsx` no existe aún

- [ ] **Step 3: Implementar src/app/(auth)/login/page.tsx**

```tsx
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

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos'
          : error.message
      )
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
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
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npm run test:run -- src/app/\(auth\)/login/page.test.tsx
```

Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)/login/"
git commit -m "feat: agregar página de login con validación y tema dark"
```

---

## Task 9: Crear página de Registro

**Files:**
- Create: `src/app/(auth)/register/page.tsx`

- [ ] **Step 1: Escribir test del componente de registro**

Crear `src/app/(auth)/register/page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RegisterPage from './page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}))

describe('RegisterPage', () => {
  it('renderiza el formulario de registro', () => {
    render(<RegisterPage />)
    expect(screen.getByLabelText('Nombre completo')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirmar contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crear cuenta/i })).toBeInTheDocument()
  })

  it('muestra link de vuelta al login', () => {
    render(<RegisterPage />)
    expect(screen.getByText(/ya tienes cuenta/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npm run test:run -- src/app/\(auth\)/register/page.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implementar src/app/(auth)/register/page.tsx**

```tsx
'use client'

import { useState } from 'react'
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

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setEmailSent(true)
  }

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-[#1e1e2e] bg-[#12121a] p-8 text-center shadow-2xl">
          <div className="mb-4 text-3xl text-[#00ff88]">✓</div>
          <h2 className="mb-2 text-xl font-bold text-[#e2e8f0]">Revisa tu correo</h2>
          <p className="mb-6 text-[#64748b]">
            Te enviamos un email de confirmación a <strong className="text-[#e2e8f0]">{email}</strong>.
            Confirma tu cuenta para poder ingresar.
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
          <h1 className="text-xl font-bold text-[#e2e8f0]">Crear cuenta</h1>
          <p className="mt-1 text-sm text-[#64748b]">Dep. Coberturas — Sistema de Riesgos</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-[#e2e8f0]">
              Nombre completo
            </Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Juan Pérez"
              className="border-[#1e1e2e] bg-[#0a0a0f] text-[#e2e8f0] placeholder:text-[#64748b] focus-visible:ring-[#00ff88]"
            />
          </div>

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
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Mínimo 8 caracteres"
              className="border-[#1e1e2e] bg-[#0a0a0f] text-[#e2e8f0] placeholder:text-[#64748b] focus-visible:ring-[#00ff88]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-[#e2e8f0]">
              Confirmar contraseña
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="border-[#1e1e2e] bg-[#0a0a0f] text-[#e2e8f0] focus-visible:ring-[#00ff88]"
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
            {loading ? 'Creando cuenta...' : 'CREAR CUENTA'}
          </Button>
        </form>

        <div className="text-center text-sm">
          <Link href="/login" className="text-[#64748b] hover:text-[#e2e8f0] transition-colors">
            ¿Ya tienes cuenta? Inicia sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npm run test:run -- src/app/\(auth\)/register/page.test.tsx
```

Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)/register/"
git commit -m "feat: agregar página de registro con confirmación de email"
```

---

## Task 10: Crear página de Reset de Contraseña

**Files:**
- Create: `src/app/(auth)/reset-password/page.tsx`

- [ ] **Step 1: Escribir test**

Crear `src/app/(auth)/reset-password/page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ResetPasswordPage from './page'

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}))

describe('ResetPasswordPage', () => {
  it('renderiza el formulario de reset', () => {
    render(<ResetPasswordPage />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enviar instrucciones/i })).toBeInTheDocument()
  })

  it('muestra link de vuelta al login', () => {
    render(<ResetPasswordPage />)
    expect(screen.getByText(/volver al login/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npm run test:run -- src/app/\(auth\)/reset-password/page.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implementar src/app/(auth)/reset-password/page.tsx**

```tsx
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

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setEmailSent(true)
  }

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-[#1e1e2e] bg-[#12121a] p-8 text-center shadow-2xl">
          <div className="mb-4 text-3xl text-[#00ff88]">✉</div>
          <h2 className="mb-2 text-xl font-bold text-[#e2e8f0]">Email enviado</h2>
          <p className="mb-6 text-[#64748b]">
            Revisa tu correo en <strong className="text-[#e2e8f0]">{email}</strong> y sigue las instrucciones para restablecer tu contraseña.
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
```

- [ ] **Step 4: Correr el test**

```bash
npm run test:run -- src/app/\(auth\)/reset-password/page.test.tsx
```

Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)/reset-password/"
git commit -m "feat: agregar página de reset de contraseña"
```

---

## Task 11: Crear componente Sidebar

**Files:**
- Create: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Crear directorio de componentes de layout**

```bash
mkdir -p src/components/layout
```

- [ ] **Step 2: Escribir test del Sidebar**

Crear `src/components/layout/Sidebar.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Sidebar } from './Sidebar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

describe('Sidebar', () => {
  it('renderiza los items de navegación', () => {
    render(<Sidebar />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Inversión Causal')).toBeInTheDocument()
    expect(screen.getByText('Portafolios Híbridos')).toBeInTheDocument()
    expect(screen.getByText('Agente PPO')).toBeInTheDocument()
    expect(screen.getByText('Coberturas')).toBeInTheDocument()
    expect(screen.getByText('Mi Perfil')).toBeInTheDocument()
  })

  it('colapsa y expande al hacer click en el toggle', () => {
    render(<Sidebar />)
    const toggle = screen.getByRole('button', { name: /colapsar|expandir/i })
    fireEvent.click(toggle)
    // Después del click el sidebar debería estar en estado opuesto
    expect(toggle).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Correr el test para verificar que falla**

```bash
npm run test:run -- src/components/layout/Sidebar.test.tsx
```

Expected: FAIL

- [ ] **Step 4: Implementar src/components/layout/Sidebar.tsx**

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  TrendingUp,
  BarChart2,
  Bot,
  Shield,
  UserCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: TrendingUp, label: 'Inversión Causal', href: '/inversion-causal' },
  { icon: BarChart2, label: 'Portafolios Híbridos', href: '/portafolios' },
  { icon: Bot, label: 'Agente PPO', href: '/agente-ppo' },
  { icon: Shield, label: 'Coberturas', href: '/coberturas' },
] as const

const PROFILE_ITEM = { icon: UserCircle, label: 'Mi Perfil', href: '/perfil' }

const STORAGE_KEY = 'sidebar-collapsed'

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setCollapsed(stored === 'true')
    }
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  const width = collapsed ? 'w-[60px]' : 'w-[240px]'

  return (
    <aside
      className={`${width} flex h-screen flex-col border-r border-[#1e1e2e] bg-[#12121a] transition-all duration-200`}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between px-3 border-b border-[#1e1e2e]">
        {!collapsed && (
          <span className="text-sm font-semibold text-[#00ff88] truncate">
            Dep. Coberturas
          </span>
        )}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          className="ml-auto rounded p-1 text-[#64748b] hover:bg-[#1e1e2e] hover:text-[#e2e8f0] transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav principal */}
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`
                flex items-center gap-3 px-3 py-2.5 mx-2 my-0.5 rounded-md text-sm transition-colors
                ${isActive
                  ? 'bg-[#1e1e2e] text-[#00ff88]'
                  : 'text-[#64748b] hover:bg-[#1e1e2e] hover:text-[#e2e8f0]'
                }
              `}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
              {isActive && !collapsed && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#00ff88]" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Mi Perfil — fijo al fondo */}
      <div className="border-t border-[#1e1e2e] py-3">
        <Link
          href={PROFILE_ITEM.href}
          title={collapsed ? PROFILE_ITEM.label : undefined}
          className={`
            flex items-center gap-3 px-3 py-2.5 mx-2 rounded-md text-sm transition-colors
            ${pathname === PROFILE_ITEM.href
              ? 'bg-[#1e1e2e] text-[#00ff88]'
              : 'text-[#64748b] hover:bg-[#1e1e2e] hover:text-[#e2e8f0]'
            }
          `}
        >
          <PROFILE_ITEM.icon size={18} className="shrink-0" />
          {!collapsed && <span className="truncate">{PROFILE_ITEM.label}</span>}
        </Link>
      </div>
    </aside>
  )
}
```

- [ ] **Step 5: Correr el test para verificar que pasa**

```bash
npm run test:run -- src/components/layout/Sidebar.test.tsx
```

Expected: 2 passed

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/Sidebar.test.tsx
git commit -m "feat: agregar componente Sidebar colapsable con navegación"
```

---

## Task 12: Crear componente TopBar

**Files:**
- Create: `src/components/layout/TopBar.tsx`

- [ ] **Step 1: Implementar src/components/layout/TopBar.tsx**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface TopBarProps {
  userName?: string
}

export function TopBar({ userName }: TopBarProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-[#1e1e2e] bg-[#12121a] px-4">
      <div />
      <div className="flex items-center gap-3">
        {userName && (
          <span className="text-sm text-[#64748b]">{userName}</span>
        )}
        <button
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-[#64748b] hover:bg-[#1e1e2e] hover:text-red-400 transition-colors"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/TopBar.tsx
git commit -m "feat: agregar componente TopBar con botón de logout"
```

---

## Task 13: Crear layout del dashboard y rutas protegidas

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/(dashboard)/dashboard/page.tsx`
- Create: `src/app/(dashboard)/inversion-causal/page.tsx`
- Create: `src/app/(dashboard)/portafolios/page.tsx`
- Create: `src/app/(dashboard)/agente-ppo/page.tsx`
- Create: `src/app/(dashboard)/coberturas/page.tsx`
- Create: `src/app/(dashboard)/perfil/page.tsx`

- [ ] **Step 1: Crear directorios**

```bash
mkdir -p "src/app/(dashboard)/dashboard" \
         "src/app/(dashboard)/inversion-causal" \
         "src/app/(dashboard)/portafolios" \
         "src/app/(dashboard)/agente-ppo" \
         "src/app/(dashboard)/coberturas" \
         "src/app/(dashboard)/perfil"
```

- [ ] **Step 2: Crear src/app/(dashboard)/layout.tsx**

```tsx
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
    : { data: null }

  return (
    <div className="flex h-screen bg-[#0a0a0f]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar userName={profile?.full_name ?? user?.email ?? undefined} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Crear src/app/(dashboard)/dashboard/page.tsx**

```tsx
import { LayoutDashboard, TrendingUp, Shield, BookOpen } from 'lucide-react'
import Link from 'next/link'

const STAT_CARDS = [
  { label: 'Tickers analizados', value: '—', icon: TrendingUp, href: '/inversion-causal' },
  { label: 'Portafolios activos', value: '—', icon: LayoutDashboard, href: '/portafolios' },
  { label: 'Cobertura activa', value: '—', icon: Shield, href: '/coberturas' },
  { label: 'Track record del mes', value: '—', icon: BookOpen, href: '/coberturas' },
] as const

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#e2e8f0]">Dashboard</h1>
        <p className="mt-1 text-sm text-[#64748b]">
          Sistema de Análisis de Riesgos — Departamento de Coberturas
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ label, value, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="group rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5 transition-colors hover:border-[#00ff88]/30"
          >
            <div className="flex items-center justify-between">
              <Icon size={18} className="text-[#64748b] group-hover:text-[#00ff88] transition-colors" />
            </div>
            <p className="mt-4 text-3xl font-bold text-[#e2e8f0]">{value}</p>
            <p className="mt-1 text-sm text-[#64748b]">{label}</p>
          </Link>
        ))}
      </div>

      {/* Accesos rápidos */}
      <div>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[#64748b]">
          Módulos
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Inversión Causal', description: 'Análisis de hipótesis e catalizadores', href: '/inversion-causal' },
            { label: 'Portafolios Híbridos', description: 'Construcción y ponderación de portafolios', href: '/portafolios' },
            { label: 'Agente PPO', description: 'Monitoreo continuo y rebalanceo automatizado', href: '/agente-ppo' },
            { label: 'Coberturas', description: 'Opciones financieras y futuros', href: '/coberturas' },
          ].map(({ label, description, href }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4 transition-colors hover:border-[#00ff88]/30 hover:bg-[#1e1e2e]"
            >
              <p className="font-medium text-[#e2e8f0]">{label}</p>
              <p className="mt-1 text-xs text-[#64748b]">{description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Crear páginas placeholder para las rutas futuras**

Crear `src/app/(dashboard)/inversion-causal/page.tsx`:

```tsx
export default function InversionCausalPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#e2e8f0]">Inversión Causal</h1>
      <p className="text-[#64748b]">Fase 2 — Próximamente</p>
    </div>
  )
}
```

Crear `src/app/(dashboard)/portafolios/page.tsx`:

```tsx
export default function PortafoliosPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#e2e8f0]">Portafolios Híbridos</h1>
      <p className="text-[#64748b]">Fase 3 — Próximamente</p>
    </div>
  )
}
```

Crear `src/app/(dashboard)/agente-ppo/page.tsx`:

```tsx
export default function AgentePPOPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#e2e8f0]">Agente PPO</h1>
      <p className="text-[#64748b]">Fase 4 — Próximamente</p>
    </div>
  )
}
```

Crear `src/app/(dashboard)/coberturas/page.tsx`:

```tsx
export default function CoberturasPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#e2e8f0]">Coberturas</h1>
      <p className="text-[#64748b]">Fases 5-6 — Próximamente</p>
    </div>
  )
}
```

Crear `src/app/(dashboard)/perfil/page.tsx`:

```tsx
export default function PerfilPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#e2e8f0]">Mi Perfil</h1>
      <p className="text-[#64748b]">Fase 7 — Próximamente</p>
    </div>
  )
}
```

- [ ] **Step 5: Verificar TypeScript en todos los archivos**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: Sin errores de tipos

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/"
git commit -m "feat: agregar layout dashboard con sidebar, topbar y páginas placeholder"
```

---

## Task 14: Verificación final

- [ ] **Step 1: Correr todos los tests**

```bash
npm run test:run
```

Expected: Todos los tests pasan (login: 2, register: 2, reset: 2, sidebar: 2 = 8 total)

- [ ] **Step 2: Verificar TypeScript en todo el proyecto**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Verificar build de producción**

```bash
npm run build
```

Expected: Build exitoso sin errores. Si hay warnings de TypeScript sobre `profiles` table en el layout, son esperados hasta tener Supabase configurado.

- [ ] **Step 4: Verificar manualmente en el browser**

```bash
npm run dev
```

Checklist de verificación manual:
- [ ] `http://localhost:3000` → redirige a `/dashboard` → redirige a `/login` (sin sesión)
- [ ] `/login` — se ve el formulario con tema dark y logo ◈
- [ ] `/register` — formulario con 4 campos
- [ ] `/reset-password` — formulario con 1 campo email
- [ ] Navegar entre `/login`, `/register`, `/reset-password` funciona con los links

**Para probar con Supabase real:** Asegurarse de que `.env.local` tiene credenciales válidas, luego:
- [ ] Registrarse con email → recibir confirmación → hacer login → llegar al dashboard
- [ ] Dashboard muestra sidebar colapsable, 4 stat cards vacías, y accesos rápidos
- [ ] Sidebar colapsa/expande y persiste al recargar
- [ ] Logout funciona y redirige a `/login`

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat: Fase 1 completa — auth con Supabase SSR + shell de navegación"
```

---

## Supabase — Setup requerido en el dashboard

Antes de probar el flujo completo, ejecutar en el SQL Editor de Supabase:

```sql
-- Tabla de perfiles extendidos
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text default 'operador',
  avatar_url  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Trigger: crear perfil automáticamente al registrarse
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;

create policy "perfil propio" on public.profiles
  for all using (auth.uid() = id);
```

---

## Criterios de éxito

- [ ] Usuario puede registrarse y recibe email de confirmación
- [ ] Usuario confirmado puede hacer login
- [ ] Usuario puede solicitar reset de contraseña
- [ ] Rutas del dashboard redirigen a `/login` sin sesión
- [ ] Usuario autenticado que va a `/login` es redirigido a `/dashboard`
- [ ] Sidebar colapsa/expande y persiste el estado en localStorage
- [ ] Dashboard home muestra 4 cards vacías con navegación funcional
- [ ] El diseño dark financiero es consistente en todas las páginas
- [ ] 8 tests pasan
- [ ] Build de producción sin errores
