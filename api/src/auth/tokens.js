import jwt from 'jsonwebtoken'

const COOKIE_NAME = 'nc_token'

function getSecret() {
  const s = process.env.JWT_SECRET?.trim()
  if (s && s.length >= 16) return s
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET debe tener al menos 16 caracteres en producción')
  }
  console.warn(
    '[auth] JWT_SECRET no definido o corto; usando valor de solo-desarrollo. Configura JWT_SECRET en api/.env',
  )
  return 'dev-inseguro-cambiar-en-produccion'
}

export function signUserToken(payload) {
  return jwt.sign(payload, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

export function verifyUserToken(token) {
  return jwt.verify(token, getSecret())
}

export { COOKIE_NAME }
