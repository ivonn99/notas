import { Router } from 'express'

import { getPool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)

function vendedorScopeClause(user, params) {
  if (!user.isSuperuser && user.rol === 'VENDEDOR') {
    params.push(user.sub)
    return `
      EXISTS (
        SELECT 1
        FROM notas_credito n
        JOIN usuario_rutas ur ON ur.ruta_id = n.ruta_id
        WHERE n.id = a.nota_id AND ur.usuario_id = $${params.length}
      )
    `
  }
  return 'TRUE'
}

router.get('/', async (req, res, next) => {
  try {
    const pool = getPool()
    const items = []

    // Aclaraciones no leídas
    const aclarParams = []
    const whereByRole = vendedorScopeClause(req.user, aclarParams)
    const aclarR = await pool.query(
      `
      SELECT
        'ACLARACION' AS tipo,
        a.id,
        a.created_at,
        a.comentario AS titulo,
        n.id AS nota_id,
        n.serie_folio
      FROM aclaraciones a
      LEFT JOIN notas_credito n ON n.id = a.nota_id
      WHERE a.leida = false AND (${whereByRole})
      ORDER BY a.created_at DESC
      LIMIT 100
    `,
      aclarParams,
    )
    items.push(...aclarR.rows)

    // Alertas no leídas (solo crédito/admin/super)
    if (req.user.isSuperuser || ['ADMIN', 'CREDITO'].includes(req.user.rol)) {
      const alertR = await pool.query(
        `
        SELECT
          'ALERTA' AS tipo,
          a.id,
          a.created_at,
          COALESCE(a.descripcion, a.tipo) AS titulo,
          a.nota_id,
          n.serie_folio
        FROM alertas a
        LEFT JOIN notas_credito n ON n.id = a.nota_id
        WHERE a.leida = false
        ORDER BY a.created_at DESC
        LIMIT 100
      `,
      )
      items.push(...alertR.rows)
    }

    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    res.json({ ok: true, items: items.slice(0, 150) })
  } catch (e) {
    next(e)
  }
})

router.get('/resumen', async (req, res, next) => {
  try {
    const pool = getPool()
    const params = []
    const whereByRole = vendedorScopeClause(req.user, params)
    const aclarR = await pool.query(
      `
      SELECT COUNT(*)::int AS c
      FROM aclaraciones a
      WHERE a.leida = false AND (${whereByRole})
    `,
      params,
    )
    let alertasCount = 0
    if (req.user.isSuperuser || ['ADMIN', 'CREDITO'].includes(req.user.rol)) {
      const ar = await pool.query('SELECT COUNT(*)::int AS c FROM alertas WHERE leida = false')
      alertasCount = ar.rows[0]?.c ?? 0
    }
    const aclaracionesCount = aclarR.rows[0]?.c ?? 0
    res.json({
      ok: true,
      counts: {
        aclaraciones: aclaracionesCount,
        alertas: alertasCount,
        total: aclaracionesCount + alertasCount,
      },
    })
  } catch (e) {
    next(e)
  }
})

router.post('/:kind/:id/leer', async (req, res, next) => {
  try {
    const kind = String(req.params.kind ?? '').toUpperCase()
    const id = Number.parseInt(String(req.params.id ?? ''), 10)
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'ID inválido' })
    }
    const pool = getPool()

    if (kind === 'ALERTA') {
      if (!req.user.isSuperuser && !['ADMIN', 'CREDITO'].includes(req.user.rol)) {
        return res.status(403).json({ ok: false, error: 'Sin permiso' })
      }
      const r = await pool.query(
        'UPDATE alertas SET leida = true WHERE id = $1 RETURNING id',
        [id],
      )
      if (r.rowCount === 0) {
        return res.status(404).json({ ok: false, error: 'Alerta no encontrada' })
      }
      return res.json({ ok: true })
    }

    if (kind === 'ACLARACION') {
      const params = [id]
      const whereRole = vendedorScopeClause(req.user, params)
      const r = await pool.query(
        `
        UPDATE aclaraciones a
        SET leida = true
        WHERE a.id = $1
          AND (${whereRole})
        RETURNING a.id
      `,
        params,
      )
      if (r.rowCount === 0) {
        return res.status(404).json({ ok: false, error: 'Aclaración no encontrada' })
      }
      return res.json({ ok: true })
    }

    return res.status(400).json({ ok: false, error: 'Tipo inválido' })
  } catch (e) {
    next(e)
  }
})

router.post('/leer-todo', async (req, res, next) => {
  try {
    const pool = getPool()
    let updated = 0

    const aclarParams = []
    const whereByRole = vendedorScopeClause(req.user, aclarParams)
    const a = await pool.query(
      `
      UPDATE aclaraciones a
      SET leida = true
      WHERE a.leida = false
        AND (${whereByRole})
      RETURNING a.id
    `,
      aclarParams,
    )
    updated += a.rowCount

    if (req.user.isSuperuser || ['ADMIN', 'CREDITO'].includes(req.user.rol)) {
      const al = await pool.query(
        'UPDATE alertas SET leida = true WHERE leida = false RETURNING id',
      )
      updated += al.rowCount
    }

    res.json({ ok: true, updated })
  } catch (e) {
    next(e)
  }
})

export default router
