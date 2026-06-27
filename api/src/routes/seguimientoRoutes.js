import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'

import { getPool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { logAudit } from '../services/audit.js'
import {
  canManageNotaEstado,
  canManageNotaRuta,
  shouldSetRequiereAtencionOnComment,
} from '../../../shared/notasNegocio.js'

const router = Router()
const uploadsDir = path.resolve(process.cwd(), 'uploads', 'documentos')
fs.mkdirSync(uploadsDir, { recursive: true })
const upload = multer({ dest: uploadsDir })

const ROLES_CAMBIO_ESTADO = new Set(['ADMIN', 'CREDITO'])
const ROLES_CAMBIO_RUTA = new Set(['ADMIN'])
const ESTADOS_VALIDOS = new Set(['PENDIENTE', 'RESUELTA', 'CANCELADA'])

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function canManageState(user) {
  return canManageNotaEstado(user)
}

function canManageRoute(user) {
  return canManageNotaRuta(user)
}

/** Orden SQL permitido (evita inyección). Clave = query param `sort`. */
const SEGUIMIENTO_ORDER_BY = {
  fecha_ultima_desc: 'n.fecha_ultima_actualizacion DESC NULLS LAST, n.id DESC',
  fecha_ultima_asc: 'n.fecha_ultima_actualizacion ASC NULLS LAST, n.id ASC',
  // Compatibilidad: si llega el sort viejo de fecha_corriente, usar fecha_nota.
  fecha_corriente_desc: 'n.fecha_nota::date DESC NULLS LAST, n.id DESC',
  fecha_corriente_asc: 'n.fecha_nota::date ASC NULLS LAST, n.id ASC',
  fecha_nota_desc: 'n.fecha_nota::date DESC NULLS LAST, n.id DESC',
  fecha_nota_asc: 'n.fecha_nota::date ASC NULLS LAST, n.id ASC',
  dias_corriente_desc: '(CURRENT_DATE - n.fecha_nota::date) DESC NULLS LAST, n.id DESC',
  dias_corriente_asc: '(CURRENT_DATE - n.fecha_nota::date) ASC NULLS LAST, n.id ASC',
}

function whereByRole(user, params) {
  if (!user.isSuperuser && user.rol === 'VENDEDOR') {
    params.push(user.sub)
    return `
      EXISTS (
        SELECT 1
        FROM usuario_rutas ur
        WHERE ur.usuario_id = $${params.length} AND ur.ruta_id = n.ruta_id
      )
    `
  }
  return 'TRUE'
}

function parseRutasList(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return []
  return [...new Set(s.split(',').map((part) => part.trim().toUpperCase()).filter(Boolean))]
}

const DIAS_BUCKET_IDS = new Set(['r1', 'r2', 'r2b', 'r3', 'r4', 'r5', 'r6'])

function parseDiasBucketsList(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return []
  return [
    ...new Set(
      s
        .split(',')
        .map((part) => part.trim().toLowerCase())
        .filter((id) => DIAS_BUCKET_IDS.has(id)),
    ),
  ]
}

function diasBucketWhere(bucket) {
  switch (bucket) {
    case 'r1':
      return `n.fecha_nota IS NOT NULL AND n.fecha_nota::date >= (CURRENT_DATE - INTERVAL '30 days')::date`
    case 'r2':
      return `n.fecha_nota IS NOT NULL AND n.fecha_nota::date >= (CURRENT_DATE - INTERVAL '45 days')::date AND n.fecha_nota::date < (CURRENT_DATE - INTERVAL '30 days')::date`
    case 'r2b':
      return `n.fecha_nota IS NOT NULL AND n.fecha_nota::date >= (CURRENT_DATE - INTERVAL '60 days')::date AND n.fecha_nota::date < (CURRENT_DATE - INTERVAL '45 days')::date`
    case 'r3':
      return `n.fecha_nota IS NOT NULL AND n.fecha_nota::date >= (CURRENT_DATE - INTERVAL '90 days')::date AND n.fecha_nota::date < (CURRENT_DATE - INTERVAL '60 days')::date`
    case 'r4':
      return `n.fecha_nota IS NOT NULL AND n.fecha_nota::date >= (CURRENT_DATE - INTERVAL '180 days')::date AND n.fecha_nota::date < (CURRENT_DATE - INTERVAL '90 days')::date`
    case 'r5':
      return `n.fecha_nota IS NOT NULL AND n.fecha_nota::date >= (CURRENT_DATE - INTERVAL '365 days')::date AND n.fecha_nota::date < (CURRENT_DATE - INTERVAL '180 days')::date`
    case 'r6':
      return `n.fecha_nota IS NOT NULL AND n.fecha_nota::date < (CURRENT_DATE - INTERVAL '365 days')::date`
    default:
      return null
  }
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const pool = getPool()
    const page = parsePositiveInt(req.query.page, 1)
    const pageSize = Math.min(parsePositiveInt(req.query.pageSize, 20), 100)
    const offset = (page - 1) * pageSize

    const params = []
    const where = []
    where.push(whereByRole(req.user, params))

    const estado = String(req.query.estado ?? '').trim().toUpperCase()
    if (estado) {
      params.push(estado)
      where.push(`n.estado = $${params.length}`)
    }

    const empresa = String(req.query.empresa ?? '').trim().toUpperCase()
    if (empresa) {
      params.push(empresa)
      where.push(`n.empresa = $${params.length}`)
    }

    const rutasList = parseRutasList(req.query.rutas ?? req.query.ruta)
    const rutas = rutasList.join(',')
    if (rutasList.length > 0) {
      params.push(rutasList)
      where.push(`UPPER(TRIM(COALESCE(r.codigo, ''))) = ANY($${params.length}::text[])`)
    }

    const atencion = String(req.query.atencion ?? '').trim().toLowerCase()
    if (['si', 'sí', 'true', '1'].includes(atencion)) {
      where.push('n.requiere_atencion = true')
    } else if (['no', 'false', '0'].includes(atencion)) {
      where.push('n.requiere_atencion = false')
    }

    const q = String(req.query.q ?? '').trim()
    if (q) {
      params.push(`%${q}%`)
      where.push(
        `(n.serie_folio ILIKE $${params.length} OR n.cliente ILIKE $${params.length} OR n.usuario_vendedor_pv ILIKE $${params.length})`,
      )
    }

    const diasBucketsList = parseDiasBucketsList(req.query.dias_bucket)
    const bucketSqlParts = diasBucketsList.map((b) => diasBucketWhere(b)).filter(Boolean)
    if (bucketSqlParts.length === 1) {
      where.push(bucketSqlParts[0])
    } else if (bucketSqlParts.length > 1) {
      where.push(`(${bucketSqlParts.join(' OR ')})`)
    }
    const diasBucket = diasBucketsList.join(',')

    const whereSql = `WHERE ${where.join(' AND ')}`

    const includeAggregatesRaw = String(req.query.includeAggregates ?? 'true')
      .trim()
      .toLowerCase()
    const includeAggregates = !['false', '0', 'no'].includes(includeAggregatesRaw)
    const sortKeyRaw = String(req.query.sort ?? '').trim().toLowerCase()
    const sortKeyNorm = ['default', 'atencion'].includes(sortKeyRaw) ? 'fecha_nota_asc' : sortKeyRaw
    const orderBy =
      SEGUIMIENTO_ORDER_BY[sortKeyNorm] || SEGUIMIENTO_ORDER_BY.fecha_nota_asc

    const countR = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM notas_credito n
      LEFT JOIN rutas r ON r.id = n.ruta_id
      ${whereSql}
    `,
      params,
    )
    const total = countR.rows[0]?.total ?? 0

    let resumen = { total_filtrado: total, requiere_atencion: 0 }
    let porRuta = []
    let porAntiguedad = []
    if (includeAggregates) {
      const [resumenR, porRutaR, porAntiguedadR] = await Promise.all([
        pool.query(
          `
      SELECT
        COUNT(*)::int AS total_filtrado,
        COUNT(*) FILTER (WHERE n.requiere_atencion = true)::int AS requiere_atencion
      FROM notas_credito n
      LEFT JOIN rutas r ON r.id = n.ruta_id
      ${whereSql}
    `,
          params,
        ),
        pool.query(
          `
      SELECT
        COALESCE(NULLIF(TRIM(r.codigo), ''), '(sin ruta)') AS ruta_codigo,
        COUNT(*)::int AS registros
      FROM notas_credito n
      LEFT JOIN rutas r ON r.id = n.ruta_id
      ${whereSql}
      GROUP BY 1
      ORDER BY registros DESC, ruta_codigo ASC
      LIMIT 200
    `,
          params,
        ),
        pool.query(
          `
      WITH base AS (
        SELECT
          CASE
            WHEN n.fecha_nota IS NULL THEN NULL
            ELSE (CURRENT_DATE - n.fecha_nota::date)::int
          END AS dias,
          n.saldo
        FROM notas_credito n
        LEFT JOIN rutas r ON r.id = n.ruta_id
        ${whereSql}
      ),
      agrupado AS (
        SELECT
          CASE
            WHEN base.dias IS NULL OR base.dias < 0 THEN 'negativo'
            WHEN base.dias <= 30 THEN 'd0_30'
            WHEN base.dias <= 45 THEN 'd31_45'
            WHEN base.dias <= 60 THEN 'd46_60'
            WHEN base.dias <= 90 THEN 'd61_90'
            WHEN base.dias <= 180 THEN 'd91_180'
            WHEN base.dias <= 365 THEN 'd181_365'
            ELSE 'd366_plus'
          END AS bucket_id,
          COUNT(*)::int AS registros,
          COALESCE(SUM(base.saldo), 0)::float8 AS saldo_total
        FROM base
        GROUP BY 1
      )
      SELECT bucket_id, registros, saldo_total
      FROM agrupado
      ORDER BY
        CASE agrupado.bucket_id
          WHEN 'negativo' THEN 0
          WHEN 'd0_30' THEN 1
          WHEN 'd31_45' THEN 2
          WHEN 'd46_60' THEN 3
          WHEN 'd61_90' THEN 4
          WHEN 'd91_180' THEN 5
          WHEN 'd181_365' THEN 6
          WHEN 'd366_plus' THEN 7
        END
    `,
          params,
        ),
      ])
      resumen = resumenR.rows[0] || resumen
      porRuta = porRutaR.rows
      porAntiguedad = porAntiguedadR.rows
    }

    const listParams = [...params, pageSize, offset]
    const listR = await pool.query(
      `
      SELECT
        n.id,
        n.serie_folio,
        n.fecha_nota,
        n.cliente,
        n.estado,
        n.requiere_atencion,
        n.resuelta_automaticamente,
        n.fecha_corriente,
        n.fecha_ultima_actualizacion,
        n.monto,
        n.abono,
        n.saldo,
        n.empresa,
        n.usuario_vendedor_pv,
        vu.username AS vendedor_username,
        r.codigo AS ruta_codigo,
        EXISTS (SELECT 1 FROM aclaraciones a WHERE a.nota_id = n.id) AS tiene_comentarios,
        (
          SELECT COALESCE(JSON_AGG(acl), '[]')
          FROM (
            SELECT 
              a.id, 
              a.comentario, 
              a.tipo, 
              a.created_at,
              JSON_BUILD_OBJECT('username', u.username, 'nombre_completo', u.nombre_completo) AS usuarios
            FROM aclaraciones a
            LEFT JOIN usuarios u ON u.id = a.usuario_id
            WHERE a.nota_id = n.id
            ORDER BY a.created_at DESC
            LIMIT 50
          ) acl
        ) AS aclaraciones
      FROM notas_credito n
      LEFT JOIN rutas r ON r.id = n.ruta_id
      LEFT JOIN usuarios vu ON vu.id = n.usuario_id
      ${whereSql}
      ORDER BY ${orderBy}
      LIMIT $${listParams.length - 1}
      OFFSET $${listParams.length}
    `,
      listParams,
    )

    res.json({
      ok: true,
      page,
      pageSize,
      total,
      totalPages: total > 0 ? Math.ceil(total / pageSize) : 1,
      filters: {
        empresa: empresa || null,
        estado: estado || null,
        rutas: rutas || null,
        dias_bucket: diasBucketsList.length ? diasBucket : null,
        atencion: atencion || null,
        q: q || null,
        sort: SEGUIMIENTO_ORDER_BY[sortKeyNorm] ? sortKeyNorm : 'fecha_nota_asc',
      },
      resumen,
      porRuta,
      porAntiguedad,
      items: listR.rows,
    })
  } catch (e) {
    next(e)
  }
})

/** Últimos movimientos de estado en notas (p. ej. PENDIENTE → RESUELTA), respetando alcance por rol. */
router.get('/historial-estados', requireAuth, async (req, res, next) => {
  try {
    const pool = getPool()
    const limitRaw = parsePositiveInt(req.query.limit, 150)
    const limit = Math.min(limitRaw, 500)
    const modo = String(req.query.modo ?? 'pendiente_resuelta').trim().toLowerCase()

    const params = []
    const roleClause = whereByRole(req.user, params)
    params.push(limit)
    const limitIdx = params.length

    const transicionSql =
      modo === 'todos'
        ? ''
        : `
      AND UPPER(TRIM(COALESCE(h.valor_anterior, ''))) = 'PENDIENTE'
      AND UPPER(TRIM(COALESCE(h.valor_nuevo, ''))) = 'RESUELTA'
    `

    const listR = await pool.query(
      `
      SELECT
        h.id,
        h.nota_id,
        h.valor_anterior,
        h.valor_nuevo,
        h.observacion,
        h.created_at,
        n.serie_folio,
        n.cliente,
        n.empresa,
        u.username AS usuario_username,
        u.nombre_completo AS usuario_nombre
      FROM historial_notas h
      INNER JOIN notas_credito n ON n.id = h.nota_id
      LEFT JOIN usuarios u ON u.id = h.usuario_id
      WHERE h.campo_modificado = 'estado'
        AND (${roleClause})
        ${transicionSql}
      ORDER BY h.created_at DESC NULLS LAST, h.id DESC
      LIMIT $${limitIdx}
    `,
      params,
    )

    res.json({
      ok: true,
      modo: modo === 'todos' ? 'todos' : 'pendiente_resuelta',
      limit,
      items: listR.rows,
    })
  } catch (e) {
    next(e)
  }
})

router.get('/nota/:id', requireAuth, async (req, res, next) => {
  try {
    const noteId = Number.parseInt(req.params.id, 10)
    if (!Number.isFinite(noteId) || noteId <= 0) {
      return res.status(400).json({ ok: false, error: 'ID de nota inválido' })
    }

    const pool = getPool()
    const params = [noteId]
    const roleClause = whereByRole(req.user, params)

    const noteR = await pool.query(
      `
      SELECT
        n.id, n.serie_folio, n.fecha_nota, n.cliente, n.empresa, n.estado,
        n.monto, n.abono, n.saldo, n.requiere_atencion, n.resuelta_automaticamente,
        n.usuario_vendedor_pv, n.usuario_id,
        vu.username AS vendedor_username,
        n.fecha_corriente, n.fecha_ultima_actualizacion, n.fecha_resolucion,
        r.id AS ruta_id, r.codigo AS ruta_codigo, r.nombre AS ruta_nombre
      FROM notas_credito n
      LEFT JOIN rutas r ON r.id = n.ruta_id
      LEFT JOIN usuarios vu ON vu.id = n.usuario_id
      WHERE n.id = $1 AND (${roleClause})
      LIMIT 1
    `,
      params,
    )

    const nota = noteR.rows[0]
    if (!nota) {
      return res.status(404).json({ ok: false, error: 'Nota no encontrada' })
    }

    const canManageStateUser = canManageState(req.user)
    const canManageRouteUser = canManageRoute(req.user)
    const [
      historialR,
      aclaracionesR,
      documentosR,
      rutasR,
    ] = await Promise.all([
      pool.query(
        `
      SELECT
        h.id, h.campo_modificado, h.valor_anterior, h.valor_nuevo,
        h.observacion, h.created_at,
        u.username AS usuario_username,
        u.nombre_completo AS usuario_nombre
      FROM historial_notas h
      LEFT JOIN usuarios u ON u.id = h.usuario_id
      WHERE h.nota_id = $1
      ORDER BY h.created_at DESC, h.id DESC
      LIMIT 100
    `,
        [noteId],
      ),
      pool.query(
        `
      SELECT
        a.id, a.comentario, a.tipo, a.leida, a.created_at,
        u.username AS usuario_username,
        u.nombre_completo AS usuario_nombre
      FROM aclaraciones a
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.nota_id = $1
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 200
    `,
        [noteId],
      ),
      pool.query(
        `
      SELECT
        d.id, d.nombre_archivo, d.ruta_archivo, d.tipo_mime, d.tamanio, d.created_at,
        u.username AS usuario_username,
        u.nombre_completo AS usuario_nombre
      FROM documentos d
      LEFT JOIN usuarios u ON u.id = d.usuario_id
      WHERE d.nota_id = $1
      ORDER BY d.created_at DESC, d.id DESC
      LIMIT 100
    `,
        [noteId],
      ),
      canManageRouteUser
        ? pool.query(
            `
        SELECT id, codigo, nombre
        FROM rutas
        WHERE activa = true
        ORDER BY codigo ASC
      `,
          )
        : Promise.resolve({ rows: [] }),
    ])

    // No bloquea la respuesta del detalle.
    if (canManageStateUser) {
      void pool.query('UPDATE aclaraciones SET leida = true WHERE nota_id = $1 AND leida = false', [
        noteId,
      ])
    }

    res.json({
      ok: true,
      canManageState: canManageStateUser,
      canManageRoute: canManageRouteUser,
      nota,
      historial: historialR.rows,
      aclaraciones: aclaracionesR.rows,
      documentos: documentosR.rows,
      rutasDisponibles: rutasR.rows,
    })
  } catch (e) {
    next(e)
  }
})

router.post(
  '/nota/:id/documentos',
  requireAuth,
  upload.single('file'),
  async (req, res, next) => {
    try {
      const noteId = Number.parseInt(req.params.id, 10)
      if (!Number.isFinite(noteId) || noteId <= 0) {
        return res.status(400).json({ ok: false, error: 'ID de nota inválido' })
      }
      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'Archivo requerido (file)' })
      }

      const pool = getPool()
      const params = [noteId]
      const roleClause = whereByRole(req.user, params)
      const existsR = await pool.query(
        `SELECT n.id FROM notas_credito n WHERE n.id = $1 AND (${roleClause}) LIMIT 1`,
        params,
      )
      if (existsR.rowCount === 0) {
        return res.status(404).json({ ok: false, error: 'Nota no encontrada' })
      }

      const rel = `/uploads/documentos/${req.file.filename}`
      const insR = await pool.query(
        `
        INSERT INTO documentos
          (nombre_archivo, ruta_archivo, tipo_mime, tamanio, created_at, nota_id, usuario_id)
        VALUES
          ($1, $2, $3, $4, NOW(), $5, $6)
        RETURNING id, nombre_archivo, ruta_archivo, tipo_mime, tamanio, created_at
      `,
        [
          req.file.originalname,
          rel,
          req.file.mimetype || 'application/octet-stream',
          req.file.size || 0,
          noteId,
          req.user.sub,
        ],
      )
      await pool.query(
        `
        INSERT INTO historial_notas
          (campo_modificado, valor_anterior, valor_nuevo, observacion, created_at, nota_id, usuario_id)
        VALUES
          ('documento', '', '', $1, NOW(), $2, $3)
      `,
        [`Adjunto: ${req.file.originalname}`, noteId, req.user.sub],
      )

      await logAudit({
        req,
        accion: 'seguimiento.documento.subir',
        entidad: 'documentos',
        entidadId: insR.rows[0].id,
        detalle: { notaId: noteId, nombreArchivo: req.file.originalname },
      })

      res.status(201).json({ ok: true, item: insR.rows[0] })
    } catch (e) {
      next(e)
    }
  },
)

router.post('/nota/:id/comentarios', requireAuth, async (req, res, next) => {
  try {
    const noteId = Number.parseInt(req.params.id, 10)
    const comentario = String(req.body?.comentario ?? '').trim()
    const tipo = String(req.body?.tipo ?? 'COMENTARIO').trim().toUpperCase()

    if (!Number.isFinite(noteId) || noteId <= 0) {
      return res.status(400).json({ ok: false, error: 'ID de nota inválido' })
    }
    if (!comentario) {
      return res.status(400).json({ ok: false, error: 'Comentario obligatorio' })
    }
    if (!['COMENTARIO', 'ACLARACION', 'SEGUIMIENTO'].includes(tipo)) {
      return res.status(400).json({ ok: false, error: 'Tipo de comentario inválido' })
    }

    const pool = getPool()

    const params = [noteId]
    const roleClause = whereByRole(req.user, params)
    const existsR = await pool.query(
      `SELECT n.id FROM notas_credito n WHERE n.id = $1 AND (${roleClause}) LIMIT 1`,
      params,
    )
    if (existsR.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Nota no encontrada' })
    }

    const prevR = await pool.query(
      'SELECT id, estado, requiere_atencion FROM notas_credito WHERE id = $1 LIMIT 1',
      [noteId],
    )
    const prev = prevR.rows[0]

    const insR = await pool.query(
      `
      INSERT INTO aclaraciones (comentario, tipo, leida, created_at, nota_id, usuario_id)
      VALUES ($1, $2, false, NOW(), $3, $4)
      RETURNING id, comentario, tipo, leida, created_at
    `,
      [comentario, tipo, noteId, req.user.sub],
    )

    // Regla de negocio:
    // Comentar no reabre notas RESUELTA/CANCELADA.
    // Solo si ya estaba PENDIENTE, activamos la bandera de atención.
    const reabierta = false
    if (prev && shouldSetRequiereAtencionOnComment(prev.estado)) {
      await pool.query('UPDATE notas_credito SET requiere_atencion = true WHERE id = $1', [
        noteId,
      ])
    }

    await pool.query(
      `
      INSERT INTO historial_notas
        (campo_modificado, valor_anterior, valor_nuevo, observacion, created_at, nota_id, usuario_id)
      VALUES
        ('comentario', '', '', $1, NOW(), $2, $3)
    `,
      [comentario, noteId, req.user.sub],
    )

    await logAudit({
      req,
      accion: 'seguimiento.comentario.crear',
      entidad: 'aclaraciones',
      entidadId: insR.rows[0].id,
      detalle: { notaId: noteId, tipo, reabierta },
    })

    res.status(201).json({ ok: true, item: insR.rows[0] })
  } catch (e) {
    next(e)
  }
})

router.post('/nota/:id/estado', requireAuth, async (req, res, next) => {
  try {
    if (!canManageState(req.user)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso para cambiar estado' })
    }

    const noteId = Number.parseInt(req.params.id, 10)
    const nuevoEstado = String(req.body?.estado ?? '').trim().toUpperCase()
    const observacion = String(req.body?.observacion ?? '').trim()

    if (!Number.isFinite(noteId) || noteId <= 0) {
      return res.status(400).json({ ok: false, error: 'ID de nota inválido' })
    }
    if (!ESTADOS_VALIDOS.has(nuevoEstado)) {
      return res.status(400).json({ ok: false, error: 'Estado inválido' })
    }

    const pool = getPool()
    const prevR = await pool.query(
      'SELECT id, estado FROM notas_credito WHERE id = $1 LIMIT 1',
      [noteId],
    )
    const prev = prevR.rows[0]
    if (!prev) {
      return res.status(404).json({ ok: false, error: 'Nota no encontrada' })
    }

    await pool.query(
      `
      UPDATE notas_credito
      SET estado = $1,
          fecha_ultima_actualizacion = NOW(),
          fecha_resolucion = CASE WHEN $3 = 'RESUELTA' THEN NOW() ELSE NULL END,
          requiere_atencion = CASE
            WHEN $3 IN ('RESUELTA', 'CANCELADA') THEN false
            ELSE requiere_atencion
          END,
          resuelta_automaticamente = false
      WHERE id = $2
    `,
      [nuevoEstado, noteId, nuevoEstado],
    )

    await pool.query(
      `
      INSERT INTO historial_notas
        (campo_modificado, valor_anterior, valor_nuevo, observacion, created_at, nota_id, usuario_id)
      VALUES
        ('estado', $1, $2, $3, NOW(), $4, $5)
    `,
      [prev.estado || '', nuevoEstado, observacion, noteId, req.user.sub],
    )

    await logAudit({
      req,
      accion: 'seguimiento.estado.cambiar',
      entidad: 'notas_credito',
      entidadId: noteId,
      detalle: { estadoAnterior: prev.estado, estadoNuevo: nuevoEstado },
    })

    res.json({ ok: true, estadoAnterior: prev.estado, estadoNuevo: nuevoEstado })
  } catch (e) {
    next(e)
  }
})

router.post('/nota/:id/ruta', requireAuth, async (req, res, next) => {
  try {
    if (!canManageRoute(req.user)) {
      return res.status(403).json({ ok: false, error: 'Solo ADMIN puede cambiar la ruta' })
    }

    const noteId = Number.parseInt(req.params.id, 10)
    const nuevaRutaId = Number.parseInt(req.body?.rutaId, 10)
    if (!Number.isFinite(noteId) || noteId <= 0) {
      return res.status(400).json({ ok: false, error: 'ID de nota inválido' })
    }
    if (!Number.isFinite(nuevaRutaId) || nuevaRutaId <= 0) {
      return res.status(400).json({ ok: false, error: 'Ruta inválida' })
    }

    const pool = getPool()
    const noteR = await pool.query(
      `
      SELECT n.id, n.ruta_id, COALESCE(r.codigo, '') AS ruta_codigo
      FROM notas_credito n
      LEFT JOIN rutas r ON r.id = n.ruta_id
      WHERE n.id = $1
      LIMIT 1
    `,
      [noteId],
    )
    if (noteR.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Nota no encontrada' })
    }
    const prev = noteR.rows[0]

    const rutaR = await pool.query(
      'SELECT id, codigo, nombre, activa FROM rutas WHERE id = $1 LIMIT 1',
      [nuevaRutaId],
    )
    if (rutaR.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Ruta no encontrada' })
    }
    if (rutaR.rows[0].activa === false) {
      return res.status(400).json({ ok: false, error: 'La ruta seleccionada está inactiva' })
    }
    const nextRuta = rutaR.rows[0]

    if (Number(prev.ruta_id) === Number(nuevaRutaId)) {
      return res.json({
        ok: true,
        unchanged: true,
        rutaAnterior: prev.ruta_codigo || null,
        rutaNueva: nextRuta.codigo,
      })
    }

    await pool.query(
      `
      UPDATE notas_credito
      SET ruta_id = $1,
          fecha_ultima_actualizacion = NOW()
      WHERE id = $2
    `,
      [nuevaRutaId, noteId],
    )

    await pool.query(
      `
      INSERT INTO historial_notas
        (campo_modificado, valor_anterior, valor_nuevo, observacion, created_at, nota_id, usuario_id)
      VALUES
        ('ruta', $1, $2, '', NOW(), $3, $4)
    `,
      [prev.ruta_codigo || '', nextRuta.codigo, noteId, req.user.sub],
    )

    await logAudit({
      req,
      accion: 'seguimiento.ruta.cambiar',
      entidad: 'notas_credito',
      entidadId: noteId,
      detalle: {
        rutaAnterior: prev.ruta_codigo || null,
        rutaNueva: nextRuta.codigo,
      },
    })

    res.json({
      ok: true,
      rutaAnterior: prev.ruta_codigo || null,
      rutaNueva: nextRuta.codigo,
      rutaNuevaId: nextRuta.id,
    })
  } catch (e) {
    next(e)
  }
})

export default router
