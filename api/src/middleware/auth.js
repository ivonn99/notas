import { COOKIE_NAME, verifyUserToken } from '../auth/tokens.js'

const DB_JWT_ISSUER = 'notas-db-login'

/**
 * @typedef {object} AuthUserPayload
 * @property {string} sub
 * @property {string} username
 * @property {string} rol
 * @property {boolean} isSuperuser
 * @property {boolean} isStaff
 */

/**
 * Cookie del API (sub = id usuario) vs JWT de db-login-jwt (sub = uuid, usuario en user_metadata).
 * @param {import('jsonwebtoken').JwtPayload} payload
 * @returns {AuthUserPayload | null}
 */
function userFromVerifiedJwtPayload(payload) {
  if (!payload || typeof payload !== 'object') return null

  const iss = payload.iss != null ? String(payload.iss) : ''
  if (iss.includes('supabase.co')) return null

  const meta = payload.user_metadata
  const hasMetaUid =
    meta &&
    typeof meta === 'object' &&
    (meta.usuarioId != null || meta.usuario_id != null || meta.dbUserId != null)

  const isDbLogin =
    iss === DB_JWT_ISSUER ||
    (hasMetaUid && String(payload.role || '') === 'authenticated')

  if (isDbLogin) {
    const m = /** @type {Record<string, unknown>} */ (meta || {})
    const uid = m.usuarioId ?? m.usuario_id ?? m.dbUserId
    if (uid == null || uid === '') return null
    return {
      sub: String(uid),
      username: String(m.username || payload.email || 'usuario').trim(),
      rol: String(m.rol || 'VENDEDOR').toUpperCase(),
      isSuperuser: Boolean(m.isSuperuser),
      isStaff: Boolean(m.isStaff),
    }
  }

  if (!payload.sub) return null
  return {
    sub: String(payload.sub),
    username: payload.username,
    rol: payload.rol || 'VENDEDOR',
    isSuperuser: Boolean(payload.isSuperuser),
    isStaff: Boolean(payload.isStaff),
  }
}

export function requireAuth(req, res, next) {
  const cookieToken = req.cookies?.[COOKIE_NAME]
  const authHeader = String(req.headers.authorization || '').trim()
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''

  /** Bearer primero: el login db-jwt no usa cookie; una cookie nc_token vieja u otro secreto rompía la sesión. */
  const candidates = []
  if (bearer) candidates.push(bearer)
  if (cookieToken && cookieToken !== bearer) candidates.push(cookieToken)

  if (candidates.length === 0) {
    return res.status(401).json({ ok: false, error: 'No autenticado' })
  }

  for (const token of candidates) {
    try {
      const raw = verifyUserToken(token)
      const user = userFromVerifiedJwtPayload(raw)
      if (user) {
        req.user = user
        next()
        return
      }
    } catch {
      /* probar siguiente candidato */
    }
  }

  return res.status(401).json({ ok: false, error: 'Sesión inválida o expirada' })
}

/**
 * @param {...string} roles Códigos de rol (ADMIN, CREDITO, VENDEDOR)
 */
export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'No autenticado' })
    }
    if (req.user.isSuperuser) {
      return next()
    }
    if (roles.includes(req.user.rol)) {
      return next()
    }
    return res.status(403).json({ ok: false, error: 'Sin permiso para esta acción' })
  }
}
