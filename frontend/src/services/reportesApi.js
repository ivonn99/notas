import { supabase } from '../lib/supabaseClient.js'
import {
  PARAM_UMBRAL_ATRASO_CLAVE,
  buildAtrasoEstructuralPayload,
  parseUmbralAtrasoPct,
} from '../utils/atrasoEstructural.js'

/**
 * @param {Record<string, string>} params empresa, estado, dias_bucket, q, fecha_desde, fecha_hasta, rutas, sort
 */
export function fetchCarteraReporte(params = {}) {
  return fetchCarteraReporteSupabase(params)
}

const EMPRESAS = new Set(['DISTRIBUIDORA', 'RODRIGO'])
const ESTADOS = new Set(['PENDIENTE', 'RESUELTA', 'CANCELADA'])
const DIAS_BUCKETS = new Set(['all', 'r1', 'r2', 'r2b', 'r3', 'r4', 'r5', 'r6'])
const MAX_ROWS = 5000

function diasFromFechaNota(fechaNota) {
  if (!fechaNota) return null
  const d = new Date(fechaNota)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000))
}

function bucketIdFromDias(dias) {
  const d = Number(dias)
  if (!Number.isFinite(d) || d < 0) return 'negativo'
  if (d <= 30) return 'd0_30'
  if (d <= 45) return 'd31_45'
  if (d <= 60) return 'd46_60'
  if (d <= 90) return 'd61_90'
  if (d <= 180) return 'd91_180'
  if (d <= 365) return 'd181_365'
  return 'd366_plus'
}

function bucketMatch(dias, diasBucket) {
  const d = Number(dias)
  if (!Number.isFinite(d)) return diasBucket === 'all'
  if (diasBucket === 'all') return true
  if (diasBucket === 'r1') return d >= 0 && d <= 30
  if (diasBucket === 'r2') return d > 30 && d <= 45
  if (diasBucket === 'r2b') return d > 45 && d <= 60
  if (diasBucket === 'r3') return d > 60 && d <= 90
  if (diasBucket === 'r4') return d > 90 && d <= 180
  if (diasBucket === 'r5') return d > 180 && d <= 365
  if (diasBucket === 'r6') return d > 365
  return true
}

function emptyCarteraResponse(empresa, estadoRaw, diasBucket, q, fechaDesde, fechaHasta, rutasList, sortKey) {
  return {
    ok: true,
    empresa,
    estadoFiltro: estadoRaw === 'TODOS' ? null : estadoRaw || 'PENDIENTE',
    filters: {
      dias_bucket: diasBucket,
      q: q || null,
      fecha_desde: fechaDesde || null,
      fecha_hasta: fechaHasta || null,
      rutas: rutasList.length ? rutasList : null,
      sort: sortKey,
    },
    kpis: {
      registros: 0,
      saldo_total: 0,
      abonos_total: 0,
      monto_total: 0,
      dias_promedio: 0,
      vencidos_365: 0,
      rutas_activas: 0,
      requiere_atencion: 0,
      requiere_atencion_pct: 0,
      pct_recuperado: 0,
      saldo_mas_90: 0,
      saldo_mas_180: 0,
      notas_mas_90: 0,
      notas_mas_180: 0,
      atraso_estructural_clientes: 0,
      atraso_estructural_clientes_pct: 0,
      atraso_estructural_saldo: 0,
      atraso_estructural_rutas: 0,
      atraso_estructural_rutas_pct: 0,
    },
    atrasoEstructural: {
      umbral_pct: parseUmbralAtrasoPct(),
      dias_corte: 30,
      clientes_total: 0,
      clientes_atraso: 0,
      clientes_atraso_pct: 0,
      saldo_cartera_total: 0,
      saldo_atraso_total: 0,
      rutas_total: 0,
      rutas_atraso: 0,
      rutas_atraso_pct: 0,
      saldo_atraso_rutas_total: 0,
      items: [],
      porRuta: [],
    },
    total: 0,
    truncated: false,
    maxRows: MAX_ROWS,
    porRuta: [],
    porAntiguedad: [],
    porCliente: [],
    porSituacion: [],
    resumenPivot: [],
    items: [],
  }
}

