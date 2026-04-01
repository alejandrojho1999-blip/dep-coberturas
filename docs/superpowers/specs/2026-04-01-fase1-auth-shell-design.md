# Fase 1: Auth + Shell — Diseño
**Proyecto:** Departamento de Coberturas — Sistema de Análisis de Mercados Financieros  
**Fecha:** 2026-04-01  
**Estado:** Aprobado

---

## Contexto

Este documento cubre la Fase 1 de un sistema de 7 fases para el Departamento de Coberturas de Riesgos. La Fase 1 establece la base: autenticación segura con Supabase y el shell de navegación que envuelve todas las fases futuras.

El sistema completo contempla:
1. **Fase 1** — Auth + Shell *(este documento)*
2. **Fase 2** — Inversión Causal
3. **Fase 3** — Portafolios Híbridos
4. **Fase 4** — Agente PPO
5. **Fase 5** — Coberturas con Opciones Financieras
6. **Fase 6** — Coberturas con Futuros + Track Record
7. **Fase 7** — Mi Perfil

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|----------|----------|-------|
| Tema visual | Dark financiero | Negro/gris carbón, acento verde brillante (#00ff88) |
| Auth provider | Supabase SSR | Patrón oficial Next.js 16, seguro por default |
| Método de login | Email + contraseña | Sistema interno, no requiere OAuth |
| Registro | Abierto con confirmación de email | Supabase envía email de verificación |
| Navegación | Sidebar colapsable | Maximiza espacio para datos financieros |
| Post-login | Dashboard home | Resumen de estado del sistema |

---

## Paleta de colores

| Uso | Color |
|-----|-------|
| Fondo base | `#0a0a0f` |
| Card / superficie | `#12121a` |
| Borde sutil | `#1e1e2e` |
| Acento primario (CTA) | `#00ff88` |
| Acento secundario (links) | `#3b82f6` |
| Texto principal | `#e2e8f0` |
| Texto secundario | `#64748b` |

---

## Arquitectura

### Stack

- Next.js 16.2.1 (App Router)
- React 19.2.4
- Tailwind CSS v4
- shadcn v4
- `@supabase/supabase-js` + `@supabase/ssr`
- `lucide-react` (íconos)

### Patrón de autenticación

Supabase SSR con cliente server-side. La sesión se maneja mediante cookies HttpOnly. El proxy (middleware de Next.js 16) valida la sesión en cada request a rutas protegidas.

```
Request a ruta protegida
  └── proxy.ts verifica cookie de sesión
        ├── Sin sesión → redirect /login
        └── Con sesión → continúa
```

---

## Estructura de archivos

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Layout con sidebar colapsable
│   │   ├── page.tsx              # Dashboard home
│   │   ├── inversion-causal/     # Placeholder — Fase 2
│   │   ├── portafolios/          # Placeholder — Fase 3
│   │   ├── agente-ppo/           # Placeholder — Fase 4
│   │   ├── coberturas/           # Placeholder — Fases 5-6
│   │   └── perfil/               # Placeholder — Fase 7
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # createBrowserClient
│   │   └── server.ts             # createServerClient
│   └── utils.ts
├── components/
│   ├── ui/                       # Componentes shadcn
│   └── layout/
│       ├── Sidebar.tsx           # Sidebar colapsable
│       └── TopBar.tsx            # Barra superior con nombre + logout
└── proxy.ts                      # Middleware de rutas protegidas
```

---

## Páginas de autenticación

### `/login`

- Card centrado sobre fondo oscuro
- Logo + nombre "Departamento de Coberturas"
- Campos: Email, Contraseña (con toggle mostrar/ocultar)
- Botón CTA: "INGRESAR AL SISTEMA" (acento verde)
- Links: "¿Olvidaste tu contraseña?" → `/reset-password` | "¿No tienes cuenta?" → `/register`
- Estado de error: mensaje inline bajo el campo correspondiente
- Usuario autenticado que visita `/login` → redirect `/dashboard`

### `/register`

- Campos: Nombre completo, Email, Contraseña, Confirmar contraseña
- Validación client-side: contraseñas coinciden, longitud mínima 8 chars
- Al enviar: Supabase crea usuario y envía email de confirmación
- Post-submit: muestra estado "Revisa tu correo para confirmar tu cuenta" en la misma página (no navega)
- Link de vuelta a `/login`

### `/reset-password`

- Solo pide Email
- Al enviar: Supabase envía link de reset
- Post-submit: muestra "Te enviamos un email con instrucciones" (sin navegar)
- Link de vuelta a `/login`

---

## Shell de navegación

### Sidebar

- **Colapsado:** 60px de ancho, solo íconos, tooltip con label al hover
- **Expandido:** 240px de ancho, íconos + etiquetas
- Toggle: botón en el TopBar (`≡`)
- Estado persistido en `localStorage` (colapsado/expandido)

| Ícono (lucide) | Label | Ruta |
|----------------|-------|------|
| `LayoutDashboard` | Dashboard | `/dashboard` |
| `TrendingUp` | Inversión Causal | `/inversion-causal` |
| `BarChart2` | Portafolios Híbridos | `/portafolios` |
| `Bot` | Agente PPO | `/agente-ppo` |
| `Shield` | Coberturas | `/coberturas` |
| `UserCircle` | Mi Perfil | `/perfil` |

- Ítem activo: acento verde en el indicador lateral + texto verde
- Hover: fondo sutil `#1e1e2e`
- Mi Perfil fijo al fondo del sidebar

### TopBar

- Botón toggle del sidebar (izquierda)
- Nombre del sistema: "Dep. Coberturas" (centro o izquierda)
- Nombre del usuario + botón logout (derecha)

### Dashboard Home

4 cards de métricas (vacías en Fase 1, se poblan en fases posteriores):
- Tickers analizados
- Portafolios activos
- Cobertura activa
- Track record del mes

Accesos rápidos a cada módulo principal.

---

## Modelo de datos — Supabase

### Tabla `public.profiles`

```sql
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text default 'operador',  -- 'operador' | 'admin'
  avatar_url  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
```

### Trigger — creación automática al registrarse

```sql
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
```

### Row Level Security

```sql
alter table public.profiles enable row level security;

create policy "perfil propio" on public.profiles
  for all using (auth.uid() = id);
```

---

## proxy.ts — Rutas protegidas

```ts
// Rutas que requieren sesión activa
matcher: ['/(dashboard)/:path*', '/inversion-causal/:path*', '/portafolios/:path*',
          '/agente-ppo/:path*', '/coberturas/:path*', '/perfil/:path*']
```

Variables de entorno requeridas:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## Criterios de éxito de la Fase 1

- [ ] Usuario puede registrarse y recibe email de confirmación
- [ ] Usuario confirmado puede hacer login
- [ ] Usuario puede solicitar reset de contraseña
- [ ] Rutas del dashboard redirigen a `/login` sin sesión
- [ ] Usuario autenticado que va a `/login` es redirigido a `/dashboard`
- [ ] Sidebar colapsa/expande y persiste el estado
- [ ] Dashboard home muestra las 4 cards vacías con navegación funcional
- [ ] El diseño dark financiero es consistente en todas las páginas
