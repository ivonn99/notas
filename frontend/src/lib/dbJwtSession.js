const STORAGE_KEY = 'notas_db_jwt_access_token'

/** Acepta true / 1 / yes (Vercel u otros paneles a veces guardan mayúsculas o sin comillas). */
export function isDbJwtLoginEnabled() {
  const v = String(import.meta.env.VITE_SUPABASE_DB_LOGIN ?? '')
    .trim()
    .toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

export function getDbJwtToken() {
  try {
    return String(localStorage.getItem(STORAGE_KEY) || '').trim() || null
  } catch {
    return null
  }
}

export function setDbJwtToken(token) {
  const t = String(token ?? '').trim()
  if (!t) return
  try {
    localStorage.setItem(STORAGE_KEY, t)
  } catch {
    /* ignore */
  }
}

export function clearDbJwtToken() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** Solo decodifica payload (sin verificar firma). La API de Supabase valida el JWT. */
export function decodeDbJwtPayloadUnsafe(token) {
  try {
    const parts = String(token || '').split('.')
    if (parts.length < 2) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const json = atob(b64 + pad)
    return JSON.parse(json)
  } catch {
    return null
  }
}
