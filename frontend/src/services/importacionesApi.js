import { apiUrl } from '../utils/apiUrl.js'
import { getApiAuthorizationHeader } from '../utils/apiAuthHeaders.js'
import { canAdmin, getSupabaseAuthMeta } from '../lib/supabaseAuth.js'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js'
import { http } from './http.js'

export const importacionesApi = {
  list: async () => {
    if (!isSupabaseConfigured) return http('/api/importaciones')
    const meta = await getSupabaseAuthMeta()
    if (!canAdmin(meta)) throw new Error('Sin permiso')
    const { data, error } = await supabase
      .from('importaciones')
      .select('id, nombre_archivo, total_registros, registros_nuevos, registros_actualizados, registros_resueltos, estado, observaciones, created_at, usuario_id, usuarios:usuario_id(username,nombre_completo)')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(200)
    if (error) throw new Error(error.message || 'No se pudieron cargar importaciones')
    const parseEmpresas = (text) => {
      const raw = String(text ?? '')
      const m = raw.match(/empresas\s*=\s*([A-Z_|,-]+)/i)
      if (!m) return []
      return String(m[1]).split(/[|,]/).map((v) => String(v || '').trim().toUpperCase()).filter(Boolean)
    }
    return {
      ok: true,
      items: (data || []).map((it) => ({
        ...it,
        usuario_username: it.usuarios?.username || null,
        usuario_nombre: it.usuarios?.nombre_completo || null,
        empresas_importadas: parseEmpresas(it.observaciones),
      })),
    }
  },
  logs: () => logsFallback(),
  progreso: async (id) => {
    if (!isSupabaseConfigured) return http(`/api/importaciones/${id}/progreso`)
    const meta = await getSupabaseAuthMeta()
    if (!canAdmin(meta)) throw new Error('Sin permiso')
    const impId = Number.parseInt(String(id), 10)
    const { data, error } = await supabase
      .from('importaciones')
      .select('id, estado, total_registros, registros_nuevos, registros_actualizados, registros_resueltos, observaciones, created_at')
      .eq('id', impId)
      .limit(1)
    if (error) throw new Error(error.message || 'No se pudo cargar progreso')
    if (!data?.[0]) throw new Error('Importación no encontrada')
    const imp = data[0]
    const raw = String(imp.observaciones ?? '')
    const m = raw.match(/Procesando\s+(\d+)\s*\/\s*(\d+)/i)
    const done = ['COMPLETADA', 'PARCIAL', 'FALLIDA'].includes(String(imp.estado ?? '').toUpperCase())
    const parsed = m
      ? {
          processed: Number.parseInt(m[1], 10),
          total: Number.parseInt(m[2], 10),
        }
      : null
    const pct = parsed?.total
      ? Math.max(0, Math.min(100, Math.round((parsed.processed / parsed.total) * 100)))
      : done
        ? 100
        : 0
    return {
      ok: true,
      inMemory: false,
      progress: {
        id: imp.id,
        status: imp.estado,
        total: parsed?.total ?? imp.total_registros ?? 0,
        processed: parsed?.processed ?? (imp.registros_nuevos || 0) + (imp.registros_actualizados || 0),
        errorCount: 0,
        pct,
        done,
      },
      importacion: imp,
    }
  },
  preview: async (file, mapping = null) => {
    const fd = new FormData()
    fd.append('file', file)
    if (mapping) fd.append('mapping', JSON.stringify(mapping))
    const res = await fetch(apiUrl('/api/importaciones/preview'), {
      method: 'POST',
      credentials: 'include',
      headers: { ...(getApiAuthorizationHeader() || {}) },
      body: fd,
    })
    const text = await res.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = {}
    }
    if (!res.ok) throw new Error(data.error || `Error HTTP ${res.status}`)
    return data
  },
  downloadErroresTxt: async (id) => {
    const res = await fetch(apiUrl(`/api/importaciones/${id}/errores-txt`), {
      credentials: 'include',
      headers: { ...(getApiAuthorizationHeader() || {}) },
    })
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`)
    return res.text()
  },
  downloadMuestra: async () => {
    const res = await fetch(apiUrl('/api/importaciones/muestra'), {
      credentials: 'include',
      headers: { ...(getApiAuthorizationHeader() || {}) },
    })
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`)
    return res.text()
  },
  uploadCsv: async (file, mapping = null) => {
    const fd = new FormData()
    fd.append('file', file)
    if (mapping) fd.append('mapping', JSON.stringify(mapping))
    const res = await fetch(apiUrl('/api/importaciones/upload'), {
      method: 'POST',
      credentials: 'include',
      headers: { ...(getApiAuthorizationHeader() || {}) },
      body: fd,
    })
    const text = await res.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = {}
    }
    if (!res.ok) throw new Error(data.error || `Error HTTP ${res.status}`)
    return data
  },
}

function logsFallback() {
  return http('/api/logs-sistema')
}
