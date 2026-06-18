export function estadoBadgeClass(estado) {
  const s = String(estado || '').toUpperCase()
  if (s === 'PENDIENTE') return 'text-bg-warning'
  if (s === 'RESUELTA') return 'text-bg-success'
  if (s === 'CANCELADA') return 'text-bg-danger'
  return 'text-bg-secondary'
}

/**
 * Bandera operativa en notas_credito (comentario pendiente de revisión).
 * Distinto de «tiene comentarios» (historial en aclaraciones).
 */
export function notaMuestraAtencion(nota) {
  return Boolean(nota?.requiere_atencion)
}
