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

export async function getSupabaseAuthMeta() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Sesión inválida en Supabase')
  }
  const meta = user.user_metadata || {}
  return {
    user,
    rol: String(meta.rol || 'VENDEDOR').toUpperCase(),
    isSuperuser: Boolean(meta.isSuperuser),
    usuarioId: meta.usuarioId ?? meta.usuario_id ?? meta.dbUserId ?? null,
  }
}

export function canAdmin(meta) {
  return Boolean(meta?.isSuperuser || meta?.rol === 'ADMIN')
}

export function canCredito(meta) {
  return Boolean(meta?.isSuperuser || meta?.rol === 'ADMIN' || meta?.rol === 'CREDITO')
}
