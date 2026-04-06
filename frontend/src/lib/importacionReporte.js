/**
 * Lógica de parseo / validación / importación de reportes (antes en API Node).
 * Con Supabase, corre en el navegador con el cliente autenticado (RLS).
 */
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export const EMPRESAS_VALIDAS = new Set(['DISTRIBUIDORA', 'RODRIGO'])
export const ESTADOS_VALIDOS = new Set(['PENDIENTE', 'RESUELTA', 'CANCELADA'])

export function toNum(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : null
}

function toBool(value) {
  const s = String(value ?? '').trim().toLowerCase()
  return ['1', 'true', 'si', 'sí', 'yes', 'y'].includes(s)
}

function excelSerialToIsoDate(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  if (n < 1 || n > 100000) return null
  const excelEpoch = Date.UTC(1899, 11, 30)
  const ms = excelEpoch + Math.floor(n) * 24 * 60 * 60 * 1000
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

export function parseDateToIso(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  const fromExcel = excelSerialToIsoDate(raw)
  if (fromExcel) return fromExcel

  let m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) {
    const day = Number(m[1])
    const month = Number(m[2])
    const year = Number(m[3])
    const d = new Date(Date.UTC(year, month - 1, day))
    if (d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day) {
      return d.toISOString().slice(0, 10)
    }
  }

  m = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (m) {
    const year = Number(m[1])
    const month = Number(m[2])
    const day = Number(m[3])
    const d = new Date(Date.UTC(year, month - 1, day))
    if (d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day) {
      return d.toISOString().slice(0, 10)
    }
  }

  return null
}

function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function pickField(row, aliases, fallback = '') {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) {
      return row[alias]
    }
  }
  const wanted = new Set(aliases.map(normalizeKey))
  for (const [k, v] of Object.entries(row || {})) {
    if (wanted.has(normalizeKey(k))) return v
  }
  return fallback
}

function normalizeRow(row) {
  const serieFolio = String(
    pickField(row, ['serie_folio', 'serie', 'folio', 'serie/folio', 'serie_folio']),
  ).trim()
  const empresa = String(pickField(row, ['empresa'], 'DISTRIBUIDORA'))
    .trim()
    .toUpperCase()
  const cliente = String(
    pickField(row, ['cliente', 'razon_social', 'razón_social', 'razon social', 'razón social']),
  ).trim()
  const estadoRaw = String(pickField(row, ['estado'], 'PENDIENTE'))
    .trim()
    .toUpperCase()
  const estado = estadoRaw || 'PENDIENTE'
  const rutaCodigo = String(pickField(row, ['ruta', 'rutas', 'ruta_codigo']))
    .trim()
    .toUpperCase()
  const usuarioVendedorPv = String(
    pickField(row, ['usuario_vendedor_pv', 'vendedor', 'usuario_vendedor', 'usuario/vendedor']),
  ).trim()
  const monto = toNum(pickField(row, ['monto', 'importe']))
  const abono = toNum(pickField(row, ['abono', 'pago']))
  const fechaNota = parseDateToIso(
    pickField(row, ['fecha_nota', 'fecha nota', 'fecha', 'fecha_documento']),
  )
  const requiereAtencion = toBool(
    pickField(row, ['requiere_atencion', 'requiereatencion', 'atencion']),
  )
  return {
    serieFolio,
    empresa,
    cliente,
    estado,
    rutaCodigo,
    usuarioVendedorPv,
    monto,
    abono,
    fechaNota,
    requiereAtencion,
  }
}

export function parseMappingInput(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return null
}

export function normalizeRowWithMapping(row, mapping) {
  if (!mapping) return normalizeRow(row)
  const get = (key) => {
    const col = mapping?.[key]
    if (!col) return ''
    return row?.[col]
  }
  return normalizeRow({
    serie_folio: get('serie_folio'),
    cliente: get('cliente'),
    empresa: get('empresa'),
    ruta: get('ruta'),
    monto: get('monto'),
    abono: get('abono'),
    fecha_nota: get('fecha_nota'),
    estado: get('estado'),
    usuario_vendedor_pv: get('usuario_vendedor_pv'),
    requiere_atencion: get('requiere_atencion'),
  })
}

