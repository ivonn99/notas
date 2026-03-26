import { Router } from 'express'

import {
  djangoPasswordAlgorithm,
  encodeDjangoPassword,
  isProbablyLegacyPlaintextPassword,
  legacyPlaintextMatches,
  verifyDjangoPassword,
} from '../auth/djangoPassword.js'
import { COOKIE_NAME, signUserToken } from '../auth/tokens.js'
import { getPool } from '../db.js'
import { requireAuth, requireRoles } from '../middleware/auth.js'
import { logAudit } from '../services/audit.js'
import {
  logHashInfo,
  logLegacyPlaintextUpgraded,
  logLoginAttempt,
  logLoginOk,
  logPasswordMismatch,
  logUserFound,
  logUserInactive,
  logUserNotFound,
} from '../utils/authLoginLog.js'

const router = Router()

/** GET de comprobación: abre http://127.0.0.1:3001/api/auth/ping en el navegador */
router.get('/ping', (_req, res) => {
  res.json({
    ok: true,
    service: 'notas-api-auth',
    login: 'POST /api/auth/login',
  })
})

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

router.post('/login', async (req, res) => {
  const username = String(req.body?.username ?? '').trim()
  const password = String(req.body?.password ?? '')

  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'Usuario y contraseña son obligatorios' })
  }

  logLoginAttempt(username, password.length)

  try {
    const pool = getPool()
    const { rows } = await pool.query(
      `SELECT id, username, password, rol, nombre_completo, activo, is_active, is_superuser, is_staff
       FROM usuarios
       WHERE LOWER(username) = LOWER($1)
       LIMIT 1`,
      [username],
    )

    const row = rows[0]
    const fail = () =>
      res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos' })

    if (!row) {
      logUserNotFound(username)
      return fail()
    }

    logUserFound(row)

    if (row.activo === false || row.is_active === false) {
      logUserInactive(row)
      return res.status(403).json({ ok: false, error: 'Usuario desactivado' })
    }

    if (isProbablyLegacyPlaintextPassword(row.password)) {
      console.warn(
        '[auth/login] Campo password sin formato Django (posible texto plano legacy)',
      )
      if (!legacyPlaintextMatches(password, row.password)) {
        logPasswordMismatch(row.id)
        return fail()
      }
      const newHash = encodeDjangoPassword(password)
      await pool.query('UPDATE usuarios SET password = $1 WHERE id = $2', [
        newHash,
        row.id,
      ])
      logLegacyPlaintextUpgraded(row.id)
    } else {
      const algo = djangoPasswordAlgorithm(row.password)
      logHashInfo(row.password, algo)
      if (algo !== 'pbkdf2_sha256') {
        console.warn('[auth/login] Hash no soportado:', algo || '(vacío)')
        return res.status(500).json({
          ok: false,
          error:
            'Formato de contraseña no compatible (se espera pbkdf2_sha256 de Django).',
        })
      }

      if (!verifyDjangoPassword(password, row.password)) {
        logPasswordMismatch(row.id)
        return fail()
      }
    }

    const payload = {
      sub: String(row.id),
      username: row.username,
      rol: row.rol || 'VENDEDOR',
      isSuperuser: Boolean(row.is_superuser),
      isStaff: Boolean(row.is_staff),
    }

    const token = signUserToken(payload)
    // Solo Secure=true con HTTPS (p. ej. producción). En http://localhost Secure rompe la cookie.
    const secure = process.env.COOKIE_SECURE === 'true'
    res.cookie(COOKIE_NAME, token, { ...COOKIE_OPTS, secure })

    logLoginOk(row.id, row.username, payload.rol)
    await logAudit({
      req,
      accion: 'auth.login.ok',
      entidad: 'usuarios',
      entidadId: row.id,
      usuarioId: row.id,
      username: row.username,
      detalle: { rol: payload.rol },
    })

    res.json({
      ok: true,
      user: {
        id: row.id,
        username: row.username,
        rol: payload.rol,
        nombreCompleto: row.nombre_completo || null,
        isSuperuser: payload.isSuperuser,
        isStaff: payload.isStaff,
      },
    })
  } catch (err) {
    console.error('[auth/login] excepción:', err.message)
    res.status(500).json({ ok: false, error: 'Error al iniciar sesión' })
  }
})

router.post('/logout', (req, res) => {
  void logAudit({
    req,
    accion: 'auth.logout',
    entidad: 'usuarios',
    entidadId: req?.user?.sub ?? null,
  })
  res.clearCookie(COOKIE_NAME, { path: '/' })
  res.json({ ok: true })
})

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const pool = getPool()
    const { rows } = await pool.query(
      `SELECT id, username, rol, nombre_completo, activo, is_active, is_superuser, is_staff
       FROM usuarios WHERE id = $1 LIMIT 1`,
      [req.user.sub],
    )
    const row = rows[0]
    if (!row || row.activo === false || row.is_active === false) {
      res.clearCookie(COOKIE_NAME, { path: '/' })
      return res.status(401).json({ ok: false, error: 'Usuario ya no válido' })
    }
    res.json({
      ok: true,
      user: {
        id: row.id,
        username: row.username,
        rol: row.rol || 'VENDEDOR',
        nombreCompleto: row.nombre_completo || null,
        isSuperuser: Boolean(row.is_superuser),
        isStaff: Boolean(row.is_staff),
      },
    })
  } catch (e) {
    next(e)
  }
})

/** Ejemplo: solo ADMIN, CREDITO o superusuario (ver `requireRoles`). */
router.get(
  '/check/credito',
  requireAuth,
  requireRoles('ADMIN', 'CREDITO'),
  (_req, res) => {
    res.json({ ok: true, message: 'Rol CREDITO o ADMIN (o superusuario)' })
  },
)

export default router
