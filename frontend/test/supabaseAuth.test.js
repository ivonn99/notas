import { describe, expect, it } from 'vitest'

import { canAdmin, canCredito, loginIdentifierToSupabaseEmail } from '../src/lib/supabaseAuth.js'

describe('loginIdentifierToSupabaseEmail', () => {
  it('deja emails con @ en minúsculas', () => {
    expect(loginIdentifierToSupabaseEmail('Admin@Empresa.COM')).toBe('admin@empresa.com')
  })

  it('convierte username sin @ a slug@local.test', () => {
    expect(loginIdentifierToSupabaseEmail('juan.perez')).toBe('juan.perez@local.test')
  })

  it('normaliza caracteres inválidos del username', () => {
    expect(loginIdentifierToSupabaseEmail('  María López  ')).toBe('mar_a_l_pez@local.test')
  })

  it('devuelve vacío para entrada vacía', () => {
    expect(loginIdentifierToSupabaseEmail('')).toBe('')
    expect(loginIdentifierToSupabaseEmail(null)).toBe('')
  })
})

describe('canAdmin', () => {
  it('permite ADMIN, CREDITO y superusuario', () => {
    expect(canAdmin({ rol: 'ADMIN' })).toBe(true)
    expect(canAdmin({ rol: 'CREDITO' })).toBe(true)
    expect(canAdmin({ rol: 'VENDEDOR', isSuperuser: true })).toBe(true)
  })

  it('rechaza VENDEDOR sin superusuario', () => {
    expect(canAdmin({ rol: 'VENDEDOR', isSuperuser: false })).toBe(false)
  })
})

describe('canCredito', () => {
  it('coincide con canAdmin para roles de negocio', () => {
    expect(canCredito({ rol: 'CREDITO' })).toBe(true)
    expect(canCredito({ rol: 'VENDEDOR' })).toBe(false)
  })
})
