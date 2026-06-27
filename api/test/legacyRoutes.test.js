import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isDbPingEnabled,
  isLegacyApiEnabled,
} from '../src/config/legacyRoutes.js'

test('isLegacyApiEnabled solo con flag explícito', () => {
  assert.equal(isLegacyApiEnabled({}), false)
  assert.equal(isLegacyApiEnabled({ API_LEGACY_ROUTES: 'false' }), false)
  assert.equal(isLegacyApiEnabled({ API_LEGACY_ROUTES: 'true' }), true)
  assert.equal(isLegacyApiEnabled({ API_LEGACY_ROUTES: '1' }), true)
})

test('isDbPingEnabled con legacy o DB_PING_ENABLED', () => {
  assert.equal(isDbPingEnabled({}), false)
  assert.equal(isDbPingEnabled({ DB_PING_ENABLED: 'true' }), true)
  assert.equal(isDbPingEnabled({ API_LEGACY_ROUTES: 'true' }), true)
})
