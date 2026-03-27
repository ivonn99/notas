import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js'
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

export async function authLogin(username, password) {
  if (isSupabaseConfigured) {
    const email = String(username || '').trim()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
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
  if (isSupabaseConfigured) {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message || 'No se pudo cerrar sesión')
    return
  }
  await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' })
}

export async function authMe() {
  if (isSupabaseConfigured) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error || !user) return null
    return {
      id: user.id,
      usuarioId:
        user.user_metadata?.usuarioId ??
        user.user_metadata?.usuario_id ??
        user.user_metadata?.dbUserId ??
        null,
      username: user.user_metadata?.username || user.email || 'usuario',
      rol: user.user_metadata?.rol || 'VENDEDOR',
      nombreCompleto: user.user_metadata?.nombreCompleto || null,
      isSuperuser: Boolean(user.user_metadata?.isSuperuser),
      isStaff: Boolean(user.user_metadata?.isStaff),
      email: user.email || null,
    }
  }

  const res = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return null
  return data.user
}
