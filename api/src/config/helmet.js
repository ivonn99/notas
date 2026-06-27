import helmet from 'helmet'

/** @param {Record<string, string | undefined>} [env] */
export function isHelmetDisabled(env = process.env) {
  const v = String(env.HELMET_DISABLED ?? '').trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

/**
 * Cabeceras HTTP de seguridad. Ajustado para API consumida desde otro origen (Netlify + CORS).
 * @param {Record<string, string | undefined>} [env]
 */
export function createHelmetMiddleware(env = process.env) {
  if (isHelmetDisabled(env)) {
    return (_req, _res, next) => next()
  }

  const isProd = String(env.NODE_ENV || '').toLowerCase() === 'production'

  return helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    hsts: isProd
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
      : false,
  })
}

/** @param {Record<string, string | undefined>} [env] */
export function logHelmetStartup(env = process.env) {
  if (isHelmetDisabled(env)) {
    console.warn('[helmet] HELMET_DISABLED=true — cabeceras de seguridad desactivadas')
    return
  }
  console.info('[helmet] Cabeceras de seguridad HTTP activas (compatible con CORS cross-origin)')
}
