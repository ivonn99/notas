import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canManageNotaEstado,
  canManageNotaRuta,
  requiereAtencionAfterEstadoChange,
  shouldSetRequiereAtencionOnComment,
} from '../../shared/notasNegocio.js'

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
