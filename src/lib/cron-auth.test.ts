import { describe, it, expect, afterEach } from 'vitest'
import { authorizeCron, cronUserId } from './cron-auth'

const SECRETO = 'un-secreto-suficientemente-largo'

function req(authorization?: string): Request {
  return new Request('https://example.com/api/cron/review-exits', {
    headers: authorization ? { authorization } : {},
  })
}

afterEach(() => {
  delete process.env.CRON_SECRET
  delete process.env.CRON_USER_ID
})

describe('authorizeCron', () => {
  it('acepta el secreto correcto', () => {
    process.env.CRON_SECRET = SECRETO
    expect(authorizeCron(req(`Bearer ${SECRETO}`))).toEqual({ ok: true })
  })

  it('rechaza un secreto equivocado', () => {
    process.env.CRON_SECRET = SECRETO
    const r = authorizeCron(req('Bearer otro-secreto-cualquiera-aqui'))
    expect(r).toEqual({ ok: false, status: 401, error: 'Unauthorized' })
  })

  it('rechaza un prefijo de la longitud correcta', () => {
    process.env.CRON_SECRET = SECRETO
    const casi = SECRETO.slice(0, -1) + 'X'
    expect(authorizeCron(req(`Bearer ${casi}`)).ok).toBe(false)
  })

  it('rechaza sin cabecera', () => {
    process.env.CRON_SECRET = SECRETO
    expect(authorizeCron(req()).ok).toBe(false)
  })

  it('rechaza el secreto correcto sin el prefijo Bearer', () => {
    process.env.CRON_SECRET = SECRETO
    expect(authorizeCron(req(SECRETO)).ok).toBe(false)
  })

  it('falla cerrado si el secreto no está configurado: 503, no vía libre', () => {
    const r = authorizeCron(req('Bearer lo-que-sea'))
    expect(r).toEqual({ ok: false, status: 503, error: 'CRON_SECRET no está configurado' })
  })

  it('sin secreto configurado tampoco pasa una petición sin cabecera', () => {
    expect(authorizeCron(req()).ok).toBe(false)
  })
})

describe('cronUserId', () => {
  it('devuelve el usuario configurado', () => {
    process.env.CRON_USER_ID = 'uuid-del-usuario'
    expect(cronUserId()).toBe('uuid-del-usuario')
  })

  it('devuelve null si falta o está vacío', () => {
    expect(cronUserId()).toBeNull()
    process.env.CRON_USER_ID = ''
    expect(cronUserId()).toBeNull()
  })
})
