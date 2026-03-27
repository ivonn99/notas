import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js'
import { getSupabaseAuthMeta } from '../lib/supabaseAuth.js'
import { http } from './http.js'

export const profileApi = {
  getMe: async () => {
    if (!isSupabaseConfigured) return http('/api/profile/me')
    const meta = await getSupabaseAuthMeta()
    if (meta.usuarioId == null) {
      throw new Error('Falta user_metadata.usuarioId para cargar perfil')
    }
    const { data: rows, error } = await supabase
      .from('usuarios')
      .select('id, username, nombre_completo, email, rol, activo, is_active')
      .eq('id', meta.usuarioId)
      .limit(1)
    if (error) throw new Error(error.message || 'No se pudo cargar perfil')
    if (!rows?.[0]) throw new Error('Usuario no encontrado')
    const { data: rutas, error: rutasErr } = await supabase
      .from('usuario_rutas')
      .select('ruta_id, rutas:ruta_id(id, codigo, nombre)')
      .eq('usuario_id', meta.usuarioId)
    if (rutasErr) throw new Error(rutasErr.message || 'No se pudieron cargar rutas')
    return {
      ok: true,
      user: rows[0],
      rutas: (rutas || [])
        .map((r) => r.rutas)
        .filter(Boolean)
        .sort((a, b) => String(a.codigo || '').localeCompare(String(b.codigo || ''))),
    }
  },
  changePassword: async (currentPassword, newPassword) => {
    if (!isSupabaseConfigured) {
      return http('/api/profile/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
    }
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) throw new Error('Sesión inválida')
    const email = user.email
    if (!email) throw new Error('El usuario no tiene correo para validar contraseña actual')
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })
    if (signInErr) throw new Error('Contraseña actual incorrecta')
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
    if (updateErr) throw new Error(updateErr.message || 'No se pudo cambiar contraseña')
    return { ok: true }
  },
}
