/** Reglas puras de negocio — módulo compartido. Ver docs/reglas-negocio.md */

export const ESTADOS_NOTA = new Set(['PENDIENTE', 'RESUELTA', 'CANCELADA'])

/**
 * Definición operativa de «requiere atención»:
 * nota PENDIENTE (no resuelta) que tiene al menos un comentario/aclaración.
 *
 * @param {{ estado?: string, tiene_comentarios?: boolean, aclaraciones?: unknown[], requiere_atencion?: boolean }} nota
 */
export function notaRequiereAtencion(nota) {
  const estado = String(nota?.estado || '').trim().toUpperCase()
  if (estado !== 'PENDIENTE') return false
  if (Boolean(nota?.tiene_comentarios)) return true
  if (Array.isArray(nota?.aclaraciones) && nota.aclaraciones.length > 0) return true
  // Fallback a la bandera en BD (caché) cuando aún no se cargaron aclaraciones.
  return Boolean(nota?.requiere_atencion)
}

/** Valor de la bandera BD tras comentar: solo se enciende en PENDIENTE. */
export function shouldSetRequiereAtencionOnComment(estadoNota) {
  return String(estadoNota || '').trim().toUpperCase() === 'PENDIENTE'
}

/**
 * Valor de la bandera BD coherente con la regla:
 * PENDIENTE + quedan comentarios → true; si no → false.
 */
export function requiereAtencionFromComentariosRestantes(estadoNota, comentariosRestantes) {
  const estado = String(estadoNota || '').trim().toUpperCase()
  if (estado !== 'PENDIENTE') return false
  return Number(comentariosRestantes) > 0
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
