/**
 * Lógica de parseo / validación / importación de reportes.
 * Validación canónica: shared/importValidation.js
 */
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import {
  EMPRESAS_VALIDAS,
  ESTADOS_VALIDOS,
  parseEmpresaImportacion,
  roundMoney,
  saldoFromMontoAbono,
  validateNormalized,
} from '../../../shared/importValidation.js'

export {
  EMPRESAS_VALIDAS,
  ESTADOS_VALIDOS,
  parseEmpresaImportacion,
  roundMoney,
  saldoFromMontoAbono,
  validateNormalized,
}

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
  const monto = roundMoney(toNum(pickField(row, ['monto', 'importe'])))
  const abono = roundMoney(toNum(pickField(row, ['abono', 'pago'])))
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

export function sampleCsv() {
  return [
    'serie_folio,cliente,empresa,ruta,monto,abono,fecha_nota,estado,usuario_vendedor_pv,requiere_atencion',
    'NC-0001,Cliente Demo,DISTRIBUIDORA,R01,1500.00,0.00,25/03/2026,PENDIENTE,vendedor_demo,false',
    'NC-0002,Cliente Demo 2,RODRIGO,R02,980.50,300.00,24/03/2026,RESUELTA,vendedor_demo,false',
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

export function normalizeRutaCodigo(codigoRaw) {
  return (
    String(codigoRaw || '')
      .trim()
      .toUpperCase() || 'SIN_RUTA'
  )
}

function rutaInsertPayload(finalCodigo) {
  const nombre =
    finalCodigo === 'SIN_RUTA' ? 'Sin ruta especificada' : `Ruta ${finalCodigo}`
  const descripcion =
    finalCodigo === 'SIN_RUTA'
      ? 'Creada automáticamente por importación (sin ruta en archivo)'
      : 'Creada automáticamente por importación'
  return { codigo: finalCodigo, nombre, descripcion, activa: true }
}

/** Resuelve códigos de ruta en lote (evita N+1 en importación). */
export async function ensureRutaIdsBatch(supabase, codigosRaw, rutaMap) {
  const pending = new Set()
  for (const raw of codigosRaw) {
    const c = normalizeRutaCodigo(raw)
    if (!rutaMap.has(c)) pending.add(c)
  }
  if (pending.size === 0) return

  const list = Array.from(pending)
  const inChunk = 100

  for (let i = 0; i < list.length; i += inChunk) {
    const chunk = list.slice(i, i + inChunk)
    const { data, error } = await supabase.from('rutas').select('id, codigo').in('codigo', chunk)
    if (error) throw new Error(error.message || 'No se pudo leer ruta')
    for (const r of data || []) {
      const c = String(r.codigo ?? '')
        .trim()
        .toUpperCase()
      if (c) rutaMap.set(c, r.id)
    }
  }

  let stillMissing = list.filter((c) => !rutaMap.has(c))
  if (stillMissing.length === 0) return

  for (const finalCodigo of stillMissing) {
    const { data: found2 } = await supabase
      .from('rutas')
      .select('id, codigo')
      .ilike('codigo', finalCodigo)
      .limit(1)
    const rid = found2?.[0]?.id
    if (rid != null) {
      rutaMap.set(finalCodigo, rid)
    }
  }

  stillMissing = list.filter((c) => !rutaMap.has(c))
  if (stillMissing.length === 0) return

  for (let i = 0; i < stillMissing.length; i += inChunk) {
    const chunk = stillMissing.slice(i, i + inChunk)
    const { data: ins, error: insErr } = await supabase
      .from('rutas')
      .insert(chunk.map((c) => rutaInsertPayload(c)))
      .select('id, codigo')
    if (insErr) {
      const { data: retry, error: retryErr } = await supabase
        .from('rutas')
        .select('id, codigo')
        .in('codigo', chunk)
      if (retryErr) throw new Error(insErr.message || 'No se pudo crear ruta')
      for (const r of retry || []) {
        const c = String(r.codigo ?? '')
          .trim()
          .toUpperCase()
        if (c) rutaMap.set(c, r.id)
      }
      continue
    }
    for (const r of ins || []) {
      const c = String(r.codigo ?? '')
        .trim()
        .toUpperCase()
      if (c) rutaMap.set(c, r.id)
    }
  }
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
  empresaScope,
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
    const scope = parseEmpresaImportacion(empresaScope)
    if (!scope) throw new Error('empresa_scope inválido o faltante (DISTRIBUIDORA o RODRIGO)')

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
    const stagedRows = []
    for (let i = 0; i < records.length; i += 1) {
      const raw = records[i]
      const rowNum = i + 2
      const row = normalizeRowWithMapping(raw, mapping)
      const rowErrors = validateNormalized(row, rutaMap, scope)
      if (rowErrors.length > 0) {
        if (errores.length < 100) errores.push(`Fila ${rowNum}: ${rowErrors.join('; ')}`)
        job.processed += 1
        job.errorCount += 1
        continue
      }
      stagedRows.push({ row })
    }

    await ensureRutaIdsBatch(
      supabase,
      stagedRows.map(({ row }) => row.rutaCodigo),
      rutaMap,
    )

    for (const { row } of stagedRows) {
      const finalCodigo = normalizeRutaCodigo(row.rutaCodigo)
      const rutaId = rutaMap.get(finalCodigo)
      if (rutaId == null) throw new Error(`No se pudo resolver ruta ${finalCodigo}`)

      const saldo = saldoFromMontoAbono(row.monto, row.abono)
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

    // Descarte solo para la empresa elegida y solo si hubo al menos una fila válida (evita marcar todo si el archivo viene vacío).
    // PostgREST limita filas por defecto (~1000): hay que paginar o el descarte queda incompleto vs el análisis previo.
    if (errores.length === 0 && validRows.length > 0) {
      const foliosEnArchivo = new Set()
      for (const row of validRows) {
        foliosEnArchivo.add(String(row.serie_folio || '').trim())
      }
      foliosEnArchivo.delete('')

      const pageSize = 1000
      let rangeFrom = 0
      const now = new Date().toISOString()

      while (true) {
        const { data: candidatos, error: cErr } = await supabase
          .from('notas_credito')
          .select('id, serie_folio')
          .eq('empresa', scope)
          .neq('estado', 'RESUELTA')
          .order('id', { ascending: true })
          .range(rangeFrom, rangeFrom + pageSize - 1)
        if (cErr) throw new Error(cErr.message || 'No se pudo leer notas para descarte')

        const pageRows = candidatos || []
        const idsToFix = pageRows
          .filter((c) => !foliosEnArchivo.has(String(c.serie_folio || '').trim()))
          .map((c) => c.id)

        for (const idChunk of chunkArray(idsToFix, 80)) {
          if (idChunk.length === 0) continue
          const { error: uErr } = await supabase
            .from('notas_credito')
            .update({
              estado: 'RESUELTA',
              fecha_resolucion: now,
              fecha_ultima_actualizacion: now,
              resuelta_automaticamente: true,
              requiere_atencion: false,
            })
            .in('id', idChunk)
          if (uErr) throw new Error(uErr.message || 'No se pudo aplicar descarte')
          resueltosPorDescarte += idChunk.length
          resueltos += idChunk.length
        }

        if (pageRows.length < pageSize) break
        rangeFrom += pageSize
      }
    }

    const estadoFinal = errores.length > 0 ? 'PARCIAL' : 'COMPLETADA'
    const aplicadas = nuevos + actualizados
    const obsLines = [
      `Importación CSV (${originalName})`,
      `empresa_importacion=${scope}`,
      `empresas=${Array.from(empresasImportadas).sort().join('|') || 'N/A'}`,
      resueltosPorDescarte > 0
        ? `Resumen: del archivo se aplicaron ${aplicadas} notas (${nuevos} nuevas, ${actualizados} actualizadas). ${resueltosPorDescarte} notas ya no figuraban en el reporte y quedaron RESUELTAS automáticamente.`
        : `Resumen: del archivo se aplicaron ${aplicadas} notas (${nuevos} nuevas, ${actualizados} actualizadas). Ninguna nota pendiente quedó RESUELTA por descarte.`,
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

export function buildPreviewPayload({ fileName, fileSize, records, mappingArg, rutaMap, empresaScope }) {
  const scope = parseEmpresaImportacion(empresaScope)
  if (!scope) throw new Error('Selecciona la empresa del reporte (DISTRIBUIDORA o RODRIGO)')

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
    const errors = validateNormalized(normalized, rutaMap, scope)
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
    empresa_importacion: scope,
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

/**
 * Solo lectura: estima impacto antes de importar (misma validación que la importación real).
 * Eficiencia: conteos en BD por chunks de folios; una pasada al archivo.
 */
export async function analizarImportacionPrevia({ supabase, records, mapping, empresaScope }) {
  const scope = parseEmpresaImportacion(empresaScope)
  if (!scope) throw new Error('Selecciona empresa (DISTRIBUIDORA o RODRIGO)')

  const { data: rutasR, error: rutasErr } = await supabase.from('rutas').select('id, codigo')
  if (rutasErr) throw new Error(rutasErr.message || 'No se pudieron cargar rutas')
  const rutaMap = buildRutaMapFromRows(rutasR)

  let filasConError = 0
  const foliosValidos = new Set()

  for (let i = 0; i < records.length; i += 1) {
    const row = normalizeRowWithMapping(records[i], mapping)
    const rowErrors = validateNormalized(row, rutaMap, scope)
    if (rowErrors.length > 0) {
      filasConError += 1
      continue
    }
    foliosValidos.add(String(row.serieFolio).trim())
  }

  const filasValidas = records.length - filasConError
  const foliosUnicos = Array.from(foliosValidos).filter(Boolean)
  const tieneErrores = filasConError > 0
  const sinFilasValidas = foliosUnicos.length === 0

  const { count: totalBase, error: c1 } = await supabase
    .from('notas_credito')
    .select('id', { count: 'exact', head: true })
    .eq('empresa', scope)
  if (c1) throw new Error(c1.message || 'No se pudo contar notas en base')

  const { count: abiertasBase, error: c2 } = await supabase
    .from('notas_credito')
    .select('id', { count: 'exact', head: true })
    .eq('empresa', scope)
    .neq('estado', 'RESUELTA')
  if (c2) throw new Error(c2.message || 'No se pudo contar notas abiertas')

  const totalBaseN = totalBase ?? 0
  const abiertasN = abiertasBase ?? 0

  const existingAny = new Set()
  const existingAbierta = new Set()
  for (const part of chunkArray(foliosUnicos, 80)) {
    if (part.length === 0) continue
    const { data, error: c3 } = await supabase
      .from('notas_credito')
      .select('serie_folio, estado')
      .eq('empresa', scope)
      .in('serie_folio', part)
    if (c3) throw new Error(c3.message || 'No se pudieron leer notas para el análisis')
    for (const r of data || []) {
      const f = String(r.serie_folio || '').trim()
      if (!f) continue
      existingAny.add(f)
      if (String(r.estado || '').toUpperCase() !== 'RESUELTA') existingAbierta.add(f)
    }
  }

  let nuevas = 0
  let actualizadas = 0
  let abiertasQueSiguenEnArchivo = 0
  for (const f of foliosUnicos) {
    if (existingAbierta.has(f)) abiertasQueSiguenEnArchivo += 1
    if (existingAny.has(f)) actualizadas += 1
    else nuevas += 1
  }

  const descarteAplica = !tieneErrores && !sinFilasValidas
  const resueltasPorDescarte = descarteAplica ? Math.max(0, abiertasN - abiertasQueSiguenEnArchivo) : null

  /** Filas en BD con ese folio presente en el archivo (cada folio es único por empresa). */
  const enBaseYEnArchivo = existingAny.size
  /** Total en base − las que sí aparecen en el archivo ≈ “las que ya no vienen en el reporte”. */
  const enBaseNoEnArchivo = Math.max(0, totalBaseN - enBaseYEnArchivo)
  /** Abiertas (≠ RESUELTA) cuyo folio no está en el archivo: únicas que el descarte puede cerrar. */
  const abiertasNoEnArchivo = Math.max(0, abiertasN - abiertasQueSiguenEnArchivo)
  /** Las demás “fuera del archivo” ya están RESUELTA; el descarte no las toca. */
  const yaResueltasNoEnArchivo = Math.max(0, enBaseNoEnArchivo - abiertasNoEnArchivo)

  return {
    ok: true,
    empresa: scope,
    archivo: {
      filas_totales: records.length,
      filas_validas: filasValidas,
      filas_con_error: filasConError,
      folios_unicos_validos: foliosUnicos.length,
    },
    base: {
      total_notas_empresa: totalBaseN,
      /** ≠ RESUELTA (PENDIENTE, CANCELADA, etc.): solo estas el descarte puede marcar RESUELTA. */
      notas_sin_estado_resuelta: abiertasN,
      notas_ya_resueltas: Math.max(0, totalBaseN - abiertasN),
    },
    comparacion: {
      notas_en_base_cuyo_folio_si_esta_en_archivo: enBaseYEnArchivo,
      notas_en_base_cuyo_folio_no_esta_en_archivo: enBaseNoEnArchivo,
      de_esas_ya_resueltas_sin_tocar: yaResueltasNoEnArchivo,
      de_esas_abiertas_se_marcarian_resueltas_si_aplica_descarte: abiertasNoEnArchivo,
    },
    estimado_al_importar: {
      nuevas,
      actualizadas,
      resueltas_por_descarte: resueltasPorDescarte,
      descarte_se_aplicaria: descarteAplica,
      nota_descarte: !descarteAplica
        ? tieneErrores
          ? 'Con errores de validación la importación quedaría PARCIAL y no se aplica descarte automático.'
          : 'Sin filas válidas no se aplica descarte (no hay lista de folios en el archivo para comparar).'
        : (resueltasPorDescarte ?? 0) > 0
          ? `Se marcarían ${resueltasPorDescarte} nota${resueltasPorDescarte === 1 ? '' : 's'} como RESUELTA por descarte (hoy sin RESUELTA y con folio que no viene en el archivo).`
          : enBaseNoEnArchivo > 0
            ? `Hay ${enBaseNoEnArchivo} nota${enBaseNoEnArchivo === 1 ? '' : 's'} en base cuyo folio no está en este archivo; ${yaResueltasNoEnArchivo} ya ${yaResueltasNoEnArchivo === 1 ? 'está' : 'están'} RESUELTA (el descarte no ${yaResueltasNoEnArchivo === 1 ? 'la' : 'las'} toca). Las ${abiertasN} sin RESUELTA tienen folio en el archivo, así que no queda ninguna abierta fuera del reporte y el descarte no cierra más.`
            : null,
    },
  }
}
