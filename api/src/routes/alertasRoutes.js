import { Router } from 'express'

import { getPool } from '../db.js'
import { requireAuth, requireRoles } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, requireRoles('ADMIN', 'CREDITO'), async (_req, res, next) => {
  try {
    const pool = getPool()
    const r = await pool.query(
      `
      SELECT
        a.id, a.tipo, a.descripcion, a.leida, a.created_at,
        a.nota_id,
        n.serie_folio,
        n.cliente,
        n.estado
      FROM alertas a
      LEFT JOIN notas_credito n ON n.id = a.nota_id
      ORDER BY a.leida ASC, a.created_at DESC, a.id DESC
      LIMIT 500
    `,
    )
    res.json({ ok: true, items: r.rows })
  } catch (e) {
    next(e)
  }
})

router.post('/:id/leer', requireAuth, requireRoles('ADMIN', 'CREDITO'), async (req, res, next) => {
  try {
    const id = Number.parseInt(String(req.params.id ?? ''), 10)
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'ID inválido' })
    }
    const pool = getPool()
    const r = await pool.query(
      'UPDATE alertas SET leida = true WHERE id = $1 RETURNING id, leida',
      [id],
    )
    if (r.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Alerta no encontrada' })
    }
    res.json({ ok: true, item: r.rows[0] })
  } catch (e) {
    next(e)
  }
})

export default router
