/**
 * Logs de diagnóstico para POST /api/auth/login.
 * Nunca registrar la contraseña en claro ni el hash completo.
 */

const PREFIX = '[auth/login]'

export function logLoginAttempt(username, passwordLength) {
  console.info(
    `${PREFIX} Intento | usuario="${username}" | longitudContraseña=${passwordLength}`,
  )
}

export function logUserNotFound(username) {
  console.warn(
    `${PREFIX} Usuario no encontrado en tabla usuarios (LOWER username) | buscado="${username}"`,
  )
}

export function logUserFound(row) {
  console.info(
    `${PREFIX} Fila encontrada | id=${row.id} username_bd="${row.username}" | activo=${row.activo} is_active=${row.is_active} rol=${row.rol ?? '(null)'}`,
  )
}

export function logUserInactive(row) {
  console.warn(
    `${PREFIX} Usuario desactivado | id=${row.id} activo=${row.activo} is_active=${row.is_active}`,
  )
}

export function logHashInfo(encoded, algo) {
  const preview = encoded ? `${String(encoded).slice(0, 35)}…` : '(vacío)'
  console.info(`${PREFIX} Campo password | algoritmo=${algo ?? 'desconocido'} | prefijo=${preview}`)
}

export function logPasswordMismatch(userId) {
  console.warn(
    `${PREFIX} verifyDjangoPassword devolvió false | user id=${userId} (contraseña no coincide con el hash)`,
  )
}

export function logLegacyPlaintextUpgraded(userId) {
  console.warn(
    `${PREFIX} Contraseña estaba en texto plano en BD; actualizada a pbkdf2_sha256 | user id=${userId}`,
  )
}

export function logLoginOk(userId, username, rol) {
  console.info(`${PREFIX} Sesión creada OK | id=${userId} username="${username}" rol=${rol}`)
}
