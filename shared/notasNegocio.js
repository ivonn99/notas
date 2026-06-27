/** Reglas puras de negocio — módulo compartido. Ver docs/reglas-negocio.md */

export const ESTADOS_NOTA = new Set(['PENDIENTE', 'RESUELTA', 'CANCELADA'])

/** Comentar activa requiere_atencion solo en notas PENDIENTE. */
export function shouldSetRequiereAtencionOnComment(estadoNota) {
  return String(estadoNota || '').trim().toUpperCase() === 'PENDIENTE'
}

/** Al resolver/cancelar se apaga requiere_atencion; en PENDIENTE se conserva. */
export function requiereAtencionAfterEstadoChange(nuevoEstado, requiereAtencionActual) {
  const e = String(nuevoEstado || '').trim().toUpperCase()
  if (e === 'RESUELTA' || e === 'CANCELADA') return false
  return Boolean(requiereAtencionActual)
}

export function canManageNotaEstado(user) {
  if (!user) return false
  if (user.isSuperuser) return true
  const rol = String(user.rol || '').toUpperCase()
  return rol === 'ADMIN' || rol === 'CREDITO'
}

export function canManageNotaRuta(user) {
  if (!user) return false
  if (user.isSuperuser) return true
  return String(user.rol || '').toUpperCase() === 'ADMIN'
}
