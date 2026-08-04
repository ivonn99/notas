import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

import { fetchSeguimientoList } from '../services/seguimientoApi.js'
import { formatDiasNotaCorriente, formatFechaNotaDb } from './diasCorriente.js'
import { notaMuestraAtencion } from './estadoBadge.js'

const EXPORT_PAGE_SIZE = 100
/** Tope de filas en PDF (más liviano que Excel). 100 × 50 = 5000. */
const MAX_EXPORT_PAGES = 50

function safeFilePart(value) {
  const s = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return s.slice(0, 40) || 'todos'
}

function money(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(n)
}

async function fetchAllItems(filtros = {}) {
  const base = {
    pageSize: EXPORT_PAGE_SIZE,
    empresa: filtros.empresa,
    estado: filtros.estado,
    atencion: filtros.atencion,
    rutas: filtros.rutas,
    q: filtros.q,
    sort: filtros.sort,
    ...(filtros.dias_bucket ? { dias_bucket: filtros.dias_bucket } : {}),
  }

  const allItems = []
  let page = 1
  let totalReported = 0
  let totalPages = 1
  let truncated = false
  let resumen = null

  while (true) {
    if (page > MAX_EXPORT_PAGES) {
      truncated = true
      break
    }
    const r = await fetchSeguimientoList({
      ...base,
      page,
      ...(page === 1 ? { includeAggregates: 'true' } : { includeAggregates: 'false' }),
    })
    if (page === 1 && r.resumen) resumen = r.resumen
    if (typeof r.total === 'number') totalReported = r.total
    totalPages = r.totalPages ?? 1
    allItems.push(...(r.items || []))
    if (page >= totalPages) break
    page += 1
  }

  if (!truncated && totalReported > 0 && allItems.length < totalReported) {
    truncated = true
  }

  return { allItems, totalReported, truncated, base, resumen }
}

function sumMoneyFields(items) {
  let monto = 0
  let abono = 0
  let saldo = 0
  for (const n of items || []) {
    const m = Number(n.monto)
    const a = Number(n.abono)
    const s = Number(n.saldo)
    if (Number.isFinite(m)) monto += m
    if (Number.isFinite(a)) abono += a
    if (Number.isFinite(s)) saldo += s
  }
  return { monto, abono, saldo }
}

function buildFiltrosLines(filtros) {
  const lines = [
    `Empresa: ${filtros.empresa || '—'}`,
    `Estado: ${filtros.estado || 'Todos'}`,
  ]
  if (filtros.atencion) lines.push(`Atención: ${filtros.atencion}`)
  if (filtros.rutas) lines.push(`Rutas: ${filtros.rutas}`)
  if (filtros.dias_bucket) lines.push(`Antigüedad: ${filtros.dias_bucket}`)
  if (filtros.q) lines.push(`Búsqueda: ${filtros.q}`)
  return lines
}

/**
 * Descarga un PDF con el listado de seguimiento (mismos filtros que la pantalla).
 *
 * @param {object} filtros
 * @returns {Promise<{ rowCount: number, truncated: boolean, totalReported: number, filename: string }>}
 */
