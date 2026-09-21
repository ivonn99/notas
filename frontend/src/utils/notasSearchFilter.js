/**
 * Filtro de búsqueda q para listados de notas (PostgREST `.or()`).
 * Siempre busca en serie_folio, cliente y usuario_vendedor_pv (contiene).
 *
 * PostgREST no expone ESCAPE en ilike: se neutralizan % y _ del input.
 */

function sanitizeIlikeLiteral(raw) {
  return String(raw ?? '').replace(/[%_]/g, '')
}

/** Valores con caracteres reservados de PostgREST van entre comillas. */
function escapePostgrestValue(raw) {
  const s = String(raw ?? '')
  if (/[,.():"]/.test(s) || /\s/.test(s)) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return s
}

/**
 * Cláusula interna para `.or(...)` (sin el wrapper `or()`).
 * @returns {string|null}
 */
export function buildNotasSearchOrClause(qRaw) {
  const q = String(qRaw ?? '').trim()
  if (!q) return null

  const lit = sanitizeIlikeLiteral(q)
  if (!lit) return null

  const contains = escapePostgrestValue(`%${lit}%`)
  return `serie_folio.ilike.${contains},cliente.ilike.${contains},usuario_vendedor_pv.ilike.${contains}`
}
