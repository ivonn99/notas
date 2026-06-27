import { canAdmin, getSupabaseAuthMeta } from '../lib/supabaseAuth.js'
import { supabase } from '../lib/supabaseClient.js'
import { http } from './http.js'

export const logsApi = {
  /** Tabla importaciones (vista operativa en pantalla Logs). */
  importaciones: async () => {
    const meta = await getSupabaseAuthMeta()
    if (!canAdmin(meta)) throw new Error('Sin permiso')
    const { data, error } = await supabase
      .from('importaciones')
      .select(
        'id, created_at, estado, nombre_archivo, total_registros, registros_nuevos, registros_actualizados, registros_resueltos, observaciones, usuario_id, usuarios:usuario_id(username)',
      )
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
  /** Últimas líneas de api/logs/app.log (requiere API Node en VITE_API_URL). */
  archivo: async (lines = 200) => {
    try {
      return await http(`/api/logs-sistema/archivo?lines=${lines}`)
    } catch {
      return {
        ok: true,
        message:
          'El archivo app.log solo existe en el servidor Node. Configura VITE_API_URL o usa las pestañas Auditoría e Importaciones.',
        path: null,
        lineCount: 0,
        lines: [],
      }
    }
  },
}
