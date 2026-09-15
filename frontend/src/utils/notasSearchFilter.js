/**
 * Filtro de búsqueda q para listados de notas (PostgREST `.or()`).
 * - Token tipo folio (sin espacios): solo serie_folio (igualdad + prefijo) — plan barato
 * - Texto libre: contains en folio / cliente / vendedor
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

/** Parece folio pegado (A123, SERIE-001), no nombre de cliente con espacios. */
export function looksLikeFolioToken(q) {
  const s = String(q || '').trim()
  if (s.length < 2) return false
  if (/\s/.test(s)) return false
  return /^[A-Za-z0-9][A-Za-z0-9._\-/]*$/.test(s)
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

  // Folio: no OR con cliente/vendedor (era la causa típica de statement timeout).
  if (looksLikeFolioToken(q)) {
    const exact = escapePostgrestValue(lit)
    const prefix = escapePostgrestValue(`${lit}%`)
    return `serie_folio.ilike.${exact},serie_folio.ilike.${prefix}`
  }

  const contains = escapePostgrestValue(`%${lit}%`)
  return `serie_folio.ilike.${contains},cliente.ilike.${contains},usuario_vendedor_pv.ilike.${contains}`
}
