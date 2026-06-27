/** Validación de filas de importación — módulo compartido API + frontend. Ver docs/reglas-negocio.md §8 */

export const EMPRESAS_VALIDAS = new Set(['DISTRIBUIDORA', 'RODRIGO'])
export const ESTADOS_VALIDOS = new Set(['PENDIENTE', 'RESUELTA', 'CANCELADA'])

/** @returns {'DISTRIBUIDORA' | 'RODRIGO' | null} */
export function parseEmpresaImportacion(raw) {
  const e = String(raw ?? '')
    .trim()
    .toUpperCase()
  return EMPRESAS_VALIDAS.has(e) ? e : null
}

/**
 * @param {object} row — fila normalizada (serieFolio, empresa, estado, requiereAtencion, …)
 * @param {Map|object|null} _rutaMap — reservado
 * @param {'DISTRIBUIDORA'|'RODRIGO'|null} empresaScope
 * @returns {string[]} errores (vacío = válida)
 */
export function validateNormalized(row, _rutaMap = null, empresaScope = null) {
  const errors = []
  if (!row.serieFolio) errors.push('serie_folio obligatorio')
  if (!row.empresa) errors.push('empresa obligatoria')
  if (row.empresa && !EMPRESAS_VALIDAS.has(row.empresa)) {
    errors.push(`empresa inválida: ${row.empresa}`)
  }
  if (empresaScope) {
    const got = String(row.empresa || '')
      .trim()
      .toUpperCase()
    if (got !== empresaScope) {
      errors.push(
        `empresa de la fila (${got || 'vacía'}) debe coincidir con la empresa elegida para esta importación (${empresaScope})`,
      )
    }
  }
  if (row.estado && !ESTADOS_VALIDOS.has(row.estado)) {
    errors.push(`estado inválido: ${row.estado}`)
  }
  if (
    row.estado &&
    ['RESUELTA', 'CANCELADA'].includes(row.estado) &&
    row.requiereAtencion
  ) {
    errors.push('no puede haber requiere_atencion en true si estado es RESUELTA o CANCELADA')
  }
  if (row.monto == null) errors.push('monto inválido')
  if (row.abono == null) errors.push('abono inválido')
  if (!row.fechaNota) errors.push('fecha_nota inválida (usa dd/mm/aaaa o yyyy-mm-dd)')
  return errors
}
