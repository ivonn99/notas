import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Router } from 'express'

import { getPool } from '../db.js'
import { requireAuth, requireRoles } from '../middleware/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultLogPath = path.join(__dirname, '..', '..', 'logs', 'app.log')

const router = Router()

router.get('/archivo', requireAuth, requireRoles('ADMIN', 'CREDITO'), (req, res) => {
  const maxLines = Math.min(
    Math.max(Number.parseInt(String(req.query.lines ?? '200'), 10) || 200, 1),
    2000,
  )
  const logPath = process.env.APP_LOG_PATH?.trim() || defaultLogPath
  try {
    if (!fs.existsSync(logPath)) {
      return res.json({
        ok: true,
        path: logPath,
        lines: [],
        message: 'Aún no hay archivo de log (el API escribe en api/logs/app.log al arrancar).',
      })
    }
    const raw = fs.readFileSync(logPath, 'utf8')
    const all = raw.split(/\r?\n/)
    const tail = all.slice(Math.max(0, all.length - maxLines))
    res.json({
      ok: true,
      path: logPath,
      lineCount: tail.length,
      lines: tail,
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'No se pudo leer el log' })
  }
})

router.get('/', requireAuth, requireRoles('ADMIN', 'CREDITO'), async (_req, res, next) => {
  try {
    const pool = getPool()
    const r = await pool.query(
      `
      SELECT
        i.id, i.created_at, i.estado, i.nombre_archivo,
        i.total_registros, i.registros_nuevos, i.registros_actualizados, i.registros_resueltos,
        i.observaciones,
        u.username AS usuario_username
      FROM importaciones i
      LEFT JOIN usuarios u ON u.id = i.usuario_id
      ORDER BY i.created_at DESC, i.id DESC
      LIMIT 100
    `,
    )
    res.json({
      ok: true,
      source: 'importaciones',
      items: r.rows,
    })
  } catch (e) {
    next(e)
  }
})

export default router
