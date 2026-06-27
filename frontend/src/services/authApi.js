import { clearDbJwtToken, isDbJwtLoginEnabled, setDbJwtToken } from '../lib/dbJwtSession.js'
import { assertSupabaseConfigured, getSupabase } from '../lib/supabaseClient.js'
import { getSupabaseAuthMeta } from '../lib/supabaseAuth.js'

function parseBody(text) {
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { _raw: text.slice(0, 200) }
  }
}

function dbLoginJwtUrl() {
  const explicit = String(import.meta.env.VITE_SUPABASE_DB_LOGIN_ENDPOINT || '').trim()
  if (explicit) return explicit
  const base = String(import.meta.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '')
  return base ? `${base}/functions/v1/db-login-jwt` : ''
}

export async function authLogin(username, password) {
  assertSupabaseConfigured()
  if (!isDbJwtLoginEnabled()) {
    throw new Error(
      'Define VITE_SUPABASE_DB_LOGIN=true y despliega la Edge Function db-login-jwt.',
    )
  }

  const url = dbLoginJwtUrl()
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  if (!url || !anon) {
    throw new Error('Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY para login')
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({
      username: String(username ?? '').trim(),
      password: String(password ?? ''),
    }),
  })
  const text = await res.text()
  const data = parseBody(text)
  if (!res.ok) {
    const msg =
      data.error ||
      data.message ||
      data.msg ||
      (data._raw ? `HTTP ${res.status}: ${data._raw}` : null) ||
      `Error HTTP ${res.status} al iniciar sesión`
    throw new Error(msg)
  }
  if (!data.access_token) throw new Error('Respuesta de login inválida')
  setDbJwtToken(data.access_token)
  const u = data.user
  if (!u) return null
  return {
    id: u.id,
    usuarioId: u.usuarioId ?? u.id,
    username: u.username,
    rol: u.rol || 'VENDEDOR',
    nombreCompleto: u.nombreCompleto ?? null,
    isSuperuser: Boolean(u.isSuperuser),
    isStaff: Boolean(u.isStaff),
    email: u.email ?? null,
  }
}

export async function authLogout() {
  clearDbJwtToken()
  const sb = getSupabase()
  await sb.auth.signOut().catch(() => {})
}

export async function authMe() {
  try {
    assertSupabaseConfigured()
    const m = await getSupabaseAuthMeta()
    return {
      id: m.user.id,
      usuarioId: m.usuarioId,
      username: m.username,
      rol: m.rol,
      nombreCompleto: m.nombreCompleto,
      isSuperuser: m.isSuperuser,
      isStaff: Boolean(m.user.user_metadata?.isStaff),
      email: m.user.email || null,
    }
  } catch {
    return null
  }
}
