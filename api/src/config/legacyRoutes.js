/** Rutas Express legacy (bypass RLS). Desactivadas por defecto; el front usa Supabase. */

/** @param {Record<string, string | undefined>} [env] */
export function isLegacyApiEnabled(env = process.env) {
  const v = String(env.API_LEGACY_ROUTES ?? '').trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

/** @param {Record<string, string | undefined>} [env] */
export function isDbPingEnabled(env = process.env) {
  if (isLegacyApiEnabled(env)) return true
  const v = String(env.DB_PING_ENABLED ?? '').trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

/** @param {Record<string, string | undefined>} [env] */
export function logApiModeStartup(env = process.env) {
  if (isLegacyApiEnabled(env)) {
    console.warn(
      '[api] API_LEGACY_ROUTES=true — rutas legacy activas (Postgres directo, sin RLS). Solo para migración.',
    )
    return
  }
  console.info('[api] Modo complementario: WhatsApp, logs-sistema, health (sin rutas legacy)')
}
