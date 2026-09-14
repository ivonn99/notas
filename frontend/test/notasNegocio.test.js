import { describe, expect, it } from 'vitest'

import {
  canManageNotaEstado,
  canManageNotaRuta,
  notaRequiereAtencion,
  requiereAtencionAfterEstadoChange,
  requiereAtencionFromComentariosRestantes,
  shouldSetRequiereAtencionOnComment,
} from '../../shared/notasNegocio.js'

describe('notasNegocio (shared)', () => {
  it('notaRequiereAtencion = PENDIENTE + comentarios', () => {
    expect(notaRequiereAtencion({ estado: 'PENDIENTE', tiene_comentarios: true })).toBe(true)
    expect(notaRequiereAtencion({ estado: 'PENDIENTE', aclaraciones: [{ id: 1 }] })).toBe(true)
    expect(notaRequiereAtencion({ estado: 'PENDIENTE', tiene_comentarios: false })).toBe(false)
    expect(notaRequiereAtencion({ estado: 'RESUELTA', tiene_comentarios: true })).toBe(false)
    expect(notaRequiereAtencion({ estado: 'PENDIENTE', requiere_atencion: true })).toBe(true)
  })

  it('requiereAtencionFromComentariosRestantes apaga sin comentarios', () => {
    expect(requiereAtencionFromComentariosRestantes('PENDIENTE', 2)).toBe(true)
    expect(requiereAtencionFromComentariosRestantes('PENDIENTE', 0)).toBe(false)
    expect(requiereAtencionFromComentariosRestantes('RESUELTA', 5)).toBe(false)
  })

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