function sinVendedor(row) {
  const pv = String(row.usuario_vendedor_pv ?? '').trim()
  const user = String(row.vendedor_username ?? '').trim()
  return !pv && !user && row.usuario_id == null
}

function sinRuta(row) {
  const codigo = String(row.ruta_codigo ?? '').trim()
  return !codigo
}

function buildPorSituacion(filtered) {
  const defs = [
    {
      situacion_id: 'requiere_atencion',
      match: (r) => Boolean(r.requiere_atencion),
    },
    {
      situacion_id: 'sin_comentarios',
      match: (r) => !r.tiene_comentarios,
    },
    {
      situacion_id: 'sin_ruta',
      match: sinRuta,
    },
    {
      situacion_id: 'sin_vendedor',
      match: sinVendedor,
    },
    {
      situacion_id: 'antiguedad_90',
      match: (r) => Number(r.dias) > 90,
    },
    {
      situacion_id: 'antiguedad_180',
      match: (r) => Number(r.dias) > 180,
    },
    {
      situacion_id: 'saldo_cero',
      match: (r) => Number(r.saldo || 0) <= 0,
    },
    {
      situacion_id: 'resuelta_automatica',
      match: (r) => Boolean(r.resuelta_automaticamente),
    },
  ]
  const rows = []
  for (const def of defs) {
    let notas = 0
    let saldoTotal = 0
    for (const r of filtered) {
      if (!def.match(r)) continue
      notas += 1
      saldoTotal += Number(r.saldo || 0)
    }
    if (notas > 0) rows.push({ situacion_id: def.situacion_id, notas, saldo_total: saldoTotal })
  }
  rows.sort((a, b) => b.saldo_total - a.saldo_total || String(a.situacion_id).localeCompare(String(b.situacion_id)))
  return rows
}

function sorterFor(sortKey) {
  if (sortKey === 'saldo_asc') return (a, b) => (a.saldo || 0) - (b.saldo || 0) || a.id - b.id
  if (sortKey === 'dias_desc') return (a, b) => (b.dias ?? -1) - (a.dias ?? -1) || b.id - a.id
  if (sortKey === 'dias_asc') return (a, b) => (a.dias ?? -1) - (b.dias ?? -1) || a.id - b.id
  if (sortKey === 'fecha_desc') return (a, b) => String(b.fecha_nota || '').localeCompare(String(a.fecha_nota || '')) || b.id - a.id
  if (sortKey === 'fecha_asc') return (a, b) => String(a.fecha_nota || '').localeCompare(String(b.fecha_nota || '')) || a.id - b.id
  if (sortKey === 'cliente_asc') return (a, b) => String(a.cliente || '').localeCompare(String(b.cliente || '')) || a.id - b.id
  if (sortKey === 'folio_asc') return (a, b) => String(a.serie_folio || '').localeCompare(String(b.serie_folio || '')) || a.id - b.id
  return (a, b) => (b.saldo || 0) - (a.saldo || 0) || b.id - a.id
}

async function loadUmbralAtrasoSupabase() {
  try {
    const { data, error } = await supabase
      .from('parametros')
      .select('valor')
      .eq('clave', PARAM_UMBRAL_ATRASO_CLAVE)
      .limit(1)
    if (error) return parseUmbralAtrasoPct()
    return parseUmbralAtrasoPct(data?.[0]?.valor)
  } catch {
    return parseUmbralAtrasoPct()
  }
}

