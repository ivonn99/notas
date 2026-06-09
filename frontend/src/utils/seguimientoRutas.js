/** Parsea códigos de ruta separados por coma (mayúsculas, sin duplicados). */
export function parseRutasList(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return []
  return [...new Set(s.split(',').map((part) => part.trim().toUpperCase()).filter(Boolean))]
}

/** Serializa lista de códigos para el store / query string. */
export function formatRutasList(codes) {
  if (!Array.isArray(codes) || codes.length === 0) return ''
  return [...new Set(codes.map((c) => String(c).trim().toUpperCase()).filter(Boolean))].join(',')
}