export function detectMappingFromHeaders(records) {
  const first = records?.[0] || {}
  const headers = Object.keys(first)
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase())
  const mapping = {
    serie_folio: null,
    cliente: null,
    empresa: null,
    ruta: null,
    monto: null,
    abono: null,
    fecha_nota: null,
    estado: null,
    usuario_vendedor_pv: null,
    requiere_atencion: null,
  }
  const aliases = {
    serie_folio: ['serie_folio', 'serie', 'folio', 'serie/folio', 'seriefolio'],
    cliente: ['cliente', 'razon_social', 'razón_social'],
    empresa: ['empresa'],
    ruta: ['ruta', 'rutas', 'ruta_codigo'],
    monto: ['monto', 'importe'],
    abono: ['abono', 'pago'],
    fecha_nota: ['fecha_nota', 'fecha nota', 'fecha', 'fecha_documento'],
    estado: ['estado'],
    usuario_vendedor_pv: [
      'usuario_vendedor_pv',
      'vendedor',
      'usuario_vendedor',
      'usuario/vendedor',
      'usuariovendedor',
    ],
    requiere_atencion: ['requiere_atencion', 'requiereatencion', 'atencion'],
  }
  for (const [field, list] of Object.entries(aliases)) {
    const idx = normalizedHeaders.findIndex((h) => list.includes(h))
    if (idx >= 0) mapping[field] = headers[idx]
  }
  return { headers, mapping }
}

export function validateNormalized(row, _rutaMap) {
  const errors = []
  if (!row.serieFolio) errors.push('serie_folio obligatorio')
  if (!row.empresa) errors.push('empresa obligatoria')
  if (row.empresa && !EMPRESAS_VALIDAS.has(row.empresa)) {
    errors.push(`empresa inválida: ${row.empresa}`)
  }
  if (row.estado && !ESTADOS_VALIDOS.has(row.estado)) {
    errors.push(`estado inválido: ${row.estado}`)
  }
  if (row.monto == null) errors.push('monto inválido')
  if (row.abono == null) errors.push('abono inválido')
  if (!row.fechaNota) errors.push('fecha_nota inválida (usa dd/mm/aaaa o yyyy-mm-dd)')
  return errors
}

export function sampleCsv() {
  return [
    'serie_folio,cliente,empresa,ruta,monto,abono,fecha_nota,estado,usuario_vendedor_pv,requiere_atencion',
    'NC-0001,Cliente Demo,DISTRIBUIDORA,R01,1500.00,0.00,25/03/2026,PENDIENTE,vendedor_demo,false',
    'NC-0002,Cliente Demo 2,RODRIGO,R02,980.50,300.00,24/03/2026,RESUELTA,vendedor_demo,true',
  ].join('\n')
}

function parseFlatFile(csvText) {
  const firstLine = String(csvText).split(/\r?\n/)[0] || ''
  const delimiter = firstLine.includes('\t') ? '\t' : ','
  const r = Papa.parse(String(csvText), {
    header: true,
    skipEmptyLines: 'greedy',
    delimiter,
    transformHeader: (h) => String(h ?? '').trim(),
  })
  const rows = r.data || []
  return rows.filter((row) => row && typeof row === 'object' && Object.keys(row).some((k) => String(row[k] ?? '').trim() !== ''))
}

export async function parseRecordsFromFile(file) {
  const name = file?.name || ''
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : ''
  if (ext === '.xlsx' || ext === '.xls') {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const first = wb.SheetNames[0]
    if (!first) return []
    return XLSX.utils.sheet_to_json(wb.Sheets[first], { defval: '' })
  }
  const text = await file.text()
  return parseFlatFile(text)
}

