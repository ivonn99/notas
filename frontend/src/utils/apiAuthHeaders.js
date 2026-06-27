import { getDbJwtToken, isDbJwtLoginEnabled } from '../lib/dbJwtSession.js'

/** Cabecera Authorization para rutas del API Node (WhatsApp, app.log) con sesión db-login-jwt. */
export function getApiAuthorizationHeader() {
  if (!isDbJwtLoginEnabled()) return null
  const t = getDbJwtToken()
  return t ? { Authorization: `Bearer ${t}` } : null
}
