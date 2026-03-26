import { Router } from 'express'

import { getPool } from '../db.js'
import { requireAuth, requireRoles } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth, requireRoles('ADMIN'))

router.get('/', async (req, res, next) => {
  try {
    const pool = getPool()
    const params = []
    const where = []

    const accion = String(req.query.accion ?? '').trim()
    if (accion) {
      params.push(accion)
      where.push(`e.accion = $${params.length}`)
    }

    const usuario = String(req.query.usuario ?? '').trim()
    if (usuario) {
      params.push(`%${usuario}%`)
      where.push(`(e.username ILIKE $${params.length})`)
    }

    const q = String(req.query.q ?? '').trim()
    if (q) {
      params.push(`%${q}%`)
      where.push(
        `(e.entidad ILIKE $${params.length} OR e.entidad_id ILIKE $${params.length} OR e.detalle::text ILIKE $${params.length})`,
      )
    }

    const desde = String(req.query.desde ?? '').trim()
    if (desde) {
      params.push(desde)
      where.push(`e.created_at >= $${params.length}::timestamptz`)
    }

    const hasta = String(req.query.hasta ?? '').trim()
    if (hasta) {
      params.push(hasta)
      where.push(`e.created_at <= $${params.length}::timestamptz`)
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
    const r = await pool.query(
      `
      SELECT
        e.id, e.created_at, e.usuario_id, e.username, e.accion, e.entidad, e.entidad_id,
        e.detalle, e.ip, e.user_agent, e.request_id
      FROM auditoria_eventos e
      ${whereSql}
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT 500
    `,
      params,
    )
    res.json({ ok: true, items: r.rows })
  } catch (e) {
    next(e)
  }
})

export default router
