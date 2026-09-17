import * as XLSX from 'xlsx'

import { fetchSeguimientoList } from '../services/seguimientoApi.js'
import { formatDiasNotaCorriente, formatFechaNotaDb } from './diasCorriente.js'
import { notaMuestraAtencion } from './estadoBadge.js'

const EXPORT_PAGE_SIZE = 100
/** Límite de páginas para evitar cargas excesivas en memoria (100 x 300 = 30000 filas max.). */
const MAX_EXPORT_PAGES = 300

function safeFilePart(value) {
  const s = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return s.slice(0, 40) || 'todos'
}

function moneyNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function groupItemsByRuta(items) {
  const map = new Map()
  for (const n of items || []) {
    const key = String(n.ruta_codigo || '').trim() || '(sin ruta)'
    if (!map.has(key)) {
      map.set(key, { key, items: [], monto: 0, abono: 0, saldo: 0 })
    }
    const g = map.get(key)
    g.items.push(n)
    g.monto += moneyNumber(n.monto)
    g.abono += moneyNumber(n.abono)
    g.saldo += moneyNumber(n.saldo)
  }
  return [...map.values()].sort((a, b) =>
    String(a.key).localeCompare(String(b.key), 'es', { numeric: true }),
  )
}

function notaToFlatRow(n) {
  return {
    ID: n.id,
    'Serie/Folio': n.serie_folio || '',
    'Fecha nota': formatFechaNotaDb(n.fecha_nota) === '—' ? '' : formatFechaNotaDb(n.fecha_nota),
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
  }
}

async function fetchAllExportItems(filtros = {}) {
  const base = {
    pageSize: EXPORT_PAGE_SIZE,
    empresa: filtros.empresa,
    estado: filtros.estado,
    atencion: filtros.atencion,
    ...(filtros.rutas != null && String(filtros.rutas).trim()
      ? { rutas: filtros.rutas }
      : {}),
    q: filtros.q,
    sort: filtros.sort,
    ...(filtros.dias_bucket ? { dias_bucket: filtros.dias_bucket } : {}),
    ...(filtros.dias_min != null ? { dias_min: filtros.dias_min } : {}),
    ...(filtros.dias_max != null ? { dias_max: filtros.dias_max } : {}),
    ...(filtros.ignoreUsuarioRutasScope ? { ignoreUsuarioRutasScope: true } : {}),
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

  return { allItems, totalReported, truncated, base }
}

/**
 * Descarga un .xlsx con el listado (seguimiento o conciliación).
 *
 * @param {object} filtros
 * @param {object} [options]
 * @param {string} [options.title]
 * @param {string} [options.filePrefix]
 * @param {string} [options.sheetName]
 * @param {boolean} [options.groupByRuta]
 */
export async function exportarSeguimientoExcelConFiltros(filtros = {}, options = {}) {
  const title = String(options.title || 'Seguimiento').trim() || 'Seguimiento'
  const filePrefix = safeFilePart(options.filePrefix || 'seguimiento')
  const sheetName =
    String(options.sheetName || title)
      .replace(/[\\/?*[\]]/g, '')
      .slice(0, 31) || 'Listado'
  const groupByRuta = Boolean(options.groupByRuta)

  const { allItems, totalReported, truncated, base } = await fetchAllExportItems(filtros)

  const wb = XLSX.utils.book_new()

  if (groupByRuta) {
    const grupos = groupItemsByRuta(allItems)
    const aoa = [
      [title],
      [
        `Empresa: ${base.empresa || '—'}`,
        base.dias_min != null ? `Mayores a ${base.dias_min} días` : '',
        base.dias_max != null ? `Menores a ${base.dias_max} días` : '',
        base.dias_bucket ? `Antigüedad: ${base.dias_bucket}` : '',
        base.estado ? `Estado: ${base.estado}` : '',
        base.q ? `Búsqueda: ${base.q}` : '',
      ].filter(Boolean),
      [],
      [
        'Grupo / Ruta',
        'ID',
        'Serie/Folio',
        'Fecha nota',
        'Días',
        'Cliente',
        'Empresa',
        'Monto',
        'Abono',
        'Saldo',
        'Estado',
        'Requiere atención',
        'Vendedor',
      ],
    ]

    for (const g of grupos) {
      aoa.push([
        `Ruta ${g.key} (${g.items.length} nota${g.items.length === 1 ? '' : 's'})`,
        '',
        '',
        '',
        '',
        '',
        '',
        g.monto,
        g.abono,
        g.saldo,
        '',
        '',
        '',
      ])
      for (const n of g.items) {
        aoa.push([
          '',
          n.id,
          n.serie_folio || '',
          formatFechaNotaDb(n.fecha_nota) === '—' ? '' : formatFechaNotaDb(n.fecha_nota),
          formatDiasNotaCorriente(n.fecha_nota, n.fecha_corriente) ?? '',
          n.cliente || '',
          n.empresa || '',
          n.monto != null && n.monto !== '' ? Number(n.monto) : '',
          n.abono != null && n.abono !== '' ? Number(n.abono) : '',
          n.saldo != null && n.saldo !== '' ? Number(n.saldo) : '',
          n.estado || '',
          notaMuestraAtencion(n) ? 'Sí' : 'No',
          n.vendedor_username || n.usuario_vendedor_pv || '',
        ])
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)

    const resumenRows = grupos.map((g) => ({
      Ruta: g.key,
      Notas: g.items.length,
      Monto: g.monto,
      Abono: g.abono,
      Saldo: g.saldo,
    }))
    const wsResumen = XLSX.utils.json_to_sheet(resumenRows)
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen por ruta')
  } else {
    const rows = allItems.map((n) => notaToFlatRow(n))
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const emp = safeFilePart(base.empresa)
  XLSX.writeFile(wb, `${filePrefix}_${emp}_${stamp}.xlsx`)

  return {
    rowCount: allItems.length,
    truncated,
    totalReported: totalReported || allItems.length,
  }
}
