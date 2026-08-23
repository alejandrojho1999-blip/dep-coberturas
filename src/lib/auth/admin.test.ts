import { describe, it, expect } from 'vitest'
import { isAdminEmail, ADMIN_EMAILS } from './admin'

describe('isAdminEmail', () => {
  it('reconoce al administrador', () => {
    expect(isAdminEmail('lriofrio915@gmail.com')).toBe(true)
  })

  it('no distingue mayúsculas ni espacios sobrantes', () => {
    expect(isAdminEmail('  LRiofrio915@Gmail.com  ')).toBe(true)
  })

  it('rechaza a cualquier otro usuario', () => {
    expect(isAdminEmail('otro@gmail.com')).toBe(false)
    expect(isAdminEmail('lriofrio915@otrodominio.com')).toBe(false)
  })

  it('falla cerrado sin correo', () => {
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
    expect(isAdminEmail('')).toBe(false)
  })

  it('la lista coincide con la de la política RLS de la migración 018', () => {
    // Si esto cambia hay que tocar también
    // supabase/migrations/018_agent_recommendations_admin_only.sql
    expect([...ADMIN_EMAILS]).toEqual(['lriofrio915@gmail.com'])
  })
})