export function buildRutaMapFromRows(rutasRows) {
  const rutaMap = new Map()
  for (const r of rutasRows || []) {
    const c = String(r.codigo ?? '')
      .trim()
      .toUpperCase()
    if (c) rutaMap.set(c, r.id)
  }
  return rutaMap
}

async function ensureRutaId(supabase, codigoRaw, rutaMap) {
  const finalCodigo = String(codigoRaw || '')
    .trim()
    .toUpperCase() || 'SIN_RUTA'
  if (rutaMap.has(finalCodigo)) return rutaMap.get(finalCodigo)

  const { data: found, error: selErr } = await supabase
    .from('rutas')
    .select('id')
    .eq('codigo', finalCodigo)
    .limit(1)
  if (selErr) throw new Error(selErr.message || 'No se pudo leer ruta')
  let rid = found?.[0]?.id
  if (rid == null) {
    const { data: found2 } = await supabase.from('rutas').select('id').ilike('codigo', finalCodigo).limit(1)
    rid = found2?.[0]?.id
  }
  if (rid != null) {
    rutaMap.set(finalCodigo, rid)
    return rid
  }

  const nombre =
    finalCodigo === 'SIN_RUTA' ? 'Sin ruta especificada' : `Ruta ${finalCodigo}`
  const descripcion =
    finalCodigo === 'SIN_RUTA'
      ? 'Creada automáticamente por importación (sin ruta en archivo)'
      : 'Creada automáticamente por importación'

  const { data: ins, error: insErr } = await supabase
    .from('rutas')
    .insert({
      codigo: finalCodigo,
      nombre,
      descripcion,
      activa: true,
    })
    .select('id')
    .limit(1)
  if (insErr) throw new Error(insErr.message || 'No se pudo crear ruta')
  const id = ins?.[0]?.id
  if (id == null) throw new Error('Ruta insertada sin id')
  rutaMap.set(finalCodigo, id)
  return id
}

async function fetchPrevEstados(supabase, chunk) {
  const byEmp = new Map()
  for (const row of chunk) {
    const emp = String(row.empresa || '').toUpperCase()
    const fol = String(row.serie_folio || '').trim()
    if (!emp || !fol) continue
    if (!byEmp.has(emp)) byEmp.set(emp, new Set())
    byEmp.get(emp).add(fol)
  }
  const prevByKey = new Map()
  for (const [empresa, folios] of byEmp.entries()) {
    const list = Array.from(folios)
    const chunkFolios = []
    for (let i = 0; i < list.length; i += 80) {
      chunkFolios.push(list.slice(i, i + 80))
    }
    for (const part of chunkFolios) {
      if (part.length === 0) continue
      const { data, error } = await supabase
        .from('notas_credito')
        .select('empresa, serie_folio, estado')
        .eq('empresa', empresa)
        .in('serie_folio', part)
      if (error) throw new Error(error.message || 'No se pudieron leer notas previas')
      for (const r of data || []) {
        const key = `${String(r.empresa).toUpperCase()}|${String(r.serie_folio).toUpperCase()}`
        prevByKey.set(key, String(r.estado || '').toUpperCase())
      }
    }
  }
  return prevByKey
}

