import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createLoginRateLimiter,
  isAuthRateLimitDisabled,
  parsePositiveInt,
  resolveTrustProxy,
} from '../src/config/rateLimit.js'

test('parsePositiveInt usa fallback si el valor no es válido', () => {
  assert.equal(parsePositiveInt('abc', 10), 10)
  assert.equal(parsePositiveInt('-1', 10), 10)
  assert.equal(parsePositiveInt('25', 10), 25)
})

test('isAuthRateLimitDisabled reconoce true/1/yes', () => {
  assert.equal(isAuthRateLimitDisabled({ AUTH_RATE_LIMIT_DISABLED: 'true' }), true)
  assert.equal(isAuthRateLimitDisabled({ AUTH_RATE_LIMIT_DISABLED: '1' }), true)
  assert.equal(isAuthRateLimitDisabled({}), false)
})

test('resolveTrustProxy en producción por defecto confía en 1 hop', () => {
  assert.equal(resolveTrustProxy({ NODE_ENV: 'production' }), 1)
  assert.equal(resolveTrustProxy({ NODE_ENV: 'development' }), false)
  assert.equal(resolveTrustProxy({ TRUST_PROXY: 'false', NODE_ENV: 'production' }), false)
})

test('createLoginRateLimiter devuelve no-op si está deshabilitado', () => {
  const mw = createLoginRateLimiter({ AUTH_RATE_LIMIT_DISABLED: 'true' })
  let called = false
  mw({}, {}, () => {
    called = true
  })
  assert.equal(called, true)
})