async function fetchComposicionRowsSupabase({
  empresa,
  q,
  fechaDesde,
  fechaHasta,
  allowedRutaIds,
}) {
  let query = supabase
    .from('notas_credito')
    .select('cliente, saldo, fecha_nota, rutas:ruta_id(codigo)')
    .eq('empresa', empresa)
    .eq('estado', 'PENDIENTE')
    .gt('saldo', 0)

  if (allowedRutaIds) query = query.in('ruta_id', allowedRutaIds)
  if (q) {
    query = query.or(`cliente.ilike.%${q}%,serie_folio.ilike.%${q}%,usuario_vendedor_pv.ilike.%${q}%`)
  }
  if (fechaDesde) query = query.gte('fecha_nota', fechaDesde)
  if (fechaHasta) query = query.lte('fecha_nota', fechaHasta)

  const { data, error } = await query.limit(20000)
  if (error) throw new Error(error.message || 'No se pudo cargar composición de cartera')
  return (data || []).map((row) => ({
    cliente: row.cliente,
    ruta_codigo: row.rutas?.codigo || null,
    saldo: row.saldo,
    dias: diasFromFechaNota(row.fecha_nota),
  }))
}

async function fetchCarteraReporteSupabase(params = {}) {
  const empresa = String(params.empresa ?? '').trim().toUpperCase()
  if (!EMPRESAS.has(empresa)) {
    throw new Error('empresa requerida: DISTRIBUIDORA o RODRIGO')
  }
  const estadoRaw = String(params.estado ?? 'PENDIENTE').trim().toUpperCase()
  if (estadoRaw && estadoRaw !== 'TODOS' && !ESTADOS.has(estadoRaw)) {
    throw new Error('estado inválido')
  }
  const diasBucket = String(params.dias_bucket ?? 'all').trim().toLowerCase()
  if (!DIAS_BUCKETS.has(diasBucket)) throw new Error('dias_bucket inválido')
  const q = String(params.q ?? '').trim()
  const fechaDesde = String(params.fecha_desde ?? '').trim()
  const fechaHasta = String(params.fecha_hasta ?? '').trim()
  const rutasRaw = String(params.rutas ?? '').trim()
  const rutasList = rutasRaw
    ? rutasRaw
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    : []
  const sortKey = String(params.sort ?? 'saldo_desc').trim()
  const debugEnabled = ['1', 'true', 'si', 'sí', 'yes'].includes(
    String(params.debug ?? '').trim().toLowerCase(),
  )

  let allowedRutaIds = null
  if (rutasList.length > 0) {
    const { data: rutasRows, error: rutasErr } = await supabase
      .from('rutas')
      .select('id, codigo')
      .in('codigo', rutasList)
    if (rutasErr) throw new Error(rutasErr.message || 'No se pudo filtrar rutas')
    allowedRutaIds = (rutasRows || []).map((r) => r.id)
    if (allowedRutaIds.length === 0) {
      return emptyCarteraResponse(empresa, estadoRaw, diasBucket, q, fechaDesde, fechaHasta, rutasList, sortKey)
    }
  }

  let query = supabase
    .from('notas_credito')
    .select(
      `
      id, serie_folio, cliente, empresa, estado, monto, abono, saldo, fecha_nota, fecha_corriente, created_at,
      usuario_vendedor_pv, ruta_id, usuario_id, requiere_atencion, resuelta_automaticamente,
      rutas:ruta_id(codigo),
      vendedor:usuario_id(username)
    `,
    )
    .eq('empresa', empresa)

  if (estadoRaw && estadoRaw !== 'TODOS') query = query.eq('estado', estadoRaw)
  if (allowedRutaIds) query = query.in('ruta_id', allowedRutaIds)
  if (q) {
    query = query.or(
      `cliente.ilike.%${q}%,serie_folio.ilike.%${q}%,usuario_vendedor_pv.ilike.%${q}%`,
    )
  }
  if (fechaDesde) query = query.gte('fecha_nota', fechaDesde)
  if (fechaHasta) query = query.lte('fecha_nota', fechaHasta)

  const { data, error } = await query.limit(20000)
  if (error) throw new Error(error.message || 'No se pudo cargar reporte desde Supabase')

  const notaIds = (data || []).map((row) => row.id).filter((id) => id != null)
  const comentariosSet = new Set()
  if (notaIds.length > 0) {
    const chunkSize = 500
    for (let i = 0; i < notaIds.length; i += chunkSize) {
      const chunk = notaIds.slice(i, i + chunkSize)
      const { data: aclRows, error: aclErr } = await supabase
        .from('aclaraciones')
        .select('nota_id')
        .in('nota_id', chunk)
      if (aclErr) throw new Error(aclErr.message || 'No se pudieron cargar comentarios para el reporte')
      for (const row of aclRows || []) {
        if (row?.nota_id != null) comentariosSet.add(row.nota_id)
      }
    }
  }

  const allRows = (data || []).map((row) => ({
    ...row,
    ruta_codigo: row.rutas?.codigo || null,
    vendedor_username: row.vendedor?.username || null,
    dias: diasFromFechaNota(row.fecha_nota),
    tiene_comentarios: comentariosSet.has(row.id),
  }))

  const filtered = allRows.filter((r) => bucketMatch(r.dias, diasBucket))
  const totalFiltered = filtered.length
  const sorted = [...filtered].sort(sorterFor(sortKey))
  const items = sorted.slice(0, MAX_ROWS)

  let saldoTotal = 0
  let abonosTotal = 0
  let montoTotal = 0
  let diasSum = 0
  let diasCount = 0
  let vencidos365 = 0
  let requiereAtencion = 0
  let saldoMas90 = 0
  let saldoMas180 = 0
  let notasMas90 = 0
  let notasMas180 = 0
  const rutasSet = new Set()
  for (const r of filtered) {
    saldoTotal += Number(r.saldo || 0)
    abonosTotal += Number(r.abono || 0)
    montoTotal += Number(r.monto || 0)
    if (r.requiere_atencion) requiereAtencion += 1
    if (Number.isFinite(r.dias)) {
      diasSum += r.dias
      diasCount += 1
      if (r.dias > 365) vencidos365 += 1
      if (r.dias > 90) {
        notasMas90 += 1
        saldoMas90 += Number(r.saldo || 0)
      }
      if (r.dias > 180) {
        notasMas180 += 1
        saldoMas180 += Number(r.saldo || 0)
      }
    }
    if (r.ruta_codigo && String(r.ruta_codigo).trim()) rutasSet.add(String(r.ruta_codigo).trim())
  }

  const porRutaMap = new Map()
  const porAntMap = new Map()
  const porClienteMap = new Map()
  const pivotMap = new Map()
  for (const r of filtered) {
    const ruta = r.ruta_codigo && String(r.ruta_codigo).trim() ? String(r.ruta_codigo).trim() : '(sin ruta)'
    const bucket = bucketIdFromDias(r.dias)
    const saldo = Number(r.saldo || 0)
    const monto = Number(r.monto || 0)
    const abono = Number(r.abono || 0)

    const rutaPrev = porRutaMap.get(ruta) || { ruta_codigo: ruta, notas: 0, saldo_total: 0, monto_total: 0, abono_total: 0 }
    rutaPrev.notas += 1
    rutaPrev.saldo_total += saldo
    rutaPrev.monto_total += monto
    rutaPrev.abono_total += abono
    porRutaMap.set(ruta, rutaPrev)

    const antPrev = porAntMap.get(bucket) || { bucket_id: bucket, notas: 0, saldo_total: 0 }
    antPrev.notas += 1
    antPrev.saldo_total += saldo
    porAntMap.set(bucket, antPrev)

    const cliente =
      r.cliente && String(r.cliente).trim() ? String(r.cliente).trim() : '(sin cliente)'
    const clientePrev = porClienteMap.get(cliente) || { cliente, notas: 0, saldo_total: 0 }
    clientePrev.notas += 1
    clientePrev.saldo_total += saldo
    porClienteMap.set(cliente, clientePrev)

    const pivotKey = `${bucket}||${ruta}`
    const pivotPrev = pivotMap.get(pivotKey) || { bucket_id: bucket, ruta_codigo: ruta, notas: 0, saldo_total: 0 }
    pivotPrev.notas += 1
    pivotPrev.saldo_total += saldo
    pivotMap.set(pivotKey, pivotPrev)
  }

  const bucketOrder = ['negativo', 'd0_30', 'd31_45', 'd46_60', 'd61_90', 'd91_180', 'd181_365', 'd366_plus']
  const porRuta = Array.from(porRutaMap.values()).sort(
    (a, b) => b.saldo_total - a.saldo_total || String(a.ruta_codigo).localeCompare(String(b.ruta_codigo)),
  )
  const porAntiguedad = Array.from(porAntMap.values()).sort(
    (a, b) => bucketOrder.indexOf(a.bucket_id) - bucketOrder.indexOf(b.bucket_id),
  )
  const porCliente = Array.from(porClienteMap.values())
    .sort((a, b) => b.saldo_total - a.saldo_total || String(a.cliente).localeCompare(String(b.cliente)))
    .slice(0, 15)
  const porSituacion = buildPorSituacion(filtered)
  const umbralAtrasoPct = await loadUmbralAtrasoSupabase()
  const composicionRows = await fetchComposicionRowsSupabase({
    empresa,
    q,
    fechaDesde,
    fechaHasta,
    allowedRutaIds,
  })
  const atrasoEstructural = buildAtrasoEstructuralPayload(composicionRows, umbralAtrasoPct)
  const resumenPivot = Array.from(pivotMap.values()).sort((a, b) => {
    const byBucket = bucketOrder.indexOf(a.bucket_id) - bucketOrder.indexOf(b.bucket_id)
    if (byBucket !== 0) return byBucket
    return String(a.ruta_codigo).localeCompare(String(b.ruta_codigo))
  })

  const response = {
    ok: true,
    empresa,
    estadoFiltro: estadoRaw === 'TODOS' ? null : estadoRaw || 'PENDIENTE',
    filters: {
      dias_bucket: diasBucket,
      q: q || null,
      fecha_desde: fechaDesde || null,
      fecha_hasta: fechaHasta || null,
      rutas: rutasList.length ? rutasList : null,
      sort: sortKey,
    },
    kpis: {
      registros: totalFiltered,
      saldo_total: saldoTotal,
      abonos_total: abonosTotal,
      monto_total: montoTotal,
      dias_promedio: diasCount > 0 ? diasSum / diasCount : 0,
      vencidos_365: vencidos365,
      rutas_activas: rutasSet.size,
      requiere_atencion: requiereAtencion,
      requiere_atencion_pct:
        totalFiltered > 0 ? Math.round((requiereAtencion / totalFiltered) * 1000) / 10 : 0,
      pct_recuperado: montoTotal > 0 ? Math.round((abonosTotal / montoTotal) * 1000) / 10 : 0,
      saldo_mas_90: saldoMas90,
      saldo_mas_180: saldoMas180,
      notas_mas_90: notasMas90,
      notas_mas_180: notasMas180,
      atraso_estructural_clientes: atrasoEstructural.clientes_atraso,
      atraso_estructural_clientes_pct: atrasoEstructural.clientes_atraso_pct,
      atraso_estructural_saldo: atrasoEstructural.saldo_atraso_total,
      atraso_estructural_rutas: atrasoEstructural.rutas_atraso,
      atraso_estructural_rutas_pct: atrasoEstructural.rutas_atraso_pct,
    },
    atrasoEstructural,
    total: totalFiltered,
    truncated: totalFiltered > MAX_ROWS,
    maxRows: MAX_ROWS,
    porRuta,
    porAntiguedad,
    porCliente,
    porSituacion,
    resumenPivot,
    items,
  }

  if (debugEnabled) {
    const debugSample = items.slice(0, 20).map((it) => ({
      id: it.id,
      serie_folio: it.serie_folio,
      fecha_nota: it.fecha_nota,
      dias: it.dias,
      bucket_calculado: bucketIdFromDias(it.dias),
      ruta_codigo: it.ruta_codigo ?? null,
      saldo: Number(it.saldo || 0),
    }))
    const byBucket = {}
    for (const s of debugSample) {
      byBucket[s.bucket_calculado] = (byBucket[s.bucket_calculado] || 0) + 1
    }
    response.debug = {
      enabled: true,
      criterio: {
        dias: 'CURRENT_DATE - fecha_nota::date',
      },
      sample_size: debugSample.length,
      sample_by_bucket: byBucket,
      sample_rows: debugSample,
    }
  }

  return response
}
