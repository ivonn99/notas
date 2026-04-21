import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeDelaySeconds,
  parseClearSessionFlag,
  resolveTestPayload,
  validateBatchInput,
  validateManualSendPayload,
} from '../src/services/whatsappValidationService.js'

test('parseClearSessionFlag reconoce valores verdaderos', () => {
  assert.equal(parseClearSessionFlag('true'), true)
  assert.equal(parseClearSessionFlag('1'), true)
  assert.equal(parseClearSessionFlag('si'), true)
  assert.equal(parseClearSessionFlag('sí'), true)
  assert.equal(parseClearSessionFlag('yes'), true)
})

test('parseClearSessionFlag regresa false para otros valores', () => {
  assert.equal(parseClearSessionFlag('false'), false)
  assert.equal(parseClearSessionFlag('0'), false)
  assert.equal(parseClearSessionFlag('no'), false)
  assert.equal(parseClearSessionFlag(undefined), false)
})

test('validateManualSendPayload valida y normaliza', () => {
  const payload = validateManualSendPayload({
    phone: ' 5215531917367 ',
    message: ' hola ',
  })
  assert.deepEqual(payload, { phone: '5215531917367', message: 'hola' })
})

test('validateManualSendPayload falla cuando phone falta', () => {
  assert.throws(
    () => validateManualSendPayload({ phone: '', message: 'ok' }),
    (err) => err?.message === 'phone es requerido' && err?.status === 400,
  )
})

test('validateManualSendPayload falla cuando message falta', () => {
  assert.throws(
    () => validateManualSendPayload({ phone: '521', message: '   ' }),
    (err) => err?.message === 'message es requerido' && err?.status === 400,
  )
})

test('resolveTestPayload usa defaults correctamente', () => {
  const payload = resolveTestPayload({}, '5215512345678')
  assert.equal(payload.phone, '5215512345678')
  assert.ok(payload.message.includes('Mensaje de prueba DMH'))
})

test('resolveTestPayload prioriza body y limpia espacios', () => {
  const payload = resolveTestPayload(
    { phone: '  5215531917367 ', message: '  Mensaje custom  ' },
    '5210000000000',
  )
  assert.deepEqual(payload, { phone: '5215531917367', message: 'Mensaje custom' })
})

test('resolveTestPayload falla sin phone', () => {
  assert.throws(
    () => resolveTestPayload({}, ''),
    (err) => err?.message === 'Falta phone en body o WHATSAPP_TEST_PHONE en .env' && err?.status === 400,
  )
})

test('validateBatchInput valida arreglo y límites', () => {
  const items = [{ phone: '521', message: 'hola' }]
  assert.equal(validateBatchInput(items), items)
  assert.throws(
    () => validateBatchInput([]),
    (err) => err?.message === 'items es requerido y no puede estar vacío' && err?.status === 400,
  )
  assert.throws(
    () => validateBatchInput(new Array(201).fill({ phone: '1', message: 'm' })),
    (err) => err?.message === 'Máximo 200 mensajes por lote' && err?.status === 400,
  )
})

test('normalizeDelaySeconds acota rango y fallback', () => {
  assert.equal(normalizeDelaySeconds(undefined), 5)
  assert.equal(normalizeDelaySeconds('0'), 1)
  assert.equal(normalizeDelaySeconds('99'), 30)
  assert.equal(normalizeDelaySeconds('7'), 7)
})
