export function estadoBadgeClass(estado) {
  const s = String(estado || '').toUpperCase()
  if (s === 'PENDIENTE') return 'text-bg-warning'
  if (s === 'RESUELTA') return 'text-bg-success'
  if (s === 'CANCELADA') return 'text-bg-danger'
  return 'text-bg-secondary'
}
