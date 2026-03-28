import { getSupabaseAuthMeta } from '../lib/supabaseAuth.js'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js'
import { apiUrl } from '../utils/apiUrl.js'

function toQuery(params) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v == null) return
    const s = String(v).trim()
    if (!s) return
    q.set(k, s)
  })
  return q.toString()
}

export async function fetchNotasCredito(params = {}) {
  if (isSupabaseConfigured) {
    return fetchNotasCreditoSupabase(params)
  }

  const query = toQuery(params)
  const url = query ? `/api/notas-credito?${query}` : '/api/notas-credito'

  const res = await fetch(apiUrl(url), { credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `Error HTTP ${res.status} al cargar notas`)
  }
  return data
}

function normalizeSort(sort) {
  const s = String(sort || '').trim()
  return (
    s &&
    [
      'fecha_corriente_desc',
      'fecha_corriente_asc',
      'saldo_desc',
      'saldo_asc',
      'estado_asc',
      'atencion_desc',
    ].includes(s)
      ? s
      : 'fecha_corriente_desc'
  )
}

async function fetchNotasCreditoSupabase(params = {}) {
  const page = Math.max(1, Number.parseInt(String(params.page ?? 1), 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(params.pageSize ?? 20), 10) || 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const estado = String(params.estado ?? '').trim().toUpperCase()
  const empresa = String(params.empresa ?? '').trim().toUpperCase()
  const ruta = String(params.ruta ?? '').trim().toUpperCase()
  const q = String(params.q ?? '').trim()
  const dias = Number.parseInt(String(params.dias ?? ''), 10)
  const hasDias = Number.isFinite(dias) && dias > 0 && dias <= 3650
  const sort = normalizeSort(params.sort)

  const sessionMeta = await getSupabaseAuthMeta()
  const rol = sessionMeta.rol
  const isSuperuser = sessionMeta.isSuperuser
  const usuarioId = sessionMeta.usuarioId

  let query = supabase
    .from('notas_credito')
    .select(
      `
      id, serie_folio, fecha_nota, cliente, empresa, monto, abono, saldo, estado,
      requiere_atencion, resuelta_automaticamente, fecha_corriente, fecha_ultima_actualizacion,
      usuario_vendedor_pv, usuario_id, ruta_id,
      rutas:ruta_id(codigo, nombre),
      vendedor:usuario_id(username)
    `,
      { count: 'exact' },
    )
    .range(from, to)

  if (estado) query = query.eq('estado', estado)
  if (empresa) query = query.eq('empresa', empresa)
  if (q) query = query.or(`serie_folio.ilike.%${q}%,cliente.ilike.%${q}%,usuario_vendedor_pv.ilike.%${q}%`)
  if (hasDias) {
    const now = Date.now()
    const daysMs = dias * 24 * 60 * 60 * 1000
    const sinceIso = new Date(now - daysMs).toISOString()
    query = query.gte('fecha_corriente', sinceIso)
  }
  if (rol === 'VENDEDOR' && !isSuperuser) {
    if (usuarioId == null) {
      throw new Error(
        'Falta user_metadata.usuarioId para filtrar rutas de vendedor en Supabase. Configura ese metadato o usa el backend.',
      )
    }
    const { data: rutasRows, error: rutasErr } = await supabase
      .from('usuario_rutas')
      .select('ruta_id')
      .eq('usuario_id', usuarioId)
    if (rutasErr) throw new Error(rutasErr.message || 'No se pudo cargar rutas del vendedor')
    const rutaIds = (rutasRows || []).map((r) => r.ruta_id).filter((v) => v != null)
    if (rutaIds.length === 0) {
      return {
        ok: true,
        page,
        pageSize,
        total: 0,
        totalPages: 1,
        filters: {
          estado: estado || null,
          empresa: empresa || null,
          ruta: ruta || null,
          q: q || null,
          dias: hasDias ? dias : null,
          sort,
        },
        items: [],
      }
    }
    query = query.in('ruta_id', rutaIds)
  }

  if (ruta) {
    const { data: rutasByCode, error: rutaCodeErr } = await supabase
      .from('rutas')
      .select('id')
      .ilike('codigo', ruta)
    if (rutaCodeErr) throw new Error(rutaCodeErr.message || 'No se pudo filtrar por ruta')
    const rutaIds = (rutasByCode || []).map((r) => r.id)
    if (rutaIds.length === 0) {
      return {
        ok: true,
        page,
        pageSize,
        total: 0,
        totalPages: 1,
        filters: {
          estado: estado || null,
          empresa: empresa || null,
          ruta: ruta || null,
          q: q || null,
          dias: hasDias ? dias : null,
          sort,
        },
        items: [],
      }
    }
    query = query.in('ruta_id', rutaIds)
  }

  if (sort === 'fecha_corriente_desc') query = query.order('fecha_corriente', { ascending: false, nullsFirst: false })
  if (sort === 'fecha_corriente_asc') query = query.order('fecha_corriente', { ascending: true, nullsFirst: false })
  if (sort === 'saldo_desc') query = query.order('saldo', { ascending: false, nullsFirst: false })
  if (sort === 'saldo_asc') query = query.order('saldo', { ascending: true, nullsFirst: false })
  if (sort === 'estado_asc') query = query.order('estado', { ascending: true, nullsFirst: false })
  if (sort === 'atencion_desc') {
    query = query
      .order('requiere_atencion', { ascending: false, nullsFirst: false })
      .order('fecha_ultima_actualizacion', { ascending: false, nullsFirst: false })
  }
  query = query.order('id', { ascending: false, nullsFirst: false })

  const { data, count, error } = await query
  if (error) {
    throw new Error(error.message || 'Error al cargar notas desde Supabase')
  }

  const items = (data || []).map((row) => ({
    ...row,
    ruta_codigo: row.rutas?.codigo || null,
    ruta_nombre: row.rutas?.nombre || null,
    vendedor_username: row.vendedor?.username || null,
  }))

  const total = count || 0
  return {
    ok: true,
    page,
    pageSize,
    total,
    totalPages: total > 0 ? Math.ceil(total / pageSize) : 1,
    filters: {
      estado: estado || null,
      empresa: empresa || null,
      ruta: ruta || null,
      q: q || null,
      dias: hasDias ? dias : null,
      sort,
    },
    items,
  }
}
