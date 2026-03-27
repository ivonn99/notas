import { canCredito, getSupabaseAuthMeta } from '../lib/supabaseAuth.js'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js'
import { http } from './http.js'

export const alertasApi = {
  list: async () => {
    if (!isSupabaseConfigured) return http('/api/alertas')
    const meta = await getSupabaseAuthMeta()
    if (!canCredito(meta)) throw new Error('Sin permiso')
    const { data, error } = await supabase
      .from('alertas')
      .select('id, tipo, descripcion, leida, created_at, nota_id, notas_credito:nota_id(serie_folio,cliente,estado)')
      .order('leida', { ascending: true })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(500)
    if (error) throw new Error(error.message || 'No se pudieron cargar alertas')
    return {
      ok: true,
      items: (data || []).map((a) => ({
        ...a,
        serie_folio: a.notas_credito?.serie_folio || null,
        cliente: a.notas_credito?.cliente || null,
        estado: a.notas_credito?.estado || null,
      })),
    }
  },
  marcarLeida: async (id) => {
    if (!isSupabaseConfigured) {
      return http(`/api/alertas/${id}/leer`, { method: 'POST' })
    }
    const meta = await getSupabaseAuthMeta()
    if (!canCredito(meta)) throw new Error('Sin permiso')
    const alertId = Number.parseInt(String(id), 10)
    if (!Number.isFinite(alertId) || alertId <= 0) throw new Error('ID inválido')
    const { data, error } = await supabase
      .from('alertas')
      .update({ leida: true })
      .eq('id', alertId)
      .select('id, leida')
      .limit(1)
    if (error) throw new Error(error.message || 'No se pudo marcar alerta')
    if (!data?.[0]) throw new Error('Alerta no encontrada')
    return { ok: true, item: data[0] }
  },
}
