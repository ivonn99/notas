import { getSupabaseAuthMeta } from '../lib/supabaseAuth.js'
import { supabase } from '../lib/supabaseClient.js'
import {
  buildDiasBucketsSupabaseOr,
  formatDiasBucketsList,
  parseDiasBucketsList,
} from '../utils/diasBuckets.js'
import { buildNotasSearchOrClause } from '../utils/notasSearchFilter.js'

export async function fetchNotasCredito(params = {}) {
  return fetchNotasCreditoSupabase(params)
}

function normalizeSort(sort) {
  const raw = String(sort || '').trim()
  const s =
    raw === 'fecha_corriente_desc'
      ? 'fecha_nota_desc'
      : raw === 'fecha_corriente_asc'
        ? 'fecha_nota_asc'
        : raw
  return (
    s &&
    [
      'fecha_nota_desc',
      'fecha_nota_asc',
      'saldo_desc',
      'saldo_asc',
      'estado_asc',
      'atencion_desc',
    ].includes(s)
      ? s
      : 'fecha_nota_desc'
  )
}

/** Aclaraiones aparte del listado (evita timeout por embed + count exact). Máx. 50 por nota. */
async function attachAclaracionesToNotas(notas) {
  const ids = (notas || []).map((n) => n.id).filter((id) => id != null)
  if (!ids.length) return notas || []
  const { data, error } = await supabase
    .from('aclaraciones')
    .select(
      'id, comentario, tipo, created_at, nota_id, usuarios:usuario_id(username, nombre_completo)',
    )
    .in('nota_id', ids)
    .order('created_at', { ascending: false })
  if (error) throw new Error(formatSupabaseError(error, 'No se pudieron cargar comentarios'))
  const byNota = new Map()
  for (const row of data || []) {
    const list = byNota.get(row.nota_id) || []
    if (list.length < 50) {
      list.push({
        id: row.id,
        comentario: row.comentario,
        tipo: row.tipo,
        created_at: row.created_at,
        usuarios: row.usuarios,
      })
    }
    byNota.set(row.nota_id, list)
  }
  return (notas || []).map((n) => {
    const aclaraciones = byNota.get(n.id) || []
    return {
      ...n,
      aclaraciones,
      tiene_comentarios: aclaraciones.length > 0,
    }
  })
}

function applyNotasListFilters(query, { estado, empresa, q, allowedRutaIds, diasBucketOr }) {
  let qy = query
  if (estado) qy = qy.eq('estado', estado)
  if (empresa) qy = qy.eq('empresa', empresa)
  if (Array.isArray(allowedRutaIds)) qy = qy.in('ruta_id', allowedRutaIds)

  const orGroups = []
  const searchOr = buildNotasSearchOrClause(q)
  if (searchOr) {
    orGroups.push(`or(${searchOr})`)
  }
  if (diasBucketOr) {
    orGroups.push(`or(${diasBucketOr})`)
  }

  if (orGroups.length > 1) {
    qy = qy.filter('and', `(${orGroups.join(',')})`)
  } else if (orGroups.length === 1) {
    const group = orGroups[0]
    qy = qy.or(group.startsWith('or(') ? group.slice(3, -1) : group)
  }

  return qy
}

function applyNotasSort(query, sort) {
  let qy = query
  if (sort === 'fecha_nota_desc') qy = qy.order('fecha_nota', { ascending: false, nullsFirst: false })
  if (sort === 'fecha_nota_asc') qy = qy.order('fecha_nota', { ascending: true, nullsFirst: false })
  if (sort === 'saldo_desc') qy = qy.order('saldo', { ascending: false, nullsFirst: false })
  if (sort === 'saldo_asc') qy = qy.order('saldo', { ascending: true, nullsFirst: false })
  if (sort === 'estado_asc') qy = qy.order('estado', { ascending: true, nullsFirst: false })
  if (sort === 'atencion_desc') {
    qy = qy
      .order('requiere_atencion', { ascending: false, nullsFirst: false })
      .order('fecha_ultima_actualizacion', { ascending: false, nullsFirst: false })
  }
  return qy.order('id', { ascending: false, nullsFirst: false })
}

function formatSupabaseError(error, fallback) {
  if (!error) return fallback
  const parts = [error.message, error.details, error.hint, error.code]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
  if (parts.length) return parts.join(' — ')
  if (error.status) return `${fallback} (HTTP ${error.status})`
  return fallback
}

function emptyResult({ page, pageSize, estado, empresa, ruta, q, diasBucket, sort }) {
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
      dias_bucket: diasBucket || null,
      sort,
    },
    items: [],
  }
}

/**
 * Count aparte. Preferimos estimated: exact+head en tablas grandes hace timeout
 * y a menudo devuelve error.message vacío (HTTP 500).
 */
async function countNotasFiltradas(filterArgs) {
  const estimated = await applyNotasListFilters(
    supabase.from('notas_credito').select('id', { count: 'estimated', head: true }),
    filterArgs,
  )
  if (!estimated.error && estimated.count != null) return { count: estimated.count, exact: false }

  const exact = await applyNotasListFilters(
    supabase.from('notas_credito').select('id', { count: 'exact', head: true }),
    filterArgs,
  )
  if (!exact.error && exact.count != null) return { count: exact.count, exact: true }

  return {
    count: null,
    exact: false,
    error: exact.error || estimated.error || null,
  }
}

