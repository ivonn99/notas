import { describe, expect, it } from 'vitest'

import {
  canManageNotaEstado,
  canManageNotaRuta,
  requiereAtencionAfterEstadoChange,
  shouldSetRequiereAtencionOnComment,
} from '../../shared/notasNegocio.js'

describe('notasNegocio (shared)', () => {
  it('shouldSetRequiereAtencionOnComment solo en PENDIENTE', () => {
    expect(shouldSetRequiereAtencionOnComment('PENDIENTE')).toBe(true)
    expect(shouldSetRequiereAtencionOnComment('RESUELTA')).toBe(false)
  })

  it('requiereAtencionAfterEstadoChange apaga bandera al resolver', () => {
    expect(requiereAtencionAfterEstadoChange('RESUELTA', true)).toBe(false)
    expect(requiereAtencionAfterEstadoChange('PENDIENTE', true)).toBe(true)
  })

  it('canManageNotaEstado — CREDITO y ADMIN sí; VENDEDOR no', () => {
    expect(canManageNotaEstado({ rol: 'CREDITO' })).toBe(true)
    expect(canManageNotaEstado({ rol: 'VENDEDOR' })).toBe(false)
    expect(canManageNotaEstado({ isSuperuser: true, rol: 'VENDEDOR' })).toBe(true)
  })

  it('canManageNotaRuta — solo ADMIN o superuser', () => {
    expect(canManageNotaRuta({ rol: 'ADMIN' })).toBe(true)
    expect(canManageNotaRuta({ rol: 'CREDITO' })).toBe(false)
  })
})
