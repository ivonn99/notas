export function estadoBadgeClass(estado) {
  const s = String(estado || '').toUpperCase()
  if (s === 'PENDIENTE') return 'text-bg-warning'
  if (s === 'RESUELTA') return 'text-bg-success'
  if (s === 'CANCELADA') return 'text-bg-danger'
  return 'text-bg-secondary'
}

/**
 * Atención se determina por regla de negocio visible:
 * nota pendiente + al menos un comentario registrado.
 */
export function notaMuestraAtencion(nota) {
  return String(nota?.estado || '').toUpperCase() === 'PENDIENTE' && Boolean(nota?.tiene_comentarios)
}