export async function exportarSeguimientoPdfConFiltros(filtros = {}) {
  const { allItems, totalReported, truncated, base, resumen } = await fetchAllItems(filtros)
  const sumasPdf = sumMoneyFields(allItems)
  const usarResumenCompleto = !truncated && resumen
  const sumasMostrar = {
    monto: usarResumenCompleto ? Number(resumen.monto_total ?? sumasPdf.monto) : sumasPdf.monto,
    abono: usarResumenCompleto ? Number(resumen.abono_total ?? sumasPdf.abono) : sumasPdf.abono,
    saldo: usarResumenCompleto ? Number(resumen.saldo_total ?? sumasPdf.saldo) : sumasPdf.saldo,
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const generatedAt = new Date().toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Seguimiento — Listado de notas', 12, 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(80)
  doc.text(`Generado: ${generatedAt}`, 12, 20)

  let y = 26
  for (const line of buildFiltrosLines(base)) {
    doc.text(line, 12, y)
    y += 4
  }

  doc.text(
    `Registros en PDF: ${allItems.length.toLocaleString('es-MX')}` +
      (totalReported ? ` de ${totalReported.toLocaleString('es-MX')} filtrados` : ''),
    12,
    y,
  )
  y += 4

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(33, 37, 41)
  doc.text(
    `Sumas: Monto ${money(sumasMostrar.monto)}  |  Abono ${money(sumasMostrar.abono)}  |  Saldo ${money(sumasMostrar.saldo)}`,
    12,
    y,
  )
  doc.setFont('helvetica', 'normal')
  y += 4

  if (truncated) {
    doc.setTextColor(120, 80, 0)
    doc.text(
      `Listado truncado por límite de seguridad (máx. ${(MAX_EXPORT_PAGES * EXPORT_PAGE_SIZE).toLocaleString('es-MX')} filas). Las sumas corresponden a las filas incluidas en este PDF.`,
      12,
      y,
      { maxWidth: doc.internal.pageSize.getWidth() - 24 },
    )
    doc.setTextColor(80)
    y += 7
  }

  doc.setTextColor(33, 37, 41)

  const body = allItems.map((n) => [
    String(n.id ?? ''),
    n.serie_folio || '—',
    formatFechaNotaDb(n.fecha_nota) === '—' ? '—' : formatFechaNotaDb(n.fecha_nota),
    formatDiasNotaCorriente(n.fecha_nota, n.fecha_corriente) ?? '—',
    n.cliente || '—',
    n.empresa || '—',
    n.ruta_codigo || '—',
    money(n.monto),
    money(n.abono),
    money(n.saldo),
    n.estado || '—',
    notaMuestraAtencion(n) ? 'Sí' : 'No',
    n.vendedor_username || n.usuario_vendedor_pv || '—',
  ])

  const notasLabel = truncated
    ? `Suma (PDF) (${allItems.length.toLocaleString('es-MX')} notas)`
    : `Suma filtrada (${(usarResumenCompleto
        ? Number(resumen?.total_filtrado ?? allItems.length)
        : allItems.length
      ).toLocaleString('es-MX')} notas)`

  autoTable(doc, {
    startY: y + 2,
    head: [
      [
        'ID',
        'Serie/Folio',
        'Fecha nota',
        'Días',
        'Cliente',
        'Empresa',
        'Ruta',
        'Monto',
        'Abono',
        'Saldo',
        'Estado',
        'Atención',
        'Vendedor',
      ],
    ],
    body: body.length
      ? body
      : [['—', 'Sin registros con los filtros actuales', '', '', '', '', '', '', '', '', '', '', '']],
    foot: body.length
      ? [
          [
            {
              content: notasLabel,
              colSpan: 7,
              styles: { halign: 'left', fontStyle: 'bold', textColor: [33, 37, 41] },
            },
            {
              content: money(sumasMostrar.monto),
              styles: { halign: 'right', fontStyle: 'bold', textColor: [33, 37, 41] },
            },
            {
              content: money(sumasMostrar.abono),
              styles: { halign: 'right', fontStyle: 'bold', textColor: [33, 37, 41] },
            },
            {
              content: money(sumasMostrar.saldo),
              styles: { halign: 'right', fontStyle: 'bold', textColor: [47, 125, 50] },
            },
            { content: '', colSpan: 3 },
          ],
        ]
      : undefined,
    showFoot: body.length ? 'lastPage' : undefined,
    styles: {
      fontSize: 6.5,
      cellPadding: 1.5,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [47, 125, 50],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 7,
    },
    footStyles: {
      fillColor: [248, 249, 250],
      textColor: [33, 37, 41],
      fontStyle: 'bold',
      fontSize: 7,
      lineWidth: 0.1,
      lineColor: [222, 226, 230],
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250],
    },
    columnStyles: {
      0: { cellWidth: 12 },
      3: { halign: 'right', cellWidth: 12 },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
      11: { halign: 'center', cellWidth: 14 },
    },
    margin: { left: 10, right: 10 },
  })

  const totalPdfPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPdfPages; i += 1) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(
      `Página ${i} de ${totalPdfPages}`,
      doc.internal.pageSize.getWidth() - 10,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'right' },
    )
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `seguimiento_${safeFilePart(base.empresa)}_${stamp}.pdf`
  doc.save(filename)

  return {
    rowCount: allItems.length,
    truncated,
    totalReported: totalReported || allItems.length,
    filename,
  }
}
