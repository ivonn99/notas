import { decodeDbJwtPayloadUnsafe, getDbJwtToken, isDbJwtLoginEnabled } from './dbJwtSession.js'
import { supabase } from './supabaseClient.js'

/**
 * Mismo criterio que el seed/sync: si no hay @, se usa `<slug>@local.test`.
 * Supabase Auth solo acepta email en signInWithPassword.
 */
export function loginIdentifierToSupabaseEmail(input) {
  const raw = String(input ?? '').trim()
  if (!raw) return ''
  if (raw.includes('@')) return raw.toLowerCase()
  const user = raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `${user || 'usuario'}@local.test`
}

/**
 * Lee rol / superusuario (y nombre) desde `usuarios` para alinear con la BD tras cambios de admin.
 */
export async function fetchUsuariosFieldsForSession(usuarioId) {
  if (!supabase || usuarioId == null) return null
  const uid = Number.parseInt(String(usuarioId), 10)
  if (!Number.isFinite(uid) || uid <= 0) return null
  const { data: row, error } = await supabase
    .from('usuarios')
    .select('rol, is_superuser, username, nombre_completo')
    .eq('id', uid)
    .maybeSingle()
  if (error || !row) return null
  return {
    rol: String(row.rol || 'VENDEDOR').trim().toUpperCase(),
    isSuperuser: Boolean(row.is_superuser),
    username: row.username != null ? String(row.username).trim() : null,
    nombreCompleto: row.nombre_completo != null ? String(row.nombre_completo).trim() : null,
  }
}

export async function getSupabaseAuthMeta() {
  if (isDbJwtLoginEnabled() && supabase) {
    const token = getDbJwtToken()
    if (!token) throw new Error('Sesión inválida en Supabase')
    const payload = decodeDbJwtPayloadUnsafe(token)
    if (!payload) throw new Error('Sesión inválida en Supabase')
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp != null && Number(payload.exp) < now) {
      throw new Error('Sesión expirada')
    }
    const meta = payload.user_metadata || {}
    const usuarioId = meta.usuarioId ?? meta.usuario_id ?? meta.dbUserId ?? null
    let rol = String(meta.rol || 'VENDEDOR').toUpperCase()
    let isSuperuser = Boolean(meta.isSuperuser)
    let username = meta.username || payload.email || 'usuario'
    let nombreCompleto = meta.nombreCompleto != null ? String(meta.nombreCompleto) : null

    const fromDb = await fetchUsuariosFieldsForSession(usuarioId)
    if (fromDb) {
      rol = fromDb.rol
      isSuperuser = fromDb.isSuperuser
      if (fromDb.username) username = fromDb.username
      if (fromDb.nombreCompleto != null) nombreCompleto = fromDb.nombreCompleto
    }

    const user = {
      id: payload.sub,
      email: payload.email ?? null,
      user_metadata: { ...meta },
    }
    return {
      user,
      rol,
      isSuperuser,
      usuarioId,
      username,
      nombreCompleto,
    }
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Sesión inválida en Supabase')
  }
  const meta = user.user_metadata || {}
  const usuarioId = meta.usuarioId ?? meta.usuario_id ?? meta.dbUserId ?? null
  let rol = String(meta.rol || 'VENDEDOR').toUpperCase()
  let isSuperuser = Boolean(meta.isSuperuser)
  let username = meta.username || user.email || 'usuario'
  let nombreCompleto = meta.nombreCompleto != null ? String(meta.nombreCompleto) : null

  const fromDb = await fetchUsuariosFieldsForSession(usuarioId)
  if (fromDb) {
    rol = fromDb.rol
    isSuperuser = fromDb.isSuperuser
    if (fromDb.username) username = fromDb.username
    if (fromDb.nombreCompleto != null) nombreCompleto = fromDb.nombreCompleto
  }

  return {
    user,
    rol,
    isSuperuser,
    usuarioId,
    username,
    nombreCompleto,
  }
}

export function canAdmin(meta) {
  return Boolean(
    meta?.isSuperuser || meta?.rol === 'ADMIN' || meta?.rol === 'CREDITO',
  )
}

export function canCredito(meta) {
  return Boolean(meta?.isSuperuser || meta?.rol === 'ADMIN' || meta?.rol === 'CREDITO')
}
