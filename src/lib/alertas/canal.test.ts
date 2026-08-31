import { describe, expect, it } from 'vitest'
import { buscarLineaDeCuenta, interpretarLinea } from '@/lib/alertas/canal'

// Salida real de `openclaw channels status --channel whatsapp` (2026-08-31).
const SALIDA = `Checking channel status…
Gateway reachable.
- WhatsApp nexus (Nexus): enabled, configured, not linked, stopped, disconnected, dm:open, allow:*, health:not-running, error:not linked
- WhatsApp stefy (Stefy): enabled, configured, linked, running, connected, dm:open, allow:*, health:healthy

Tip: https://docs.openclaw.ai/cli#status adds gateway health probes.`

describe('buscarLineaDeCuenta', () => {
  it('encuentra la cuenta pedida y no la vecina', () => {
    expect(buscarLineaDeCuenta(SALIDA, 'nexus')).toContain('not linked')
    expect(buscarLineaDeCuenta(SALIDA, 'stefy')).toContain('health:healthy')
  })

  it('devuelve null si la cuenta no aparece', () => {
    expect(buscarLineaDeCuenta(SALIDA, 'inexistente')).toBeNull()
  })

  it('no confunde una cuenta con otra cuyo nombre la contiene', () => {
    const salida = '- WhatsApp nexus2 (Otra): enabled, configured, linked, running, connected'
    expect(buscarLineaDeCuenta(salida, 'nexus')).toBeNull()
  })
})

describe('interpretarLinea', () => {
  it('una cuenta vinculada y conectada está viva', () => {
    expect(interpretarLinea(buscarLineaDeCuenta(SALIDA, 'stefy')!)).toBe('vivo')
  })

  it('"not linked" no se confunde con "linked"', () => {
    // El fallo que motivó este módulo: `incluye('linked')` da verdadero sobre
    // "not linked" y daría por vivo un canal muerto.
    expect(interpretarLinea(buscarLineaDeCuenta(SALIDA, 'nexus')!)).toBe('caido')
  })

  it('un canal desconectado está caído aunque figure como vinculado', () => {
    const linea = '- WhatsApp nexus (Nexus): enabled, configured, linked, running, disconnected'
    expect(interpretarLinea(linea)).toBe('caido')
  })

  it('un formato que no reconoce no se da por vivo ni por caído', () => {
    expect(interpretarLinea('- WhatsApp nexus (Nexus): algo completamente nuevo')).toBe('desconocido')
  })

  it('el nombre de la cuenta antes de los dos puntos no contamina el análisis', () => {
    // "connected" en el nombre no debe contar como campo de estado.
    const linea = '- WhatsApp connected (X): enabled, configured, not linked, stopped'
    expect(interpretarLinea(linea)).toBe('caido')
  })
})