function chunkArray(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function registrarAuditoria(supabase, { usuarioId, username, accion, entidad, entidadId, detalle }) {
  try {
    await supabase.from('auditoria_eventos').insert({
      usuario_id: usuarioId,
      username: username || null,
      accion,
      entidad,
      entidad_id: entidadId != null ? String(entidadId) : null,
      detalle: detalle || null,
    })
  } catch {
    /* no bloquear importación */
  }
}

/**
 * Procesa el archivo en segundo plano (actualiza fila `importaciones` y notas).
 */
export async function ejecutarImportacionSupabase({
  supabase,
  importacionId,
  records,
  originalName,
  usuarioId,
  username,
  mapping,
}) {
  const job = { total: records.length, processed: 0, errorCount: 0 }
  let nuevos = 0
  let actualizados = 0
  let resueltos = 0
  let resueltosPorDescarte = 0
  const errores = []
  const empresasImportadas = new Set()

  const obsProg = (extra = '') =>
    `Procesando ${job.processed}/${records.length}${extra ? ` — ${extra}` : ''}`

  async function touchImportacion(partial) {
    await supabase.from('importaciones').update(partial).eq('id', importacionId)
  }

  try {
    /** Igual que el API Node al insertar: NOW() para fechas obligatorias. */
    const importNow = new Date().toISOString()

    const { data: rutasR, error: rutasErr } = await supabase.from('rutas').select('id, codigo')
    if (rutasErr) throw new Error(rutasErr.message || 'No se pudieron cargar rutas')
    const rutaMap = buildRutaMapFromRows(rutasR)

    const { data: usersR, error: usersErr } = await supabase.from('usuarios').select('id, username')
    if (usersErr) throw new Error(usersErr.message || 'No se pudieron cargar usuarios')
    const userIdByLowerName = new Map()
    for (const r of usersR || []) {
      const u = String(r.username ?? '')
        .trim()
        .toLowerCase()
      if (u) userIdByLowerName.set(u, r.id)
    }

    const validRows = []
    for (let i = 0; i < records.length; i += 1) {
      const raw = records[i]
      const rowNum = i + 2
      const row = normalizeRowWithMapping(raw, mapping)
      const rowErrors = validateNormalized(row, rutaMap)
      if (rowErrors.length > 0) {
        if (errores.length < 100) errores.push(`Fila ${rowNum}: ${rowErrors.join('; ')}`)
        job.processed += 1
        job.errorCount += 1
        continue
      }

      const rutaId = await ensureRutaId(supabase, row.rutaCodigo, rutaMap)
      const saldo = row.monto - row.abono
      const uKey = String(row.usuarioVendedorPv || '')
        .trim()
        .toLowerCase()
      const usuarioIdResolved = uKey ? userIdByLowerName.get(uKey) ?? null : null
      validRows.push({
        empresa: row.empresa,
        serie_folio: row.serieFolio,
        cliente: row.cliente,
        monto: row.monto,
        abono: row.abono,
        saldo,
        fecha_nota: row.fechaNota,
        fecha_corriente: importNow,
        fecha_ultima_actualizacion: importNow,
        estado: 'PENDIENTE',
        ruta_id: rutaId,
        usuario_id: usuarioIdResolved,
        usuario_vendedor_pv: row.usuarioVendedorPv,
        requiere_atencion: row.requiereAtencion,
        resuelta_automaticamente: false,
      })
      empresasImportadas.add(row.empresa)
    }

    const chunkSize = 150
    const chunks = chunkArray(validRows, chunkSize)

    for (const chunk of chunks) {
      const chunkNow = new Date().toISOString()
      const prevByKey = await fetchPrevEstados(supabase, chunk)
      for (const row of chunk) {
        const key = `${String(row.empresa).toUpperCase()}|${String(row.serie_folio).toUpperCase()}`
        const prevEstado = prevByKey.get(key)
        if (prevEstado == null) nuevos += 1
        else actualizados += 1
      }

      const chunkPayload = chunk.map((r) => ({
        ...r,
        fecha_ultima_actualizacion: chunkNow,
      }))

      const { error: upErr } = await supabase.from('notas_credito').upsert(chunkPayload, {
        onConflict: 'empresa,serie_folio',
      })
      if (upErr) throw new Error(upErr.message || 'Error al guardar notas')

      job.processed += chunk.length
      await touchImportacion({
        total_registros: records.length,
        registros_nuevos: nuevos,
        registros_actualizados: actualizados,
        registros_resueltos: resueltos,
        observaciones: `${obsProg(originalName)}`,
      })
    }

    if (errores.length === 0 && empresasImportadas.size > 0) {
      const seriesByEmpresa = new Map()
      for (const row of validRows) {
        const emp = String(row.empresa || '').toUpperCase()
        if (!seriesByEmpresa.has(emp)) seriesByEmpresa.set(emp, new Set())
        seriesByEmpresa.get(emp).add(String(row.serie_folio || '').trim())
      }

      for (const [empresa, serieSet] of seriesByEmpresa.entries()) {
        const series = Array.from(serieSet).filter(Boolean)
        const { data: candidatos, error: cErr } = await supabase
          .from('notas_credito')
          .select('id, serie_folio')
          .eq('empresa', empresa)
          .neq('estado', 'RESUELTA')
        if (cErr) throw new Error(cErr.message || 'No se pudo leer notas para descarte')
        const idsToFix = (candidatos || [])
          .filter((c) => !series.includes(String(c.serie_folio || '').trim()))
          .map((c) => c.id)
        const now = new Date().toISOString()
        for (const idChunk of chunkArray(idsToFix, 80)) {
          if (idChunk.length === 0) continue
          const { error: uErr } = await supabase
            .from('notas_credito')
            .update({
              estado: 'RESUELTA',
              fecha_resolucion: now,
              fecha_ultima_actualizacion: now,
              resuelta_automaticamente: true,
            })
            .in('id', idChunk)
          if (uErr) throw new Error(uErr.message || 'No se pudo aplicar descarte')
          resueltosPorDescarte += idChunk.length
          resueltos += idChunk.length
        }
      }
    }

    const estadoFinal = errores.length > 0 ? 'PARCIAL' : 'COMPLETADA'
    const obsLines = [
      `Importación CSV (${originalName})`,
      `empresas=${Array.from(empresasImportadas).sort().join('|') || 'N/A'}`,
      `nuevos=${nuevos}, actualizados=${actualizados}, resueltos=${resueltos}, resueltos_descarte=${resueltosPorDescarte}, errores=${errores.length}`,
    ]
    if (errores.length > 0) {
      obsLines.push('Errores (máx 100):')
      obsLines.push(...errores)
    }

    await touchImportacion({
      total_registros: records.length,
      registros_nuevos: nuevos,
      registros_actualizados: actualizados,
      registros_resueltos: resueltos,
      estado: estadoFinal,
      observaciones: obsLines.join('\n'),
    })

    await registrarAuditoria(supabase, {
      usuarioId,
      username,
      accion: 'importacion.finalizada',
      entidad: 'importaciones',
      entidadId: importacionId,
      detalle: {
        archivo: originalName,
        estado: estadoFinal,
        total: records.length,
        nuevos,
        actualizados,
        resueltos,
        errores: errores.length,
      },
    })
  } catch (e) {
    const msg = e?.message || 'Error inesperado en importación'
    await touchImportacion({
      estado: 'FALLIDA',
      observaciones: `FALLIDA: ${msg}`,
    })
    await registrarAuditoria(supabase, {
      usuarioId,
      username,
      accion: 'importacion.fallida',
      entidad: 'importaciones',
      entidadId: importacionId,
      detalle: { archivo: originalName, error: msg },
    })
  }
}

export function buildPreviewPayload({ fileName, fileSize, records, mappingArg, rutaMap }) {
  const { headers, mapping: autoMapping } = detectMappingFromHeaders(records)
  const reqMapping = parseMappingInput(mappingArg)
  const activeMapping = reqMapping || autoMapping

  const previewRows = []
  let validCount = 0
  let invalidCount = 0
  const maxPreview = Math.min(records.length, 30)
  for (let i = 0; i < maxPreview; i += 1) {
    const raw = records[i]
    const normalized = normalizeRowWithMapping(raw, activeMapping)
    const errors = validateNormalized(normalized, rutaMap)
    if (errors.length > 0) invalidCount += 1
    else validCount += 1
    previewRows.push({
      rowNumber: i + 2,
      raw,
      normalized,
      errors,
    })
  }

  return {
    ok: true,
    file: {
      name: fileName,
      size: fileSize ?? null,
      records: records.length,
    },
    headers,
    mapping: activeMapping,
    autoMapping,
    preview: {
      rows: previewRows,
      validCount,
      invalidCount,
      checkedRows: maxPreview,
    },
  }
}
