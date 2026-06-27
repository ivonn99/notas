import { afterEach, describe, expect, it, vi } from 'vitest'

import { decodeDbJwtPayloadUnsafe, isDbJwtLoginEnabled } from '../src/lib/dbJwtSession.js'

function fakeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.signature`
}

describe('decodeDbJwtPayloadUnsafe', () => {
  it('decodifica payload JWT', () => {
    const token = fakeJwt({ sub: '42', user_metadata: { rol: 'CREDITO', usuarioId: 7 } })
    const payload = decodeDbJwtPayloadUnsafe(token)
    expect(payload.sub).toBe('42')
    expect(payload.user_metadata.rol).toBe('CREDITO')
    expect(payload.user_metadata.usuarioId).toBe(7)
  })

  it('devuelve null para token inválido', () => {
    expect(decodeDbJwtPayloadUnsafe('')).toBeNull()
    expect(decodeDbJwtPayloadUnsafe('solo-un-segmento')).toBeNull()
    expect(decodeDbJwtPayloadUnsafe('a.%%%invalid')).toBeNull()
  })
})

describe('isDbJwtLoginEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('acepta true, 1 y yes', () => {
    vi.stubEnv('VITE_SUPABASE_DB_LOGIN', 'true')
    expect(isDbJwtLoginEnabled()).toBe(true)
    vi.stubEnv('VITE_SUPABASE_DB_LOGIN', '1')
    expect(isDbJwtLoginEnabled()).toBe(true)
    vi.stubEnv('VITE_SUPABASE_DB_LOGIN', 'YES')
    expect(isDbJwtLoginEnabled()).toBe(true)
  })

  it('rechaza valores vacíos o false', () => {
    vi.stubEnv('VITE_SUPABASE_DB_LOGIN', '')
    expect(isDbJwtLoginEnabled()).toBe(false)
    vi.stubEnv('VITE_SUPABASE_DB_LOGIN', 'false')
    expect(isDbJwtLoginEnabled()).toBe(false)
  })
})
