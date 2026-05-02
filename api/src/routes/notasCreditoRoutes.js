import { Router } from 'express'

import { getPool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Orden permitido (evita inyección en ORDER BY). */
const SORT_SQL = {
  // Compatibilidad con sort legado: ahora ambos apuntan a fecha_nota.
  fecha_corriente_desc: 'n.fecha_nota DESC NULLS LAST, n.id DESC',
  fecha_corriente_asc: 'n.fecha_nota ASC NULLS LAST, n.id ASC',
  fecha_nota_desc: 'n.fecha_nota DESC NULLS LAST, n.id DESC',
  fecha_nota_asc: 'n.fecha_nota ASC NULLS LAST, n.id ASC',
  saldo_desc: 'n.saldo DESC NULLS LAST, n.id DESC',
  saldo_asc: 'n.saldo ASC NULLS LAST, n.id DESC',
  estado_asc: 'n.estado ASC, n.id DESC',
  atencion_desc:
    'n.requiere_atencion DESC NULLS LAST, n.fecha_ultima_actualizacion DESC NULLS LAST, n.id DESC',
}

/**
 * GET /api/notas-credito
 * Filtros: page, pageSize, estado, empresa, ruta, q, dias, sort
 * - dias: entero 1..3650 — notas con fecha de referencia en los últimos N días
 * - sort: clave de SORT_SQL
 * - VENDEDOR: solo notas de rutas asignadas en usuario_rutas
 * - CREDITO / ADMIN / superusuario: ven todo
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const pool = getPool()

    const page = parsePositiveInt(req.query.page, 1)
    const pageSize = Math.min(parsePositiveInt(req.query.pageSize, 20), 100)
    const offset = (page - 1) * pageSize

    const params = []
    const where = []

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

    const ruta = String(req.query.ruta ?? '').trim().toUpperCase()
    if (ruta) {
      params.push(ruta)
      where.push(`(UPPER(r.codigo) = $${params.length})`)
    }

    const q = String(req.query.q ?? '').trim()
    if (q) {
      params.push(`%${q}%`)
      where.push(
        `(n.serie_folio ILIKE $${params.length} OR n.cliente ILIKE $${params.length} OR n.usuario_vendedor_pv ILIKE $${params.length})`,
      )
    }

    const diasRaw = Number.parseInt(String(req.query.dias ?? '').trim(), 10)
    const diasFiltered =
      Number.isFinite(diasRaw) && diasRaw > 0 && diasRaw <= 3650 ? diasRaw : null
    if (diasFiltered != null) {
      params.push(diasFiltered)
      where.push(
        `n.fecha_nota >= (CURRENT_DATE - $${params.length})`,
      )
    }

    const sortKeyRaw = String(req.query.sort ?? '').trim()
    const sortKey = SORT_SQL[sortKeyRaw] ? sortKeyRaw : 'fecha_nota_desc'
    const orderBy = SORT_SQL[sortKey]

    // Regla de guía: VENDEDOR solo ve notas de sus rutas asignadas.
    if (!req.user.isSuperuser && req.user.rol === 'VENDEDOR') {
      params.push(req.user.sub)
      where.push(
        `EXISTS (
          SELECT 1
          FROM usuario_rutas ur
          WHERE ur.usuario_id = $${params.length} AND ur.ruta_id = n.ruta_id
        )`,
      )
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM notas_credito n
      LEFT JOIN rutas r ON r.id = n.ruta_id
      ${whereSql}
    `
    const countR = await pool.query(countSql, params)
    const total = countR.rows[0]?.total ?? 0

    const listParams = [...params, pageSize, offset]
    const listSql = `
      SELECT
        n.id,
        n.serie_folio,
        n.fecha_nota,
        n.cliente,
        n.empresa,
        n.monto,
        n.abono,
        n.saldo,
        n.estado,
        n.requiere_atencion,
        n.resuelta_automaticamente,
        n.fecha_corriente,
        n.fecha_ultima_actualizacion,
        n.usuario_vendedor_pv,
        n.usuario_id,
        vu.username AS vendedor_username,
        n.ruta_id,
        r.codigo AS ruta_codigo,
        r.nombre AS ruta_nombre,
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
    `
    const listR = await pool.query(listSql, listParams)

    res.json({
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
        dias: diasFiltered,
        sort: sortKey,
      },
      items: listR.rows,
    })
  } catch (e) {
    next(e)
  }
})

export default router
