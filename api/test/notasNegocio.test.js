import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canManageNotaEstado,
  canManageNotaRuta,
  notaRequiereAtencion,
  requiereAtencionAfterEstadoChange,
  requiereAtencionFromComentariosRestantes,
  shouldSetRequiereAtencionOnComment,
} from '../../shared/notasNegocio.js'

test('notaRequiereAtencion = PENDIENTE + comentarios', () => {
  assert.equal(notaRequiereAtencion({ estado: 'PENDIENTE', tiene_comentarios: true }), true)
  assert.equal(notaRequiereAtencion({ estado: 'PENDIENTE', tiene_comentarios: false }), false)
  assert.equal(notaRequiereAtencion({ estado: 'RESUELTA', tiene_comentarios: true }), false)
})

test('requiereAtencionFromComentariosRestantes', () => {
  assert.equal(requiereAtencionFromComentariosRestantes('PENDIENTE', 1), true)
  assert.equal(requiereAtencionFromComentariosRestantes('PENDIENTE', 0), false)
  assert.equal(requiereAtencionFromComentariosRestantes('CANCELADA', 3), false)
})

test('shouldSetRequiereAtencionOnComment solo en PENDIENTE', () => {
  assert.equal(shouldSetRequiereAtencionOnComment('PENDIENTE'), true)
  assert.equal(shouldSetRequiereAtencionOnComment('pendiente'), true)
  assert.equal(shouldSetRequiereAtencionOnComment('RESUELTA'), false)
  assert.equal(shouldSetRequiereAtencionOnComment('CANCELADA'), false)
})

test('requiereAtencionAfterEstadoChange apaga bandera al resolver', () => {
  assert.equal(requiereAtencionAfterEstadoChange('RESUELTA', true), false)
  assert.equal(requiereAtencionAfterEstadoChange('CANCELADA', true), false)
  assert.equal(requiereAtencionAfterEstadoChange('PENDIENTE', true), true)
  assert.equal(requiereAtencionAfterEstadoChange('PENDIENTE', false), false)
})

test('canManageNotaEstado — CREDITO y ADMIN sí; VENDEDOR no', () => {
  assert.equal(canManageNotaEstado({ rol: 'CREDITO' }), true)
  assert.equal(canManageNotaEstado({ rol: 'ADMIN' }), true)
  assert.equal(canManageNotaEstado({ rol: 'VENDEDOR' }), false)
  assert.equal(canManageNotaEstado({ isSuperuser: true, rol: 'VENDEDOR' }), true)
})

test('canManageNotaRuta — solo ADMIN o superuser', () => {
  assert.equal(canManageNotaRuta({ rol: 'ADMIN' }), true)
  assert.equal(canManageNotaRuta({ rol: 'CREDITO' }), false)
  assert.equal(canManageNotaRuta({ isSuperuser: true, rol: 'VENDEDOR' }), true)
})
