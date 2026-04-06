import { canAdmin, getSupabaseAuthMeta } from '../lib/supabaseAuth.js'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js'
import { http } from './http.js'

export const logsApi = {
  /** Tabla importaciones (como vista “operativa”). */
  importaciones: async () => {
    if (!isSupabaseConfigured) return http('/api/logs-sistema')
    const meta = await getSupabaseAuthMeta()
    if (!canAdmin(meta)) throw new Error('Sin permiso')
    const { data, error } = await supabase
      .from('importaciones')
      .select('id, created_at, estado, nombre_archivo, total_registros, registros_nuevos, registros_actualizados, registros_resueltos, observaciones, usuario_id, usuarios:usuario_id(username)')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(100)
    if (error) throw new Error(error.message || 'No se pudieron cargar logs de importaciones')
    return {
      ok: true,
      source: 'importaciones',
      items: (data || []).map((it) => ({ ...it, usuario_username: it.usuarios?.username || null })),
    }
  },
  /** Últimas líneas de api/logs/app.log (solo con API Node). */
  archivo: async (lines = 200) => {
    if (isSupabaseConfigured) {
      return {
        ok: true,
        message:
          'El archivo app.log solo existe en el servidor Node. Con despliegue solo Supabase usa las pestañas Auditoría e Importaciones.',
        path: null,
        lineCount: 0,
        lines: [],
      }
    }
    return http(`/api/logs-sistema/archivo?lines=${lines}`)
  },
}
