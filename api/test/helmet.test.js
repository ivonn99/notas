import test from 'node:test'
import assert from 'node:assert/strict'

import { createHelmetMiddleware, isHelmetDisabled } from '../src/config/helmet.js'

test('isHelmetDisabled reconoce true/1/yes', () => {
  assert.equal(isHelmetDisabled({ HELMET_DISABLED: 'true' }), true)
  assert.equal(isHelmetDisabled({ HELMET_DISABLED: '1' }), true)
  assert.equal(isHelmetDisabled({}), false)
})

test('createHelmetMiddleware devuelve no-op si está deshabilitado', () => {
  const mw = createHelmetMiddleware({ HELMET_DISABLED: 'true' })
  let called = false
  mw({}, {}, () => {
    called = true
  })
  assert.equal(called, true)
})

test('createHelmetMiddleware devuelve función middleware cuando está activo', () => {
  const mw = createHelmetMiddleware({ NODE_ENV: 'test' })
  assert.equal(typeof mw, 'function')
  assert.equal(mw.length, 3)
})
