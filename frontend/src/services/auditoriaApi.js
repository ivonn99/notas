import { canAdmin, getSupabaseAuthMeta } from '../lib/supabaseAuth.js'
import { supabase } from '../lib/supabaseClient.js'

export const auditoriaApi = {
  list: async (params = {}) => {
    const meta = await getSupabaseAuthMeta()
    if (!canAdmin(meta)) throw new Error('Sin permiso')
    let query = supabase
      .from('auditoria_eventos')
      .select(
        'id, created_at, usuario_id, username, accion, entidad, entidad_id, detalle, ip, user_agent, request_id',
      )
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(500)
    const accion = String(params.accion ?? '').trim()
    if (accion) query = query.eq('accion', accion)
    const usuario = String(params.usuario ?? '').trim()
    if (usuario) query = query.ilike('username', `%${usuario}%`)
    const q = String(params.q ?? '').trim()
    if (q) query = query.or(`entidad.ilike.%${q}%,entidad_id.ilike.%${q}%`)
    const desde = String(params.desde ?? '').trim()
    if (desde) query = query.gte('created_at', desde)
    const hasta = String(params.hasta ?? '').trim()
    if (hasta) query = query.lte('created_at', hasta)
    const { data, error } = await query
    if (error) throw new Error(error.message || 'No se pudo cargar auditoría')
    let items = data || []
    if (q) {
      const needle = q.toLowerCase()
      items = items.filter(
        (it) =>
          JSON.stringify(it.detalle || {}).toLowerCase().includes(needle) ||
          String(it.entidad || '').toLowerCase().includes(needle) ||
          String(it.entidad_id || '').toLowerCase().includes(needle),
      )
    }
    return { ok: true, items }
  },
}
