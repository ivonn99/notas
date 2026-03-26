import { Router } from 'express'
import multer from 'multer'
import { parse } from 'csv-parse/sync'
import crypto from 'node:crypto'
import XLSX from 'xlsx'
import path from 'node:path'

import { getPool } from '../db.js'
import { requireAuth, requireRoles } from '../middleware/auth.js'
import { logAudit } from '../services/audit.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })
const progressByImportId = new Map()
const EMPRESAS_VALIDAS = new Set(['DISTRIBUIDORA', 'RODRIGO'])
const ESTADOS_VALIDOS = new Set(['PENDIENTE', 'RESUELTA', 'CANCELADA'])

function toNum(value) {
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
  // Excel day 1 = 1899-12-31, with leap-year bug around 1900.
  const excelEpoch = Date.UTC(1899, 11, 30)
  const ms = excelEpoch + Math.floor(n) * 24 * 60 * 60 * 1000
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function parseDateToIso(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  const fromExcel = excelSerialToIsoDate(raw)
  if (fromExcel) return fromExcel

  // dd/mm/yyyy or dd-mm-yyyy
  let m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) {
    const day = Number(m[1])
    const month = Number(m[2])
    const year = Number(m[3])
    const d = new Date(Date.UTC(year, month - 1, day))
    if (
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month - 1 &&
      d.getUTCDate() === day
    ) {
      return d.toISOString().slice(0, 10)
    }
  }

  // yyyy-mm-dd or yyyy/mm/dd
  m = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (m) {
    const year = Number(m[1])
    const month = Number(m[2])
    const day = Number(m[3])
    const d = new Date(Date.UTC(year, month - 1, day))
    if (
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month - 1 &&
      d.getUTCDate() === day
    ) {
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
  const cliente = String(pickField(row, ['cliente', 'razon_social', 'razón_social'])).trim()
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

function parseMappingInput(raw) {
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

function normalizeRowWithMapping(row, mapping) {
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

function detectMappingFromHeaders(records) {
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

function validateNormalized(row, rutaMap) {
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

function sampleCsv() {
  return [
    'serie_folio,cliente,empresa,ruta,monto,abono,fecha_nota,estado,usuario_vendedor_pv,requiere_atencion',
    'NC-0001,Cliente Demo,DISTRIBUIDORA,R01,1500.00,0.00,25/03/2026,PENDIENTE,vendedor_demo,false',
    'NC-0002,Cliente Demo 2,RODRIGO,R02,980.50,300.00,24/03/2026,RESUELTA,vendedor_demo,true',
  ].join('\n')
}

function parseFlatFile(csvText) {
  const firstLine = String(csvText).split(/\r?\n/)[0] || ''
  const delimiter = firstLine.includes('\t') ? '\t' : ','
  return parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    delimiter,
  })
}

function parseRecordsFromUpload(fileBuffer, originalName) {
  const ext = path.extname(String(originalName || '')).toLowerCase()
  if (ext === '.xlsx' || ext === '.xls') {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' })
    const first = wb.SheetNames[0]
    if (!first) return []
    return XLSX.utils.sheet_to_json(wb.Sheets[first], { defval: '' })
  }
  return parseFlatFile(fileBuffer.toString('utf8'))
}

function parseProgressFromObservaciones(text) {
  const raw = String(text ?? '')
  const m = raw.match(/Procesando\s+(\d+)\s*\/\s*(\d+)/i)
  if (!m) return null
  const processed = Number.parseInt(m[1], 10)
  const total = Number.parseInt(m[2], 10)
  if (!Number.isFinite(processed) || !Number.isFinite(total) || total <= 0) {
    return null
  }
  return {
    processed,
    total,
    pct: Math.max(0, Math.min(100, Math.round((processed / total) * 100))),
  }
}

function parseEmpresasFromObservaciones(text) {
  const raw = String(text ?? '')
  const m = raw.match(/empresas\s*=\s*([A-Z_|,-]+)/i)
  if (!m) return []
  return String(m[1])
    .split(/[|,]/)
    .map((v) => String(v || '').trim().toUpperCase())
    .filter(Boolean)
}

async function runImportJob({
  importacionId,
  fileBuffer,
  originalName,
  userId,
  mapping,
}) {
  const job = progressByImportId.get(importacionId)
  if (!job) return

  const pool = getPool()
  let nuevos = 0
  let actualizados = 0
  let resueltos = 0
  let resueltosPorDescarte = 0
  const errores = []
  const empresasImportadas = new Set()

  try {
    const records = parseRecordsFromUpload(fileBuffer, originalName)
    job.total = records.length
    job.status = 'EN_PROCESO'

    const rutasR = await pool.query('SELECT id, codigo FROM rutas')
    const rutaMap = new Map(rutasR.rows.map((r) => [String(r.codigo).toUpperCase(), r.id]))
    const ensureRutaId = async (codigoRaw) => {
      const codigo = String(codigoRaw || '')
        .trim()
        .toUpperCase()
      const finalCodigo = codigo || 'SIN_RUTA'
      if (rutaMap.has(finalCodigo)) return rutaMap.get(finalCodigo)

      const existing = await pool.query(
        'SELECT id, codigo FROM rutas WHERE UPPER(TRIM(codigo)) = $1 LIMIT 1',
        [finalCodigo],
      )
      if (existing.rowCount > 0) {
        const id = existing.rows[0].id
        rutaMap.set(finalCodigo, id)
        return id
      }

      const created = await pool.query(
        `
        INSERT INTO rutas (codigo, nombre, descripcion, activa, created_at)
        VALUES ($1, $2, $3, true, NOW())
        RETURNING id
      `,
        [
          finalCodigo,
          finalCodigo === 'SIN_RUTA' ? 'Sin ruta especificada' : `Ruta ${finalCodigo}`,
          finalCodigo === 'SIN_RUTA'
            ? 'Creada automáticamente por importación (sin ruta en archivo)'
            : 'Creada automáticamente por importación',
        ],
      )
      const id = created.rows[0].id
      rutaMap.set(finalCodigo, id)
      return id
    }

    const usersR = await pool.query(
      'SELECT id, LOWER(TRIM(username)) AS u FROM usuarios WHERE TRIM(username) <> \'\'',
    )
    const userIdByLowerName = new Map(
      usersR.rows.filter((r) => r.u).map((r) => [r.u, r.id]),
    )

    const validRows = []
    for (let i = 0; i < records.length; i += 1) {
      const raw = records[i]
      const rowNum = i + 2 // +1 por headers y +1 por index 0
      const row = normalizeRowWithMapping(raw, mapping)
      const rowErrors = validateNormalized(row, rutaMap)
      if (rowErrors.length > 0) {
        if (errores.length < 100) errores.push(`Fila ${rowNum}: ${rowErrors.join('; ')}`)
        job.processed += 1
        job.errorCount += 1
        continue
      }

      const rutaId = await ensureRutaId(row.rutaCodigo)
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
        estado: 'PENDIENTE',
        ruta_id: rutaId,
        usuario_id: usuarioIdResolved,
        usuario_vendedor_pv: row.usuarioVendedorPv,
        requiere_atencion: row.requiereAtencion,
        resuelta_automaticamente: false,
      })
      empresasImportadas.add(row.empresa)
    }

    const chunkSize = 1000
    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize)
      const empresas = chunk.map((r) => r.empresa)
      const folios = chunk.map((r) => r.serie_folio)

      const prevR = await pool.query(
        `
        SELECT n.empresa, n.serie_folio, n.estado
        FROM notas_credito n
        JOIN unnest($1::text[], $2::text[]) AS k(empresa, serie_folio)
          ON n.empresa = k.empresa AND n.serie_folio = k.serie_folio
      `,
        [empresas, folios],
      )
      const prevByKey = new Map(
        prevR.rows.map((r) => [
          `${String(r.empresa).toUpperCase()}|${String(r.serie_folio).toUpperCase()}`,
          String(r.estado || '').toUpperCase(),
        ]),
      )
      for (const row of chunk) {
        const key = `${String(row.empresa).toUpperCase()}|${String(row.serie_folio).toUpperCase()}`
        const prevEstado = prevByKey.get(key)
        if (prevEstado == null) nuevos += 1
        else actualizados += 1
        if (row.estado === 'RESUELTA' && prevEstado !== 'RESUELTA') resueltos += 1
      }

      const upsertR = await pool.query(
        `
        WITH input AS (
          SELECT *
          FROM jsonb_to_recordset($1::jsonb) AS x(
            empresa text,
            serie_folio text,
            cliente text,
            monto numeric,
            abono numeric,
            saldo numeric,
            fecha_nota date,
            estado text,
            ruta_id integer,
            usuario_id bigint,
            usuario_vendedor_pv text,
            requiere_atencion boolean,
            resuelta_automaticamente boolean
          )
        )
        INSERT INTO notas_credito (
          empresa, serie_folio, cliente, monto, abono, saldo, estado,
          ruta_id, usuario_id, usuario_vendedor_pv, requiere_atencion,
          resuelta_automaticamente, fecha_nota, fecha_corriente,
          fecha_ultima_actualizacion, created_at
        )
        SELECT
          i.empresa, i.serie_folio, i.cliente, i.monto, i.abono, i.saldo, i.estado,
          i.ruta_id, i.usuario_id, i.usuario_vendedor_pv, i.requiere_atencion,
          i.resuelta_automaticamente, i.fecha_nota, NOW(), NOW(), NOW()
        FROM input i
        ON CONFLICT (empresa, serie_folio)
        DO UPDATE SET
          cliente = EXCLUDED.cliente,
          monto = EXCLUDED.monto,
          abono = EXCLUDED.abono,
          saldo = EXCLUDED.saldo,
          fecha_nota = EXCLUDED.fecha_nota,
          estado = EXCLUDED.estado,
          fecha_ultima_actualizacion = NOW(),
          fecha_resolucion = CASE WHEN EXCLUDED.estado = 'RESUELTA' THEN NOW() ELSE NULL END,
          ruta_id = EXCLUDED.ruta_id,
          usuario_id = COALESCE(EXCLUDED.usuario_id, notas_credito.usuario_id),
          usuario_vendedor_pv = EXCLUDED.usuario_vendedor_pv,
          requiere_atencion = EXCLUDED.requiere_atencion,
          resuelta_automaticamente = EXCLUDED.resuelta_automaticamente
        RETURNING id
      `,
        [JSON.stringify(chunk)],
      )

      job.processed += chunk.length
      if (upsertR.rowCount > 0) {
        await pool.query(
          `
          UPDATE importaciones
          SET total_registros = $1,
              registros_nuevos = $2,
              registros_actualizados = $3,
              registros_resueltos = $4,
              observaciones = $5
          WHERE id = $6
        `,
          [
            records.length,
            nuevos,
            actualizados,
            resueltos,
            `Procesando ${job.processed}/${records.length} — ${originalName}`,
            importacionId,
          ],
        )
      }
    }

    // Regla de negocio: comparación de matriz contra matriz.
    // Si una nota existente ya no viene en el nuevo reporte de la misma empresa,
    // se marca como RESUELTA por descarte (solo si no hubo errores de validación).
    if (errores.length === 0 && empresasImportadas.size > 0) {
      const seriesByEmpresa = new Map()
      for (const row of validRows) {
        const emp = String(row.empresa || '').toUpperCase()
        if (!seriesByEmpresa.has(emp)) seriesByEmpresa.set(emp, new Set())
        seriesByEmpresa.get(emp).add(String(row.serie_folio || '').trim())
      }

      for (const [empresa, serieSet] of seriesByEmpresa.entries()) {
        const series = Array.from(serieSet).filter(Boolean)
        const upd = await pool.query(
          `
          UPDATE notas_credito n
          SET
            estado = 'RESUELTA',
            fecha_resolucion = NOW(),
            fecha_ultima_actualizacion = NOW(),
            resuelta_automaticamente = true
          WHERE n.empresa = $1
            AND n.estado <> 'RESUELTA'
            AND NOT EXISTS (
              SELECT 1
              FROM unnest($2::text[]) AS t(serie_folio)
              WHERE t.serie_folio = n.serie_folio
            )
        `,
          [empresa, series],
        )
        const changed = Number(upd.rowCount || 0)
        resueltosPorDescarte += changed
        resueltos += changed
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

    await pool.query(
      `
      UPDATE importaciones
      SET total_registros = $1,
          registros_nuevos = $2,
          registros_actualizados = $3,
          registros_resueltos = $4,
          estado = $5,
          observaciones = $6
      WHERE id = $7
    `,
      [
        records.length,
        nuevos,
        actualizados,
        resueltos,
        estadoFinal,
        obsLines.join('\n'),
        importacionId,
      ],
    )

    await logAudit({
      accion: 'importacion.finalizada',
      entidad: 'importaciones',
      entidadId: importacionId,
      usuarioId: userId,
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

    job.status = estadoFinal
    job.done = true
    job.errorCount = errores.length
  } catch (e) {
    const msg = e?.message || 'Error inesperado en importación'
    await pool.query(
      `
      UPDATE importaciones
      SET estado = 'FALLIDA',
          observaciones = $1
      WHERE id = $2
    `,
      [`FALLIDA: ${msg}`, importacionId],
    )
    await logAudit({
      accion: 'importacion.fallida',
      entidad: 'importaciones',
      entidadId: importacionId,
      usuarioId: userId,
      detalle: { archivo: originalName, error: msg },
    })
    job.status = 'FALLIDA'
    job.done = true
    job.error = msg
  } finally {
    job.finishedAt = new Date().toISOString()
    setTimeout(() => {
      progressByImportId.delete(importacionId)
    }, 10 * 60 * 1000)
  }
}

router.get('/', requireAuth, requireRoles('ADMIN'), async (_req, res, next) => {
  try {
    const pool = getPool()
    const r = await pool.query(
      `
      SELECT
        i.id, i.nombre_archivo, i.total_registros, i.registros_nuevos,
        i.registros_actualizados, i.registros_resueltos, i.estado,
        i.observaciones, i.created_at,
        u.username AS usuario_username,
        u.nombre_completo AS usuario_nombre
      FROM importaciones i
      LEFT JOIN usuarios u ON u.id = i.usuario_id
      ORDER BY i.created_at DESC, i.id DESC
      LIMIT 200
    `,
    )
    const items = r.rows.map((it) => ({
      ...it,
      empresas_importadas: parseEmpresasFromObservaciones(it.observaciones),
    }))
    res.json({ ok: true, items })
  } catch (e) {
    next(e)
  }
})

router.get('/muestra', requireAuth, requireRoles('ADMIN'), (_req, res) => {
  const csv = sampleCsv()
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="muestra_importacion_notas.csv"')
  res.send(csv)
})

router.post(
  '/preview',
  requireAuth,
  requireRoles('ADMIN'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'Archivo requerido (campo file)' })
      }
      const records = parseRecordsFromUpload(req.file.buffer, req.file.originalname)
      const pool = getPool()
      const rutasR = await pool.query('SELECT id, codigo FROM rutas')
      const rutaMap = new Map(rutasR.rows.map((r) => [String(r.codigo).toUpperCase(), r.id]))
      const { headers, mapping: autoMapping } = detectMappingFromHeaders(records)
      const reqMapping = parseMappingInput(req.body?.mapping)
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

      return res.json({
        ok: true,
        file: {
          name: req.file.originalname,
          size: req.file.size || null,
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
      })
    } catch (e) {
      next(e)
    }
  },
)

router.get('/:id/progreso', requireAuth, requireRoles('ADMIN'), async (req, res, next) => {
  try {
    const id = Number.parseInt(String(req.params.id ?? ''), 10)
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'ID inválido' })
    }
    const inMemory = progressByImportId.get(id)
    if (inMemory) {
      const pct =
        inMemory.total > 0
          ? Math.max(
              0,
              Math.min(100, Math.round((inMemory.processed / inMemory.total) * 100)),
            )
          : 0
      return res.json({
        ok: true,
        inMemory: true,
        pct,
        ...inMemory,
      })
    }

    const pool = getPool()
    const r = await pool.query(
      `
      SELECT id, estado, total_registros, registros_nuevos, registros_actualizados,
             registros_resueltos, observaciones, created_at
      FROM importaciones
      WHERE id = $1
      LIMIT 1
    `,
      [id],
    )
    if (r.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Importación no encontrada' })
    }
    const imp = r.rows[0]
    const parsed = parseProgressFromObservaciones(imp.observaciones)
    const done = ['COMPLETADA', 'PARCIAL', 'FALLIDA'].includes(
      String(imp.estado ?? '').toUpperCase(),
    )

    return res.json({
      ok: true,
      inMemory: false,
      progress: {
        id: imp.id,
        status: imp.estado,
        total: parsed?.total ?? imp.total_registros ?? 0,
        processed:
          parsed?.processed ??
          (imp.registros_nuevos || 0) + (imp.registros_actualizados || 0),
        errorCount: 0,
        pct: parsed?.pct ?? (done ? 100 : 0),
        done,
      },
      importacion: imp,
    })
  } catch (e) {
    next(e)
  }
})

