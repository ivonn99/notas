import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isLocalDevOrigin,
  isOriginAllowed,
  originMatchesPattern,
  parseCorsOrigins,
} from '../src/config/cors.js'

test('parseCorsOrigins separa por coma y punto y coma', () => {
  const list = parseCorsOrigins('https://a.app, https://b.app;https://c.app')
  assert.deepEqual(list, ['https://a.app', 'https://b.app', 'https://c.app'])
})

test('originMatchesPattern admite comodín netlify', () => {
  assert.equal(
    originMatchesPattern('https://deploy-preview-12--notas.netlify.app', 'https://*.netlify.app'),
    true,
  )
  assert.equal(originMatchesPattern('https://evil.netlify.app.attacker.com', 'https://*.netlify.app'), false)
})

test('isLocalDevOrigin reconoce localhost y 127.0.0.1', () => {
  assert.equal(isLocalDevOrigin('http://localhost:5175'), true)
  assert.equal(isLocalDevOrigin('http://127.0.0.1:3001'), true)
  assert.equal(isLocalDevOrigin('https://notas.netlify.app'), false)
})

test('isOriginAllowed en desarrollo permite localhost sin CORS_ORIGINS', () => {
  assert.equal(
    isOriginAllowed('http://localhost:5173', { NODE_ENV: 'development' }),
    true,
  )
})

test('isOriginAllowed en producción exige CORS_ORIGINS', () => {
  const env = { NODE_ENV: 'production', CORS_ORIGINS: 'https://notas.netlify.app' }
  assert.equal(isOriginAllowed('https://notas.netlify.app', env), true)
  assert.equal(isOriginAllowed('http://localhost:5173', env), false)
})

test('isOriginAllowed sin Origin (health, curl)', () => {
  assert.equal(isOriginAllowed(undefined, { NODE_ENV: 'production' }), true)
})
