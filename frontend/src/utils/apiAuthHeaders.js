import { getDbJwtToken, isDbJwtLoginEnabled } from '../lib/dbJwtSession.js'
import { isSupabaseConfigured } from '../lib/supabaseClient.js'

/** Cabeceras para el API Node cuando la sesión es JWT en localStorage (db-login-jwt), no cookie. */
export function getApiAuthorizationHeader() {
  if (!isSupabaseConfigured || !isDbJwtLoginEnabled()) return null
  const t = getDbJwtToken()
  return t ? { Authorization: `Bearer ${t}` } : null
}
