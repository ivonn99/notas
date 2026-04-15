import * as XLSX from 'xlsx'

import { fetchSeguimientoList } from '../services/seguimientoApi.js'
import { formatDiasNotaCorriente } from './diasCorriente.js'
import { notaMuestraAtencion } from './estadoBadge.js'

const EXPORT_PAGE_SIZE = 100
/** Límite de páginas para evitar cargas excesivas en memoria (100 x 300 = 30000 filas max.). */
const MAX_EXPORT_PAGES = 300

function formatFechaNotaIso(value) {
  if (value == null || value === '') return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function safeFilePart(value) {
  const s = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return s.slice(0, 40) || 'todos'
}

/**
 * Descarga un .xlsx con el listado de seguimiento aplicando los mismos filtros que la pantalla
 * (empresa, estado, atención, ruta, texto de búsqueda y orden).
 *
 * @param {object} filtros
 * @param {string} [filtros.empresa]
 * @param {string} [filtros.estado]
 * @param {string} [filtros.atencion]
 * @param {string} [filtros.ruta]
 * @param {string} [filtros.q]
 * @param {string} [filtros.sort]
 * @param {string|number} [filtros.dias]
 * @returns {Promise<{ rowCount: number, truncated: boolean, totalReported: number }>}
 */
export async function exportarSeguimientoExcelConFiltros(filtros = {}) {
  const base = {
    pageSize: EXPORT_PAGE_SIZE,
    empresa: filtros.empresa,
    estado: filtros.estado,
    atencion: filtros.atencion,
    ruta: filtros.ruta,
    q: filtros.q,
    sort: filtros.sort,
    ...(filtros.dias ? { dias: filtros.dias } : {}),
  }

  const allItems = []
  let page = 1
  let totalReported = 0
  let totalPages = 1
  let truncated = false

  while (true) {
    if (page > MAX_EXPORT_PAGES) {
      truncated = true
      break
    }
    const r = await fetchSeguimientoList({ ...base, page })
    if (typeof r.total === 'number') totalReported = r.total
    totalPages = r.totalPages ?? 1
    allItems.push(...(r.items || []))
    if (page >= totalPages) break
    page += 1
  }

  if (!truncated && totalReported > 0 && allItems.length < totalReported) {
    truncated = true
  }

  const rows = allItems.map((n) => ({
    ID: n.id,
    'Serie/Folio': n.serie_folio || '',
    'Fecha nota': formatFechaNotaIso(n.fecha_nota),
    Días: formatDiasNotaCorriente(n.fecha_nota, n.fecha_corriente) ?? '',
    Cliente: n.cliente || '',
    Empresa: n.empresa || '',
    Ruta: n.ruta_codigo || '',
    Monto: n.monto != null && n.monto !== '' ? Number(n.monto) : '',
    Abono: n.abono != null && n.abono !== '' ? Number(n.abono) : '',
    Saldo: n.saldo != null && n.saldo !== '' ? Number(n.saldo) : '',
    Estado: n.estado || '',
    'Requiere atención': notaMuestraAtencion(n) ? 'Sí' : 'No',
    Vendedor: n.vendedor_username || n.usuario_vendedor_pv || '',
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Seguimiento')

  const stamp = new Date().toISOString().slice(0, 10)
  const emp = safeFilePart(base.empresa)
  XLSX.writeFile(wb, `seguimiento_${emp}_${stamp}.xlsx`)

  return {
    rowCount: rows.length,
    truncated,
    totalReported: totalReported || rows.length,
  }
}
