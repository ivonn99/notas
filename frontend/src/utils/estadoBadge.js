export function estadoBadgeClass(estado) {
  const s = String(estado || '').toUpperCase()
  if (s === 'PENDIENTE') return 'text-bg-warning'
  if (s === 'RESUELTA') return 'text-bg-success'
  if (s === 'CANCELADA') return 'text-bg-danger'
  return 'text-bg-secondary'
}

/** La bandera requiere_atencion solo aplica a notas en trámite; RESUELTA/CANCELADA no deben mostrarse como “en atención”. */
export function notaMuestraAtencion(nota) {
  return String(nota?.estado || '').toUpperCase() === 'PENDIENTE' && Boolean(nota?.requiere_atencion)
}
