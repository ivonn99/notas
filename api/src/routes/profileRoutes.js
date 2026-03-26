import { Router } from 'express'

import {
  djangoPasswordAlgorithm,
  encodeDjangoPassword,
  isProbablyLegacyPlaintextPassword,
  legacyPlaintextMatches,
  verifyDjangoPassword,
} from '../auth/djangoPassword.js'
import { getPool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)

router.get('/me', async (req, res, next) => {
  try {
    const pool = getPool()
    const r = await pool.query(
      `
      SELECT id, username, nombre_completo, email, rol, activo, is_active
      FROM usuarios
      WHERE id = $1
      LIMIT 1
    `,
      [req.user.sub],
    )
    if (r.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' })
    }
    const row = r.rows[0]
    const rutas = await pool.query(
      `
      SELECT r.id, r.codigo, r.nombre
      FROM usuario_rutas ur
      JOIN rutas r ON r.id = ur.ruta_id
      WHERE ur.usuario_id = $1
      ORDER BY r.codigo ASC
    `,
      [req.user.sub],
    )
    res.json({ ok: true, user: row, rutas: rutas.rows })
  } catch (e) {
    next(e)
  }
})

router.post('/password', async (req, res, next) => {
  try {
    const current = String(req.body?.currentPassword ?? '')
    const nextPass = String(req.body?.newPassword ?? '')
    if (!current || !nextPass || nextPass.length < 4) {
      return res.status(400).json({ ok: false, error: 'Contraseña inválida' })
    }

    const pool = getPool()
    const r = await pool.query(
      'SELECT id, password FROM usuarios WHERE id = $1 LIMIT 1',
      [req.user.sub],
    )
    if (r.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' })
    }
    const row = r.rows[0]

    let currentOk = false
    if (isProbablyLegacyPlaintextPassword(row.password)) {
      currentOk = legacyPlaintextMatches(current, row.password)
    } else {
      const algo = djangoPasswordAlgorithm(row.password)
      if (algo !== 'pbkdf2_sha256') {
        return res.status(500).json({
          ok: false,
          error:
            'Tu contraseña usa un formato antiguo. Contacta a un administrador o inicia sesión de nuevo para actualizarla.',
        })
      }
      currentOk = verifyDjangoPassword(current, row.password)
    }
    if (!currentOk) {
      return res.status(401).json({ ok: false, error: 'Contraseña actual incorrecta' })
    }

    const encoded = encodeDjangoPassword(nextPass)
    await pool.query('UPDATE usuarios SET password = $1 WHERE id = $2', [
      encoded,
      row.id,
    ])
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

export default router
