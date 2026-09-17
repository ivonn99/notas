/** Sentinel: ninguna ruta seleccionada (distinto de vacío = Todas). */
export const RUTAS_FILTRO_NINGUNA = '__NONE__'

export function isRutasFiltroNinguna(raw) {
  return String(raw ?? '').trim().toUpperCase() === RUTAS_FILTRO_NINGUNA
}

/** Etiqueta corta para exports / banners (evita listar decenas de códigos). */
export function describeRutasFiltroExport(rutasRaw) {
  if (isRutasFiltroNinguna(rutasRaw)) return 'Ninguna'
  const s = String(rutasRaw ?? '').trim()
  if (!s) return 'Todas'
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length > 6) return `${parts.length} rutas`
  return s
}

/** Parsea códigos de ruta separados por coma (mayúsculas, sin duplicados). */
export function parseRutasList(raw) {
  if (isRutasFiltroNinguna(raw)) return []
  const s = String(raw ?? '').trim()
  if (!s) return []
  return [...new Set(s.split(',').map((part) => part.trim().toUpperCase()).filter(Boolean))]
}

/**
 * Modo visual/lógico del filtro de rutas.
 * - all: vacío → todas las rutas
 * - none: sentinel → ninguna seleccionada
 * - some: uno o más códigos
 */
export function getRutasFiltroMode(raw) {
  if (isRutasFiltroNinguna(raw)) return 'none'
  const codes = parseRutasList(raw)
  if (codes.length === 0) return 'all'
  return 'some'
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
