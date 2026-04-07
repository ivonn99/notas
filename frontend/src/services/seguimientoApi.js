import { getSupabaseAuthMeta } from '../lib/supabaseAuth.js'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js'
import { apiUrl } from '../utils/apiUrl.js'

function jsonOrEmpty(text) {
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

function buildQuery(params = {}) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v == null) return
    const s = String(v).trim()
    if (!s) return
    q.set(k, s)
  })
  return q.toString()
}

const ROLES_CAMBIO_ESTADO = new Set(['ADMIN', 'CREDITO'])
const ROLES_CAMBIO_RUTA = new Set(['ADMIN'])
const ESTADOS_VALIDOS = new Set(['PENDIENTE', 'RESUELTA', 'CANCELADA'])

async function request(path, options = {}) {
  const isFormData = options?.body instanceof FormData
  const res = await fetch(apiUrl(path), {
    credentials: 'include',
    headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = jsonOrEmpty(await res.text())
  if (!res.ok) throw new Error(data.error || `Error HTTP ${res.status}`)
  return data
}

async function getCurrentAuthMeta() {
  const m = await getSupabaseAuthMeta()
  return {
    rol: m.rol,
    isSuperuser: m.isSuperuser,
    usuarioId: m.usuarioId,
  }
}

function normalizeSort(sort) {
  const raw = String(sort || '').trim().toLowerCase()
  // Compatibilidad con filtros guardados previamente.
  const key =
    raw === 'fecha_corriente_desc'
      ? 'fecha_nota_desc'
      : raw === 'fecha_corriente_asc'
        ? 'fecha_nota_asc'
        : raw
  const allowed = new Set([
    'default',
    'atencion',
    'fecha_ultima_desc',
    'fecha_ultima_asc',
    'fecha_nota_desc',
    'fecha_nota_asc',
    'id_desc',
    'id_asc',
    'serie_folio_asc',
    'serie_folio_desc',
    'cliente_asc',
    'cliente_desc',
    'saldo_desc',
    'saldo_asc',
  ])
  return allowed.has(key) ? key : 'default'
}

async function resolveAllowedRutaIds(meta) {
  if (meta.isSuperuser || meta.rol !== 'VENDEDOR') return null
  if (meta.usuarioId == null) {
    throw new Error(
      'Falta user_metadata.usuarioId para filtrar seguimiento de vendedor en Supabase.',
    )
  }
  const { data, error } = await supabase
    .from('usuario_rutas')
    .select('ruta_id')
    .eq('usuario_id', meta.usuarioId)
  if (error) throw new Error(error.message || 'No se pudieron cargar rutas del vendedor')
  return (data || []).map((r) => r.ruta_id).filter((v) => v != null)
}

function applySort(query, sort) {
  if (sort === 'default' || sort === 'atencion') {
    return query
      .order('requiere_atencion', { ascending: false, nullsFirst: false })
      .order('fecha_ultima_actualizacion', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false, nullsFirst: false })
  }
  if (sort === 'fecha_ultima_desc') return query.order('fecha_ultima_actualizacion', { ascending: false, nullsFirst: false }).order('id', { ascending: false, nullsFirst: false })
  if (sort === 'fecha_ultima_asc') return query.order('fecha_ultima_actualizacion', { ascending: true, nullsFirst: false }).order('id', { ascending: true, nullsFirst: false })
  if (sort === 'fecha_nota_desc') return query.order('fecha_nota', { ascending: false, nullsFirst: false }).order('id', { ascending: false, nullsFirst: false })
  if (sort === 'fecha_nota_asc') return query.order('fecha_nota', { ascending: true, nullsFirst: false }).order('id', { ascending: true, nullsFirst: false })
  if (sort === 'id_desc') return query.order('id', { ascending: false, nullsFirst: false })
  if (sort === 'id_asc') return query.order('id', { ascending: true, nullsFirst: false })
  if (sort === 'serie_folio_asc') return query.order('serie_folio', { ascending: true, nullsFirst: false }).order('id', { ascending: true, nullsFirst: false })
  if (sort === 'serie_folio_desc') return query.order('serie_folio', { ascending: false, nullsFirst: false }).order('id', { ascending: false, nullsFirst: false })
  if (sort === 'cliente_asc') return query.order('cliente', { ascending: true, nullsFirst: false }).order('id', { ascending: true, nullsFirst: false })
  if (sort === 'cliente_desc') return query.order('cliente', { ascending: false, nullsFirst: false }).order('id', { ascending: false, nullsFirst: false })
  if (sort === 'saldo_desc') return query.order('saldo', { ascending: false, nullsFirst: false }).order('id', { ascending: false, nullsFirst: false })
  if (sort === 'saldo_asc') return query.order('saldo', { ascending: true, nullsFirst: false }).order('id', { ascending: true, nullsFirst: false })
  return query.order('id', { ascending: false, nullsFirst: false })
}

function applySeguimientoListFilters(query, { estado, empresa, q, atencion, allowedFinal }) {
  let qy = query
  if (estado) qy = qy.eq('estado', estado)
  if (empresa) qy = qy.eq('empresa', empresa)
  if (q) qy = qy.or(`serie_folio.ilike.%${q}%,cliente.ilike.%${q}%,usuario_vendedor_pv.ilike.%${q}%`)
  if (['si', 'sí', 'true', '1'].includes(atencion)) qy = qy.eq('requiere_atencion', true)
  if (['no', 'false', '0'].includes(atencion)) qy = qy.eq('requiere_atencion', false)
  if (Array.isArray(allowedFinal)) qy = qy.in('ruta_id', allowedFinal)
  return qy
}

export function fetchSeguimientoList(params = {}) {
  if (isSupabaseConfigured) {
    return fetchSeguimientoListSupabase(params)
  }
  const query = buildQuery(params)
  return request(query ? `/api/seguimiento?${query}` : '/api/seguimiento')
}

export function fetchSeguimientoDetalle(id) {
  if (isSupabaseConfigured) {
    return fetchSeguimientoDetalleSupabase(id)
  }
  return request(`/api/seguimiento/nota/${id}`)
}

export function postSeguimientoComentario(id, payload) {
  if (isSupabaseConfigured) {
    return postSeguimientoComentarioSupabase(id, payload)
  }
  return request(`/api/seguimiento/nota/${id}/comentarios`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function postSeguimientoEstado(id, payload) {
  if (isSupabaseConfigured) {
    return postSeguimientoEstadoSupabase(id, payload)
  }
  return request(`/api/seguimiento/nota/${id}/estado`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function postSeguimientoRuta(id, rutaId) {
  if (isSupabaseConfigured) {
    return postSeguimientoRutaSupabase(id, rutaId)
  }
  return request(`/api/seguimiento/nota/${id}/ruta`, {
    method: 'POST',
    body: JSON.stringify({ rutaId }),
  })
}

export function postSeguimientoDocumento(id, file) {
  if (isSupabaseConfigured) {
    const bucket = String(import.meta.env.VITE_SUPABASE_DOCUMENTOS_BUCKET || '').trim()
    if (bucket) {
      return postSeguimientoDocumentoSupabase(id, file, bucket)
    }
  }
  const fd = new FormData()
  fd.append('file', file)
  return request(`/api/seguimiento/nota/${id}/documentos`, {
    method: 'POST',
    body: fd,
  })
}

function sanitizeFileName(name) {
  const base = String(name || 'archivo').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'archivo'
  return base.slice(0, 180)
}

function getStoragePathFromRutaArchivo(rutaArchivo, bucket) {
  const raw = String(rutaArchivo || '').trim()
  if (!raw) return null
  const publicMarker = `/storage/v1/object/public/${bucket}/`
  const signMarker = `/storage/v1/object/sign/${bucket}/`
  if (raw.includes(publicMarker)) {
    return raw.split(publicMarker)[1]?.split('?')[0] || null
  }
  if (raw.includes(signMarker)) {
    return raw.split(signMarker)[1]?.split('?')[0] || null
  }
  if (raw.startsWith(`nota/`) || raw.startsWith(`${bucket}/`)) {
    return raw.startsWith(`${bucket}/`) ? raw.slice(bucket.length + 1) : raw
  }
  return null
}

async function withSignedDocumentoUrls(documentos = []) {
  const bucket = String(import.meta.env.VITE_SUPABASE_DOCUMENTOS_BUCKET || '').trim()
  if (!bucket || !Array.isArray(documentos) || documentos.length === 0) return documentos

  const resolved = await Promise.all(
    documentos.map(async (d) => {
      const path = getStoragePathFromRutaArchivo(d.ruta_archivo, bucket)
      if (!path) return d
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60)
      if (error || !data?.signedUrl) return d
      return { ...d, ruta_archivo: data.signedUrl }
    }),
  )
  return resolved
}

async function postSeguimientoDocumentoSupabase(id, file, bucket) {
  const noteId = Number.parseInt(String(id), 10)
  if (!Number.isFinite(noteId) || noteId <= 0) throw new Error('ID de nota inválido')
  if (!file || !(file instanceof File)) throw new Error('Archivo requerido')

  const meta = await getCurrentAuthMeta()
  if (meta.usuarioId == null) {
    throw new Error('Falta user_metadata.usuarioId para adjuntar documentos')
  }
  const allowedRutaIds = await resolveAllowedRutaIds(meta)

  const { data: noteRows, error: noteErr } = await supabase
    .from('notas_credito')
    .select('id, ruta_id')
    .eq('id', noteId)
    .limit(1)
  if (noteErr) throw new Error(noteErr.message || 'No se pudo validar la nota')
  const note = noteRows?.[0]
  if (!note) throw new Error('Nota no encontrada')
  if (Array.isArray(allowedRutaIds) && !allowedRutaIds.includes(note.ruta_id)) {
    throw new Error('Nota no encontrada')
  }

  const safeName = sanitizeFileName(file.name)
  const objectPath = `nota/${noteId}/${crypto.randomUUID()}_${safeName}`

  const { error: upErr } = await supabase.storage.from(bucket).upload(objectPath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  })
  if (upErr) {
    throw new Error(
      upErr.message ||
        'No se pudo subir el archivo. Revisa el bucket en Supabase Storage y las políticas RLS.',
    )
  }

  const { data: insRows, error: insErr } = await supabase
    .from('documentos')
    .insert({
      nombre_archivo: file.name || safeName,
      ruta_archivo: objectPath,
      tipo_mime: file.type || 'application/octet-stream',
      tamanio: file.size || 0,
      nota_id: noteId,
      usuario_id: meta.usuarioId,
    })
    .select('id, nombre_archivo, ruta_archivo, tipo_mime, tamanio, created_at')
    .limit(1)
  if (insErr) {
    await supabase.storage.from(bucket).remove([objectPath])
    throw new Error(insErr.message || 'No se pudo registrar el documento')
  }

  await supabase.from('historial_notas').insert({
    campo_modificado: 'documento',
    valor_anterior: '',
    valor_nuevo: '',
    observacion: `Adjunto: ${file.name || safeName}`,
    nota_id: noteId,
    usuario_id: meta.usuarioId,
  })

  return { ok: true, item: insRows?.[0] || null }
}

async function fetchSeguimientoListSupabase(params = {}) {
  const meta = await getCurrentAuthMeta()
  const allowedRutaIds = await resolveAllowedRutaIds(meta)
  const page = Math.max(1, Number.parseInt(String(params.page ?? 1), 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(params.pageSize ?? 20), 10) || 20))
  const estado = String(params.estado ?? '').trim().toUpperCase()
  const empresa = String(params.empresa ?? '').trim().toUpperCase()
  const ruta = String(params.ruta ?? '').trim().toUpperCase()
  const atencion = String(params.atencion ?? '').trim().toLowerCase()
  const q = String(params.q ?? '').trim()
  const sort = normalizeSort(params.sort)

  let rutaIdsFiltro = null
  if (ruta) {
    const { data: rutasByCode, error: rutaErr } = await supabase
      .from('rutas')
      .select('id')
      .ilike('codigo', ruta)
    if (rutaErr) throw new Error(rutaErr.message || 'No se pudo filtrar por ruta')
    rutaIdsFiltro = (rutasByCode || []).map((r) => r.id)
    if (rutaIdsFiltro.length === 0) {
      return { ok: true, page, pageSize, total: 0, totalPages: 1, resumen: { total_filtrado: 0, requiere_atencion: 0 }, porRuta: [], porAntiguedad: [], items: [] }
    }
  }

  let allowedFinal = allowedRutaIds
  if (Array.isArray(allowedFinal) && rutaIdsFiltro) {
    const set = new Set(allowedFinal)
    allowedFinal = rutaIdsFiltro.filter((id) => set.has(id))
    if (allowedFinal.length === 0) {
      return { ok: true, page, pageSize, total: 0, totalPages: 1, resumen: { total_filtrado: 0, requiere_atencion: 0 }, porRuta: [], porAntiguedad: [], items: [] }
    }
  } else if (rutaIdsFiltro) {
    allowedFinal = rutaIdsFiltro
  }

  const filterArgs = { estado, empresa, q, atencion, allowedFinal }

  const { count: totalCount, error: countError } = await applySeguimientoListFilters(
    supabase.from('notas_credito').select('id', { count: 'exact', head: true }),
    filterArgs,
  )
  if (countError) throw new Error(countError.message || 'No se pudo cargar seguimiento')

  const total = totalCount ?? 0
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1
  const safePage = total === 0 ? 1 : Math.min(page, totalPages)
  const fromSafe = (safePage - 1) * pageSize
  const toSafe = fromSafe + pageSize - 1

  let baseQuery = supabase
    .from('notas_credito')
    .select(
      `
      id, serie_folio, fecha_nota, cliente, estado, requiere_atencion, resuelta_automaticamente,
      fecha_corriente, fecha_ultima_actualizacion, monto, abono, saldo, empresa, usuario_vendedor_pv, ruta_id,
      rutas:ruta_id(codigo),
      vendedor:usuario_id(username)
    `,
      { count: 'exact' },
    )
  baseQuery = applySeguimientoListFilters(baseQuery, filterArgs)

  let listQuery = applySort(baseQuery, sort).range(fromSafe, toSafe)
  const { data: rows, error } = await listQuery
  if (error) throw new Error(error.message || 'No se pudo cargar seguimiento')

  const items = (rows || []).map((n) => ({
    ...n,
    ruta_codigo: n.rutas?.codigo || null,
    vendedor_username: n.vendedor?.username || null,
  }))

  const requiereAtencion = items.filter((x) => x.requiere_atencion).length
  const porRutaMap = new Map()
  for (const row of items) {
    const key = String(row.ruta_codigo || '(sin ruta)')
    porRutaMap.set(key, (porRutaMap.get(key) || 0) + 1)
  }
  const porRuta = Array.from(porRutaMap.entries())
    .map(([ruta_codigo, registros]) => ({ ruta_codigo, registros }))
    .sort((a, b) => b.registros - a.registros || String(a.ruta_codigo).localeCompare(String(b.ruta_codigo)))

  const bucketOrder = ['negativo', 'd0_30', 'd31_45', 'd46_60', 'd61_90', 'd91_180', 'd181_365', 'd366_plus']
  const bucketMap = new Map(bucketOrder.map((k) => [k, 0]))
  const now = Date.now()
  for (const row of items) {
    if (!row.fecha_nota) {
      bucketMap.set('negativo', (bucketMap.get('negativo') || 0) + 1)
      continue
    }
    const dias = Math.floor((now - new Date(row.fecha_nota).getTime()) / (24 * 60 * 60 * 1000))
    let key = 'd366_plus'
    if (!Number.isFinite(dias) || dias < 0) key = 'negativo'
    else if (dias <= 30) key = 'd0_30'
    else if (dias <= 45) key = 'd31_45'
    else if (dias <= 60) key = 'd46_60'
    else if (dias <= 90) key = 'd61_90'
    else if (dias <= 180) key = 'd91_180'
    else if (dias <= 365) key = 'd181_365'
    bucketMap.set(key, (bucketMap.get(key) || 0) + 1)
  }
  const porAntiguedad = bucketOrder
    .map((bucket_id) => ({ bucket_id, registros: bucketMap.get(bucket_id) || 0 }))
    .filter((r) => r.registros > 0)

  return {
    ok: true,
    page: safePage,
    pageSize,
    total,
    totalPages,
    filters: {
      empresa: empresa || null,
      estado: estado || null,
      ruta: ruta || null,
      atencion: atencion || null,
      q: q || null,
      sort,
    },
    resumen: {
      total_filtrado: total,
      requiere_atencion: requiereAtencion,
    },
    porRuta,
    porAntiguedad,
    items,
  }
}

async function fetchSeguimientoDetalleSupabase(id) {
  const noteId = Number.parseInt(String(id), 10)
  if (!Number.isFinite(noteId) || noteId <= 0) {
    throw new Error('ID de nota inválido')
  }
  const meta = await getCurrentAuthMeta()
  const canManageState = meta.isSuperuser || ROLES_CAMBIO_ESTADO.has(meta.rol)
  const canManageRoute = meta.isSuperuser || ROLES_CAMBIO_RUTA.has(meta.rol)
  const allowedRutaIds = await resolveAllowedRutaIds(meta)

  const { data: noteRows, error: noteErr } = await supabase
    .from('notas_credito')
    .select(
      `
      id, serie_folio, fecha_nota, cliente, empresa, estado, monto, abono, saldo,
      requiere_atencion, resuelta_automaticamente, usuario_vendedor_pv, usuario_id,
      fecha_corriente, fecha_ultima_actualizacion, fecha_resolucion, ruta_id,
      rutas:ruta_id(id, codigo, nombre),
      vendedor:usuario_id(username)
    `,
    )
    .eq('id', noteId)
    .limit(1)
  if (noteErr) throw new Error(noteErr.message || 'No se pudo cargar la nota')
  const n = noteRows?.[0]
  if (!n) throw new Error('Nota no encontrada')
  if (Array.isArray(allowedRutaIds) && !allowedRutaIds.includes(n.ruta_id)) {
    throw new Error('Nota no encontrada')
  }

  const { data: historial, error: histErr } = await supabase
    .from('historial_notas')
    .select('id, campo_modificado, valor_anterior, valor_nuevo, observacion, created_at, usuario_id, usuarios:usuario_id(username,nombre_completo)')
    .eq('nota_id', noteId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (histErr) throw new Error(histErr.message || 'No se pudo cargar historial')

  const { data: aclaraciones, error: aErr } = await supabase
    .from('aclaraciones')
    .select('id, comentario, tipo, leida, created_at, usuario_id, usuarios:usuario_id(username,nombre_completo)')
    .eq('nota_id', noteId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (aErr) throw new Error(aErr.message || 'No se pudieron cargar comentarios')

  const { data: documentos, error: dErr } = await supabase
    .from('documentos')
    .select('id, nombre_archivo, ruta_archivo, tipo_mime, tamanio, created_at, usuario_id, usuarios:usuario_id(username,nombre_completo)')
    .eq('nota_id', noteId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (dErr) throw new Error(dErr.message || 'No se pudieron cargar documentos')
  const documentosConUrl = await withSignedDocumentoUrls(documentos || [])

  if (canManageState) {
    await supabase.from('aclaraciones').update({ leida: true }).eq('nota_id', noteId).eq('leida', false)
  }

  let rutasDisponibles = []
  if (canManageRoute) {
    const { data: rutas, error: rErr } = await supabase
      .from('rutas')
      .select('id, codigo, nombre')
      .eq('activa', true)
      .order('codigo', { ascending: true })
    if (rErr) throw new Error(rErr.message || 'No se pudieron cargar rutas')
    rutasDisponibles = rutas || []
  }

  return {
    ok: true,
    canManageState,
    canManageRoute,
    nota: {
      ...n,
      ruta_codigo: n.rutas?.codigo || null,
      ruta_nombre: n.rutas?.nombre || null,
      vendedor_username: n.vendedor?.username || null,
    },
    historial: (historial || []).map((h) => ({
      ...h,
      usuario_username: h.usuarios?.username || null,
      usuario_nombre: h.usuarios?.nombre_completo || null,
    })),
    aclaraciones: (aclaraciones || []).map((a) => ({
      ...a,
      usuario_username: a.usuarios?.username || null,
      usuario_nombre: a.usuarios?.nombre_completo || null,
    })),
    documentos: (documentosConUrl || []).map((d) => ({
      ...d,
      usuario_username: d.usuarios?.username || null,
      usuario_nombre: d.usuarios?.nombre_completo || null,
    })),
    rutasDisponibles,
  }
}

async function postSeguimientoComentarioSupabase(id, payload) {
  const noteId = Number.parseInt(String(id), 10)
  const comentario = String(payload?.comentario ?? '').trim()
  const tipo = String(payload?.tipo ?? 'COMENTARIO').trim().toUpperCase()
  if (!Number.isFinite(noteId) || noteId <= 0) throw new Error('ID de nota inválido')
  if (!comentario) throw new Error('Comentario obligatorio')
  if (!['COMENTARIO', 'ACLARACION', 'SEGUIMIENTO'].includes(tipo)) {
    throw new Error('Tipo de comentario inválido')
  }
  const meta = await getCurrentAuthMeta()
  if (meta.usuarioId == null) throw new Error('Falta user_metadata.usuarioId para guardar comentario')
  const allowedRutaIds = await resolveAllowedRutaIds(meta)

  const { data: noteRows, error: noteErr } = await supabase
    .from('notas_credito')
    .select('id, estado, ruta_id')
    .eq('id', noteId)
    .limit(1)
  if (noteErr) throw new Error(noteErr.message || 'No se pudo validar la nota')
  const note = noteRows?.[0]
  if (!note) throw new Error('Nota no encontrada')
  if (Array.isArray(allowedRutaIds) && !allowedRutaIds.includes(note.ruta_id)) throw new Error('Nota no encontrada')

  const { data: itemRows, error: insErr } = await supabase
    .from('aclaraciones')
    .insert({
      comentario,
      tipo,
      leida: false,
      nota_id: noteId,
      usuario_id: meta.usuarioId,
    })
    .select('id, comentario, tipo, leida, created_at')
    .limit(1)
  if (insErr) throw new Error(insErr.message || 'No se pudo guardar comentario')

  const prevEstado = String(note.estado || '').toUpperCase()
  if (prevEstado !== 'PENDIENTE') {
    await supabase
      .from('notas_credito')
      .update({
        estado: 'PENDIENTE',
        fecha_ultima_actualizacion: new Date().toISOString(),
        fecha_resolucion: null,
        resuelta_automaticamente: false,
        requiere_atencion: true,
      })
      .eq('id', noteId)
    await supabase.from('historial_notas').insert({
      campo_modificado: 'estado',
      valor_anterior: note.estado || '',
      valor_nuevo: 'PENDIENTE',
      observacion: '',
      nota_id: noteId,
      usuario_id: meta.usuarioId,
    })
  } else {
    await supabase.from('notas_credito').update({ requiere_atencion: true }).eq('id', noteId)
  }

  await supabase.from('historial_notas').insert({
    campo_modificado: 'comentario',
    valor_anterior: '',
    valor_nuevo: '',
    observacion: comentario,
    nota_id: noteId,
    usuario_id: meta.usuarioId,
  })

  return { ok: true, item: itemRows?.[0] || null }
}

async function postSeguimientoEstadoSupabase(id, payload) {
  const noteId = Number.parseInt(String(id), 10)
  const nuevoEstado = String(payload?.estado ?? '').trim().toUpperCase()
  const observacion = String(payload?.observacion ?? '').trim()
  if (!Number.isFinite(noteId) || noteId <= 0) throw new Error('ID de nota inválido')
  if (!ESTADOS_VALIDOS.has(nuevoEstado)) throw new Error('Estado inválido')
  const meta = await getCurrentAuthMeta()
  const canManageState = meta.isSuperuser || ROLES_CAMBIO_ESTADO.has(meta.rol)
  if (!canManageState) throw new Error('Sin permiso para cambiar estado')
  if (meta.usuarioId == null) throw new Error('Falta user_metadata.usuarioId para guardar estado')

  const { data: prevRows, error: prevErr } = await supabase
    .from('notas_credito')
    .select('id, estado')
    .eq('id', noteId)
    .limit(1)
  if (prevErr) throw new Error(prevErr.message || 'No se pudo validar la nota')
  const prev = prevRows?.[0]
  if (!prev) throw new Error('Nota no encontrada')

  const nowIso = new Date().toISOString()
  const payloadUpdate = {
    estado: nuevoEstado,
    fecha_ultima_actualizacion: nowIso,
    fecha_resolucion: nuevoEstado === 'RESUELTA' ? nowIso : null,
    resuelta_automaticamente: false,
  }
  if (nuevoEstado === 'RESUELTA' || nuevoEstado === 'CANCELADA') {
    payloadUpdate.requiere_atencion = false
  }
  const { error: upErr } = await supabase.from('notas_credito').update(payloadUpdate).eq('id', noteId)
  if (upErr) throw new Error(upErr.message || 'No se pudo cambiar estado')

  const { error: histErr } = await supabase.from('historial_notas').insert({
    campo_modificado: 'estado',
    valor_anterior: prev.estado || '',
    valor_nuevo: nuevoEstado,
    observacion,
    nota_id: noteId,
    usuario_id: meta.usuarioId,
  })
  if (histErr) throw new Error(histErr.message || 'No se pudo registrar historial de estado')

  return { ok: true, estadoAnterior: prev.estado, estadoNuevo: nuevoEstado }
}

async function postSeguimientoRutaSupabase(id, rutaId) {
  const noteId = Number.parseInt(String(id), 10)
  const nuevaRutaId = Number.parseInt(String(rutaId), 10)
  if (!Number.isFinite(noteId) || noteId <= 0) throw new Error('ID de nota inválido')
  if (!Number.isFinite(nuevaRutaId) || nuevaRutaId <= 0) throw new Error('Ruta inválida')
  const meta = await getCurrentAuthMeta()
  const canManageRoute = meta.isSuperuser || ROLES_CAMBIO_RUTA.has(meta.rol)
  if (!canManageRoute) throw new Error('Solo ADMIN puede cambiar la ruta')
  if (meta.usuarioId == null) throw new Error('Falta user_metadata.usuarioId para guardar ruta')

  const { data: noteRows, error: noteErr } = await supabase
    .from('notas_credito')
    .select('id, ruta_id, rutas:ruta_id(codigo)')
    .eq('id', noteId)
    .limit(1)
  if (noteErr) throw new Error(noteErr.message || 'No se pudo validar nota')
  const prev = noteRows?.[0]
  if (!prev) throw new Error('Nota no encontrada')

  const { data: rutaRows, error: rutaErr } = await supabase
    .from('rutas')
    .select('id, codigo, activa')
    .eq('id', nuevaRutaId)
    .limit(1)
  if (rutaErr) throw new Error(rutaErr.message || 'No se pudo validar ruta')
  const nextRuta = rutaRows?.[0]
  if (!nextRuta) throw new Error('Ruta no encontrada')
  if (nextRuta.activa === false) throw new Error('La ruta seleccionada está inactiva')

  const prevCodigo = prev.rutas?.codigo || null
  if (Number(prev.ruta_id) === Number(nuevaRutaId)) {
    return { ok: true, unchanged: true, rutaAnterior: prevCodigo, rutaNueva: nextRuta.codigo }
  }

  const { error: upErr } = await supabase
    .from('notas_credito')
    .update({
      ruta_id: nuevaRutaId,
      fecha_ultima_actualizacion: new Date().toISOString(),
    })
    .eq('id', noteId)
  if (upErr) throw new Error(upErr.message || 'No se pudo cambiar ruta')

  const { error: histErr } = await supabase.from('historial_notas').insert({
    campo_modificado: 'ruta',
    valor_anterior: prevCodigo || '',
    valor_nuevo: nextRuta.codigo || '',
    observacion: '',
    nota_id: noteId,
    usuario_id: meta.usuarioId,
  })
  if (histErr) throw new Error(histErr.message || 'No se pudo registrar historial de ruta')

  return {
    ok: true,
    rutaAnterior: prevCodigo,
    rutaNueva: nextRuta.codigo,
    rutaNuevaId: nextRuta.id,
  }
}
