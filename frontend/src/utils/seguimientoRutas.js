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

/**
 * Resuelve ids de ruta por código (insensible a mayúsculas / espacios).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[] | string} codigos
 */
export async function fetchRutaIdsByCodigos(supabase, codigos) {
  const list = Array.isArray(codigos) ? formatRutasList(codigos).split(',').filter(Boolean) : parseRutasList(codigos)
  if (!list.length) return []
  const { data, error } = await supabase
    .from('rutas')
    .select('id, codigo')
    .or(list.map((c) => `codigo.ilike.${c}`).join(','))
  if (error) throw new Error(error.message || 'No se pudo filtrar por ruta')
  const want = new Set(list)
  return (data || [])
    .filter((r) => want.has(String(r.codigo || '').trim().toUpperCase()))
    .map((r) => r.id)
}
