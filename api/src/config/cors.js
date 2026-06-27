/**
 * CORS del API Node: lista blanca vía CORS_ORIGINS.
 * En desarrollo también se permiten orígenes localhost/127.0.0.1 (cualquier puerto).
 */

/** @param {string | undefined} raw */
export function parseCorsOrigins(raw) {
  return String(raw ?? '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Coincidencia exacta o patrón con un solo comodín `*` (p. ej. https://*.netlify.app).
 * @param {string} origin
 * @param {string} pattern
 */
export function originMatchesPattern(origin, pattern) {
  const o = String(origin || '').trim()
  const p = String(pattern || '').trim()
  if (!o || !p) return false
  if (!p.includes('*')) return o === p
  const escaped = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`, 'i').test(o)
}

/** @param {string} origin */
export function isLocalDevOrigin(origin) {
  try {
    const u = new URL(origin)
    const host = u.hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1'
  } catch {
    return false
  }
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {Set<string>}
 */
export function buildAllowedOriginPatterns(env = process.env) {
  return new Set(parseCorsOrigins(env.CORS_ORIGINS))
}

/**
 * @param {string | undefined} origin
 * @param {Record<string, string | undefined>} [env]
 */
export function isOriginAllowed(origin, env = process.env) {
  if (!origin) return true

  const patterns = buildAllowedOriginPatterns(env)
  for (const pattern of patterns) {
    if (originMatchesPattern(origin, pattern)) return true
  }

  const isProd = String(env.NODE_ENV || '').toLowerCase() === 'production'
  const allowLocal =
    !isProd && String(env.CORS_ALLOW_LOCALHOST ?? 'true').trim().toLowerCase() !== 'false'
  if (allowLocal && isLocalDevOrigin(origin)) return true

  return false
}

/**
 * @param {Record<string, string | undefined>} [env]
 */
export function createCorsOptions(env = process.env) {
  return {
    credentials: true,
    origin(origin, callback) {
      if (isOriginAllowed(origin, env)) {
        callback(null, true)
        return
      }
      if (origin) {
        console.warn(`[cors] Origen rechazado: ${origin}`)
      }
      callback(null, false)
    },
  }
}

/** @param {Record<string, string | undefined>} [env] */
export function logCorsStartup(env = process.env) {
  const isProd = String(env.NODE_ENV || '').toLowerCase() === 'production'
  const patterns = parseCorsOrigins(env.CORS_ORIGINS)
  if (patterns.length > 0) {
    console.info(`[cors] Orígenes permitidos (${patterns.length}): ${patterns.join(', ')}`)
    return
  }
  if (isProd) {
    console.warn(
      '[cors] CORS_ORIGINS vacío en producción: el navegador en Netlify u otro host no podrá llamar al API hasta configurarlo.',
    )
    return
  }
  console.info('[cors] Desarrollo: localhost/127.0.0.1 permitidos; define CORS_ORIGINS para otros orígenes.')
}
