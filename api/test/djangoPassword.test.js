import test from 'node:test'
import assert from 'node:assert/strict'

import {
  encodeDjangoPassword,
  isProbablyLegacyPlaintextPassword,
  verifyDjangoPassword,
} from '../src/auth/djangoPassword.js'

test('verifyDjangoPassword valida hash generado', () => {
  const hash = encodeDjangoPassword('clave-secreta', 1000)
  assert.equal(verifyDjangoPassword('clave-secreta', hash), true)
  assert.equal(verifyDjangoPassword('otra', hash), false)
})

test('isProbablyLegacyPlaintextPassword detecta texto plano', () => {
  assert.equal(isProbablyLegacyPlaintextPassword('1234'), true)
  assert.equal(isProbablyLegacyPlaintextPassword('pbkdf2_sha256$1$x$y'), false)
})
