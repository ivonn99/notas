import { clearDbJwtToken, isDbJwtLoginEnabled, setDbJwtToken } from '../lib/dbJwtSession.js'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js'
import { getSupabaseAuthMeta, loginIdentifierToSupabaseEmail } from '../lib/supabaseAuth.js'

/** Si la migración resolve_login_email está aplicada, usa el email real de usuarios (ej. mago@dmh.com). */
async function resolveLoginEmailFromDb(usernameRaw) {
  const s = String(usernameRaw ?? '').trim()
  if (!s || s.includes('@')) return null
  const { data, error } = await supabase.rpc('resolve_login_email', {
    p_username: s,
  })
  if (error || data == null || String(data).trim() === '') return null
  return String(data).trim().toLowerCase()
}
import { apiUrl } from '../utils/apiUrl.js'

const jsonHeaders = { 'Content-Type': 'application/json' }

function parseBody(text) {
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { _raw: text.slice(0, 200) }
  }
}

function loginErrorMessage(status, data) {
  if (data.error) return data.error

  if (status === 404) {
    const hasApiOrigin = Boolean(
      typeof import.meta.env.VITE_API_URL === 'string' &&
        String(import.meta.env.VITE_API_URL).trim(),
    )
    if (!hasApiOrigin) {
      return (
        'No se encontró el API (404). En Netlify: en Site settings → Environment variables añade ' +
        'VITE_API_URL con la URL pública de tu servidor (ej. https://tu-api.onrender.com), sin barra final, ' +
        'luego vuelve a desplegar (Clear cache and deploy). En local: carpeta api → npm run dev.'
      )
    }
    return (
      'El login respondió 404. Revisa que VITE_API_URL apunte al host correcto del API y que exista ' +
      'POST /api/auth/login. Prueba en el navegador: GET {tu API}/api/auth/ping (debe devolver JSON).'
    )
  }

  // Vite proxy cuando el API no responde en 3001
  if (status === 502 || status === 503 || status === 504) {
    const hasApiOrigin = Boolean(
      typeof import.meta.env.VITE_API_URL === 'string' &&
        String(import.meta.env.VITE_API_URL).trim(),
    )
    if (!hasApiOrigin) {
      return `El front no puede hablar con el API (HTTP ${status}). En Netlify configura VITE_API_URL y redespliega. En local: api → npm run dev y abre http://127.0.0.1:3001/api/health.`
    }
    return `El API no respondió bien (HTTP ${status}). Comprueba que el servicio del API esté en línea y CORS permita tu dominio Netlify.`
  }

  if (data._raw) {
    return `HTTP ${status}: ${data._raw}`
  }

  return `Error HTTP ${status} al iniciar sesión`
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
  if (isSupabaseConfigured && isDbJwtLoginEnabled()) {
    const url = dbLoginJwtUrl()
    const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
    if (!url || !anon) {
      throw new Error('Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY para login por base de datos')
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

  if (isSupabaseConfigured) {
    const fallback = loginIdentifierToSupabaseEmail(username)
    const resolved = await resolveLoginEmailFromDb(username)
    const email = resolved || fallback
    if (!email) {
      throw new Error('Indica usuario o correo')
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      const raw = String(error.message || '').toLowerCase()
      const invalid =
        raw.includes('invalid login') ||
        raw.includes('invalid_credentials') ||
        raw.includes('invalid grant')
      if (invalid) {
        throw new Error(
          'Usuario o contraseña incorrectos, o el usuario no está en Supabase Auth. ' +
            `(Email usado: ${email}). Sincroniza: api → npm run sync:supabase-auth -- "TuContraseña". ` +
            'O entra con el correo completo si no es …@local.test.',
        )
      }
      throw new Error(error.message || 'No se pudo iniciar sesión en Supabase')
    }
    const user = data?.user || null
    if (!user) return null
    return {
      id: user.id,
      usuarioId:
        user.user_metadata?.usuarioId ??
        user.user_metadata?.usuario_id ??
        user.user_metadata?.dbUserId ??
        null,
      username: user.user_metadata?.username || user.email || email,
      rol: user.user_metadata?.rol || 'VENDEDOR',
      nombreCompleto: user.user_metadata?.nombreCompleto || null,
      isSuperuser: Boolean(user.user_metadata?.isSuperuser),
      isStaff: Boolean(user.user_metadata?.isStaff),
      email: user.email || null,
    }
  }

  const res = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  })
  const text = await res.text()
  const data = parseBody(text)
  if (!res.ok) {
    throw new Error(loginErrorMessage(res.status, data))
  }
  return data.user
}

export async function authLogout() {
  if (isSupabaseConfigured && isDbJwtLoginEnabled()) {
    clearDbJwtToken()
    await supabase.auth.signOut().catch(() => {})
    return
  }
  if (isSupabaseConfigured) {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message || 'No se pudo cerrar sesión')
    return
  }
  await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' })
}

export async function authMe() {
  if (isSupabaseConfigured) {
    try {
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

  const res = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return null
  return data.user
}
