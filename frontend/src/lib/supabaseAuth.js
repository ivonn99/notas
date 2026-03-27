import { supabase } from './supabaseClient.js'

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