async function fetchNotasCreditoSupabase(params = {}) {
  const page = Math.max(1, Number.parseInt(String(params.page ?? 1), 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(params.pageSize ?? 20), 10) || 20))
  const estado = String(params.estado ?? '').trim().toUpperCase()
  const empresa = String(params.empresa ?? '').trim().toUpperCase()
  const ruta = String(params.ruta ?? '').trim().toUpperCase()
  const q = String(params.q ?? '').trim()
  const diasBucketsList = parseDiasBucketsList(params.dias_bucket ?? params.diasBucket)
  const diasBucket = formatDiasBucketsList(diasBucketsList)
  const diasBucketOr = diasBucketsList.length > 0 ? buildDiasBucketsSupabaseOr(diasBucketsList) : null
  const sort = normalizeSort(params.sort)
  const skipCount = Boolean(params.skipCount)
  const knownTotalRaw = Number.parseInt(String(params.knownTotal ?? ''), 10)
  const knownTotal = Number.isFinite(knownTotalRaw) && knownTotalRaw >= 0 ? knownTotalRaw : null

  const sessionMeta = await getSupabaseAuthMeta()
  const rol = sessionMeta.rol
  const isSuperuser = sessionMeta.isSuperuser
  const usuarioId = sessionMeta.usuarioId

  let allowedRutaIds = null

  if (rol === 'VENDEDOR' && !isSuperuser) {
    if (usuarioId == null) {
      throw new Error(
        'Falta user_metadata.usuarioId para filtrar rutas de vendedor en Supabase.',
      )
    }
    const { data: rutasRows, error: rutasErr } = await supabase
      .from('usuario_rutas')
      .select('ruta_id')
      .eq('usuario_id', usuarioId)
    if (rutasErr) {
      throw new Error(formatSupabaseError(rutasErr, 'No se pudo cargar rutas del vendedor'))
    }
    const rutaIds = (rutasRows || []).map((r) => r.ruta_id).filter((v) => v != null)
    if (rutaIds.length === 0) {
      return emptyResult({ page, pageSize, estado, empresa, ruta, q, diasBucket, sort })
    }
    allowedRutaIds = rutaIds
  }

  if (ruta) {
    const { data: rutasByCode, error: rutaCodeErr } = await supabase
      .from('rutas')
      .select('id')
      .ilike('codigo', ruta)
    if (rutaCodeErr) {
      throw new Error(formatSupabaseError(rutaCodeErr, 'No se pudo filtrar por ruta'))
    }
    const rutaIds = (rutasByCode || []).map((r) => r.id)
    if (rutaIds.length === 0) {
      return emptyResult({ page, pageSize, estado, empresa, ruta, q, diasBucket, sort })
    }
    if (Array.isArray(allowedRutaIds)) {
      const set = new Set(allowedRutaIds)
      allowedRutaIds = rutaIds.filter((id) => set.has(id))
      if (allowedRutaIds.length === 0) {
        return emptyResult({ page, pageSize, estado, empresa, ruta, q, diasBucket, sort })
      }
    } else {
      allowedRutaIds = rutaIds
    }
  }

  const filterArgs = { estado, empresa, q, allowedRutaIds, diasBucketOr }

  let total = null
  if (skipCount && knownTotal != null) {
    total = knownTotal
  } else if (!skipCount) {
    const counted = await countNotasFiltradas(filterArgs)
    total = counted.count
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let listQuery = applyNotasListFilters(
    supabase.from('notas_credito').select(`
      id, serie_folio, fecha_nota, cliente, empresa, monto, abono, saldo, estado,
      requiere_atencion, resuelta_automaticamente, fecha_corriente, fecha_ultima_actualizacion,
      usuario_vendedor_pv, usuario_id, ruta_id,
      rutas:ruta_id(codigo, nombre),
      vendedor:usuario_id(username)
    `),
    filterArgs,
  )
  listQuery = applyNotasSort(listQuery, sort).range(from, to)

  const { data, error } = await listQuery
  if (error) {
    throw new Error(formatSupabaseError(error, 'Error al cargar notas desde Supabase'))
  }

  let items = (data || []).map((row) => ({
    ...row,
    ruta_codigo: row.rutas?.codigo || null,
    ruta_nombre: row.rutas?.nombre || null,
    vendedor_username: row.vendedor?.username || null,
    aclaraciones: [],
    tiene_comentarios: false,
  }))
  items = await attachAclaracionesToNotas(items)

  if (total == null) {
    total = from + items.length + (items.length >= pageSize ? 1 : 0)
  }

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1
  const safePage = total === 0 ? 1 : Math.min(page, Math.max(1, totalPages))

  return {
    ok: true,
    page: safePage,
    pageSize,
    total,
    totalPages,
    filters: {
      estado: estado || null,
      empresa: empresa || null,
      ruta: ruta || null,
      q: q || null,
      dias_bucket: diasBucket || null,
      sort,
    },
    items,
  }
}
