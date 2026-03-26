import { COOKIE_NAME, verifyUserToken } from '../auth/tokens.js'

/**
 * @typedef {object} AuthUserPayload
 * @property {string} sub
 * @property {string} username
 * @property {string} rol
 * @property {boolean} isSuperuser
 * @property {boolean} isStaff
 */

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) {
    return res.status(401).json({ ok: false, error: 'No autenticado' })
  }
  try {
    /** @type {AuthUserPayload} */
    const payload = verifyUserToken(token)
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ ok: false, error: 'Sesión inválida o expirada' })
  }
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