router.get('/:id/errores-txt', requireAuth, requireRoles('ADMIN'), async (req, res, next) => {
  try {
    const id = Number.parseInt(String(req.params.id ?? ''), 10)
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'ID inválido' })
    }
    const pool = getPool()
    const r = await pool.query(
      'SELECT id, estado, observaciones, nombre_archivo FROM importaciones WHERE id = $1 LIMIT 1',
      [id],
    )
    if (r.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Importación no encontrada' })
    }
    const imp = r.rows[0]
    const lines = String(imp.observaciones || '')
      .split(/\r?\n/)
      .filter((l) => l.trim().startsWith('Fila '))
    const content = [
      `Importación #${imp.id} (${imp.estado})`,
      `Archivo: ${imp.nombre_archivo || '-'}`,
      '',
      ...(lines.length > 0 ? lines : ['Sin errores por fila.']),
    ].join('\n')
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="errores_importacion_${id}.txt"`)
    res.send(content)
  } catch (e) {
    next(e)
  }
})

router.post(
  '/upload',
  requireAuth,
  requireRoles('ADMIN'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'Archivo requerido (campo file)' })
      }
      const pool = getPool()
      const importacionR = await pool.query(
        `
        INSERT INTO importaciones (
          nombre_archivo, total_registros, registros_nuevos, registros_actualizados,
          registros_resueltos, estado, observaciones, created_at, usuario_id
        ) VALUES (
          $1, 0, 0, 0, 0, 'EN_PROCESO', $2, NOW(), $3
        )
        RETURNING id
      `,
        [
          req.file.originalname,
          `Inicio de importación ${new Date().toISOString()}`,
          req.user.sub,
        ],
      )
      const importacionId = importacionR.rows[0].id
      await logAudit({
        req,
        accion: 'importacion.iniciada',
        entidad: 'importaciones',
        entidadId: importacionId,
        detalle: { archivo: req.file.originalname },
      })
      const token = crypto.randomUUID()
      progressByImportId.set(importacionId, {
        id: importacionId,
        token,
        status: 'EN_PROCESO',
        total: 0,
        processed: 0,
        errorCount: 0,
        startedAt: new Date().toISOString(),
        done: false,
      })

      runImportJob({
        importacionId,
        fileBuffer: req.file.buffer,
        originalName: req.file.originalname,
        userId: req.user.sub,
        mapping: parseMappingInput(req.body?.mapping),
      }).catch((err) => {
        console.error('[importaciones] runImportJob:', err)
      })

      res.json({
        ok: true,
        importacionId,
        status: 'EN_PROCESO',
      })
    } catch (e) {
      next(e)
    }
  },
)

export default router
