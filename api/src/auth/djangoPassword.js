import crypto from 'node:crypto'

function randomSalt22() {
  const chars =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let s = ''
  for (let i = 0; i < 22; i++) {
    s += chars[crypto.randomInt(0, chars.length)]
  }
  return s
}

/**
 * Genera hash Django PBKDF2-SHA256 (misma lógica que `set-user-password.mjs`).
 */
export function encodeDjangoPassword(plain, iterations = 600_000) {
  const salt = randomSalt22()
  const hash = crypto.pbkdf2Sync(plain, salt, iterations, 32, 'sha256')
  return `pbkdf2_sha256$${iterations}$${salt}$${hash.toString('base64')}`
}

/** Valores antiguos guardados sin hash (texto plano en columna password). */
export function isProbablyLegacyPlaintextPassword(stored) {
  return Boolean(
    stored && typeof stored === 'string' && !stored.includes('$'),
  )
}

export function legacyPlaintextMatches(plain, stored) {
  if (!plain || !stored) return false
  if (plain.length !== stored.length) return false
  try {
    return crypto.timingSafeEqual(
      Buffer.from(plain, 'utf8'),
      Buffer.from(stored, 'utf8'),
    )
  } catch {
    return false
  }
}

/**
 * Verifica contraseña en formato Django (PBKDF2-SHA256).
 * Formato: pbkdf2_sha256$iteraciones$salt$hash_base64
 */
export function verifyDjangoPassword(plain, encoded) {
  if (!plain || !encoded || typeof encoded !== 'string') return false

  const parts = encoded.split('$')
  if (parts.length !== 4) return false

  const [algorithm, iterStr, salt, hashB64] = parts
  if (algorithm !== 'pbkdf2_sha256') return false

  const iterations = parseInt(iterStr, 10)
  if (!Number.isFinite(iterations) || iterations < 1) return false

  const derived = crypto.pbkdf2Sync(plain, salt, iterations, 32, 'sha256')

  let expected
  try {
    expected = Buffer.from(hashB64, 'base64')
  } catch {
    return false
  }

  if (expected.length !== derived.length) return false

  try {
    return crypto.timingSafeEqual(expected, derived)
  } catch {
    return false
  }
}

export function djangoPasswordAlgorithm(encoded) {
  if (!encoded || typeof encoded !== 'string') return null
  return encoded.split('$')[0] ?? null
}
