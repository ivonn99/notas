import test from 'node:test'
import assert from 'node:assert/strict'

process.env.JWT_SECRET = 'test-secret-para-tests-32'
process.env.NODE_ENV = 'test'

import { signUserToken, verifyUserToken } from '../src/auth/tokens.js'
import { requireRoles } from '../src/middleware/auth.js'

test('signUserToken y verifyUserToken roundtrip', () => {
  const token = signUserToken({
    sub: '42',
    username: 'demo',
    rol: 'CREDITO',
    isSuperuser: false,
    isStaff: true,
  })
  const payload = verifyUserToken(token)
  assert.equal(payload.sub, '42')
  assert.equal(payload.rol, 'CREDITO')
})

test('requireRoles permite rol autorizado', () => {
  const mw = requireRoles('ADMIN', 'CREDITO')
  const req = { user: { rol: 'CREDITO', isSuperuser: false } }
  let ok = false
  mw(req, { status: () => ({ json: () => {} }) }, () => {
    ok = true
  })
  assert.equal(ok, true)
})

test('requireRoles rechaza VENDEDOR en ruta admin', () => {
  const mw = requireRoles('ADMIN')
  const req = { user: { rol: 'VENDEDOR', isSuperuser: false } }
  let statusCode = null
  mw(
    req,
    {
      status(code) {
        statusCode = code
        return { json() {} }
      },
    },
    () => {},
  )
  assert.equal(statusCode, 403)
})

test('requireRoles permite superuser', () => {
  const mw = requireRoles('ADMIN')
  const req = { user: { rol: 'VENDEDOR', isSuperuser: true } }
  let ok = false
  mw(req, { status: () => ({ json: () => {} }) }, () => {
    ok = true
  })
  assert.equal(ok, true)
})
