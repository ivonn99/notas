import rateLimit from 'express-rate-limit'

const DEFAULT_LOGIN_WINDOW_MS = 15 * 60 * 1000
const DEFAULT_LOGIN_MAX = 20

/** @param {string | undefined} raw @param {number} fallback */
export function parsePositiveInt(raw, fallback) {
  const n = Number.parseInt(String(raw ?? '').trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** @param {Record<string, string | undefined>} [env] */
export function isAuthRateLimitDisabled(env = process.env) {
  const v = String(env.AUTH_RATE_LIMIT_DISABLED ?? '').trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

/**
 * Detrás de Render/Railway/Netlify proxy hace falta para IP real en rate limit.
 * @param {Record<string, string | undefined>} [env]
 * @returns {number | false}
 */
export function resolveTrustProxy(env = process.env) {
  const raw = String(env.TRUST_PROXY ?? '').trim().toLowerCase()
  if (raw === 'false' || raw === '0' || raw === 'no') return false
  if (raw === 'true' || raw === 'yes') return 1
  if (raw) {
    const n = Number.parseInt(raw, 10)
    if (Number.isFinite(n) && n >= 0) return n
  }
  return String(env.NODE_ENV || '').toLowerCase() === 'production' ? 1 : false
}

/** @param {import('express').Express} app @param {Record<string, string | undefined>} [env] */
export function applyTrustProxy(app, env = process.env) {
  const value = resolveTrustProxy(env)
  if (value !== false) {
    app.set('trust proxy', value)
  }
}

/**
 * Límite estricto en POST /api/auth/login (fuerza bruta).
 * @param {Record<string, string | undefined>} [env]
 */
export function createLoginRateLimiter(env = process.env) {
  if (isAuthRateLimitDisabled(env)) {
    return (_req, _res, next) => next()
  }

  const windowMs = parsePositiveInt(env.AUTH_RATE_LIMIT_WINDOW_MS, DEFAULT_LOGIN_WINDOW_MS)
  const max = parsePositiveInt(env.AUTH_RATE_LIMIT_MAX, DEFAULT_LOGIN_MAX)

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler(_req, res) {
      res.status(429).json({
        ok: false,
        error: 'Demasiados intentos de inicio de sesión. Intenta más tarde.',
        code: 429,
      })
    },
  })
}

/** @param {Record<string, string | undefined>} [env] */
export function logRateLimitStartup(env = process.env) {
  if (isAuthRateLimitDisabled(env)) {
    console.warn('[rate-limit] AUTH_RATE_LIMIT_DISABLED=true — login sin límite')
    return
  }
  const windowMs = parsePositiveInt(env.AUTH_RATE_LIMIT_WINDOW_MS, DEFAULT_LOGIN_WINDOW_MS)
  const max = parsePositiveInt(env.AUTH_RATE_LIMIT_MAX, DEFAULT_LOGIN_MAX)
  const windowMin = Math.round(windowMs / 60_000)
  console.info(`[rate-limit] POST /api/auth/login: ${max} intentos fallidos / ${windowMin} min por IP`)
}
