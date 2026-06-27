import { canCredito, getSupabaseAuthMeta } from '../lib/supabaseAuth.js'
import { supabase } from '../lib/supabaseClient.js'

export const notificacionesApi = {
  list: async () => {
    const meta = await getSupabaseAuthMeta()
    const items = []
    let allowedNoteIds = null
    if (!meta.isSuperuser && meta.rol === 'VENDEDOR') {
      if (meta.usuarioId == null) throw new Error('Falta user_metadata.usuarioId')
      const { data: ur, error: urErr } = await supabase
        .from('usuario_rutas')
        .select('ruta_id')
        .eq('usuario_id', meta.usuarioId)
      if (urErr) throw new Error(urErr.message || 'No se pudieron cargar rutas')
      const rutaIds = (ur || []).map((r) => r.ruta_id).filter((v) => v != null)
      if (rutaIds.length === 0) {
        return { ok: true, items: [] }
      }
      const { data: notas, error: notasErr } = await supabase
        .from('notas_credito')
        .select('id')
        .in('ruta_id', rutaIds)
      if (notasErr) throw new Error(notasErr.message || 'No se pudieron cargar notas del vendedor')
      allowedNoteIds = new Set((notas || []).map((n) => n.id))
    }
    const { data: aclaraciones, error: aErr } = await supabase
      .from('aclaraciones')
      .select('id, created_at, comentario, nota_id, notas_credito:nota_id(serie_folio)')
      .eq('leida', false)
      .order('created_at', { ascending: false })
      .limit(100)
    if (aErr) throw new Error(aErr.message || 'No se pudieron cargar aclaraciones')
    for (const a of aclaraciones || []) {
      if (allowedNoteIds && !allowedNoteIds.has(a.nota_id)) continue
      items.push({
        tipo: 'ACLARACION',
        id: a.id,
        created_at: a.created_at,
        titulo: a.comentario,
        nota_id: a.nota_id,
        serie_folio: a.notas_credito?.serie_folio || null,
      })
    }
    if (canCredito(meta)) {
      const { data: alertas, error: alErr } = await supabase
        .from('alertas')
        .select('id, created_at, descripcion, tipo, nota_id, notas_credito:nota_id(serie_folio)')
        .eq('leida', false)
        .order('created_at', { ascending: false })
        .limit(100)
      if (alErr) throw new Error(alErr.message || 'No se pudieron cargar alertas')
      for (const a of alertas || []) {
        items.push({
          tipo: 'ALERTA',
          id: a.id,
          created_at: a.created_at,
          titulo: a.descripcion || a.tipo,
          nota_id: a.nota_id,
          serie_folio: a.notas_credito?.serie_folio || null,
        })
      }
    }
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return { ok: true, items: items.slice(0, 150) }
  },
  resumen: async () => {
    const data = await notificacionesApi.list()
    const aclaraciones = data.items.filter((x) => x.tipo === 'ACLARACION').length
    const alertas = data.items.filter((x) => x.tipo === 'ALERTA').length
    return { ok: true, counts: { aclaraciones, alertas, total: aclaraciones + alertas } }
  },
  marcarTodas: async () => {
    const data = await notificacionesApi.list()
    let updated = 0
    const aclarIds = data.items.filter((x) => x.tipo === 'ACLARACION').map((x) => x.id)
    if (aclarIds.length > 0) {
      const { error } = await supabase.from('aclaraciones').update({ leida: true }).in('id', aclarIds)
      if (error) throw new Error(error.message || 'No se pudieron marcar aclaraciones')
      updated += aclarIds.length
    }
    const alertIds = data.items.filter((x) => x.tipo === 'ALERTA').map((x) => x.id)
    if (alertIds.length > 0) {
      const { error } = await supabase.from('alertas').update({ leida: true }).in('id', alertIds)
      if (error) throw new Error(error.message || 'No se pudieron marcar alertas')
      updated += alertIds.length
    }
    return { ok: true, updated }
  },
  marcarLeida: async (kind, id) => {
    const k = String(kind || '').toUpperCase()
    const targetId = Number.parseInt(String(id), 10)
    if (!Number.isFinite(targetId) || targetId <= 0) throw new Error('ID inválido')
    if (k === 'ALERTA') {
      const meta = await getSupabaseAuthMeta()
      if (!canCredito(meta)) throw new Error('Sin permiso')
      const { data, error } = await supabase.from('alertas').update({ leida: true }).eq('id', targetId).select('id').limit(1)
      if (error) throw new Error(error.message || 'No se pudo marcar alerta')
      if (!data?.[0]) throw new Error('Alerta no encontrada')
      return { ok: true }
    }
    if (k === 'ACLARACION') {
      const list = await notificacionesApi.list()
      const exists = list.items.some((x) => x.tipo === 'ACLARACION' && Number(x.id) === targetId)
      if (!exists) throw new Error('Aclaración no encontrada')
      const { error } = await supabase.from('aclaraciones').update({ leida: true }).eq('id', targetId)
      if (error) throw new Error(error.message || 'No se pudo marcar aclaración')
      return { ok: true }
    }
    throw new Error('Tipo inválido')
  },
}
