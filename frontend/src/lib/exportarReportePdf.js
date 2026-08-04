import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const BUCKET_LABELS = {
  negativo: 'Fecha inconsistente',
  d0_30: '0–30 días',
  d31_45: '31–45 días',
  d46_60: '46–60 días',
  d61_90: '61–90 días',
  d91_180: '91–180 días',
  d181_365: '181–365 días',
  d366_plus: 'Más de 365 días',
}

const SITUACION_LABELS = {
  requiere_atencion: 'Requiere atención',
  sin_comentarios: 'Sin comentarios',
  sin_ruta: 'Sin ruta asignada',
  sin_vendedor: 'Sin vendedor',
  antiguedad_90: 'Más de 90 días',
  antiguedad_180: 'Más de 180 días',
  saldo_cero: 'Saldo en cero',
  resuelta_automatica: 'Resuelta automáticamente',
}

const TAB_LABELS = {
  indicadores: 'Indicadores',
  atraso_estructural: 'Atraso estructural',
  panel_general: 'Detalle',
  tablas: 'Panel general',
}

const SUBVISTA_LABELS = {
  rutas: 'Por ruta',
  pivot: 'Por antigüedad',
  resumen: 'Resumen',
}

const DIAS_BUCKET_LABELS = {
  all: 'Todos',
  r1: '0–30 d',
  r2: '31–45 d',
  r2b: '46–60 d',
  r3: '61–90 d',
  r4: '91–180 d',
  r5: '181–365 d',
  r6: '>365 d',
}

const BUCKET_ORDER = [
  'negativo',
  'd0_30',
  'd31_45',
  'd46_60',
  'd61_90',
  'd91_180',
  'd181_365',
  'd366_plus',
]

/** Buckets visibles en PDF (sin “Fecha inconsistente”). */
const BUCKET_ORDER_PDF = BUCKET_ORDER.filter((id) => id !== 'negativo')

function money(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(n)
}

function pct(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${n.toFixed(1)}%`
}

function fmtDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtNum(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('es-MX')
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
}

function tableTheme() {
  return {
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [33, 37, 41],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250],
    },
    margin: { left: 12, right: 12 },
  }
}

function addSectionTitle(doc, title, y) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(33, 37, 41)
  doc.text(title, 12, y)
  return y + 4
}

function addKpiBlock(doc, startY, rows) {
  autoTable(doc, {
    ...tableTheme(),
    startY,
    head: [['Indicador', 'Valor']],
    body: rows,
    columnStyles: {
      0: { cellWidth: 70 },
      1: { halign: 'right' },
    },
  })
  return doc.lastAutoTable.finalY + 8
}

function addDataTable(doc, startY, head, body, columnStyles = {}, options = {}) {
  autoTable(doc, {
    ...tableTheme(),
    startY,
    head: [head],
    body: body.length ? body : [['Sin datos']],
    columnStyles,
    ...(options.foot
      ? {
          foot: [options.foot],
          showFoot: 'lastPage',
          footStyles: {
            fillColor: [248, 249, 250],
            textColor: [33, 37, 41],
            fontStyle: 'bold',
            fontSize: 7,
            lineWidth: 0.1,
            lineColor: [222, 226, 230],
          },
        }
      : {}),
  })
  return doc.lastAutoTable.finalY + 8
}

function buildFiltrosLines(meta) {
  const diasLabel = DIAS_BUCKET_LABELS[meta.diasBucket] || meta.diasBucket || 'Todos'
  const lines = [
    `Empresa: ${meta.empresaActiva || '—'}`,
    `Estado: ${meta.estado || '—'}`,
    `Antigüedad: ${diasLabel}`,
  ]
  if (meta.fechaDesde || meta.fechaHasta) {
    lines.push(`Fechas: ${meta.fechaDesde || '—'} → ${meta.fechaHasta || '—'}`)
  }
  if (meta.rutas) lines.push(`Rutas: ${meta.rutas}`)
  if (meta.q) lines.push(`Búsqueda: ${meta.q}`)
  return lines
}

function writeHeader(doc, meta) {
  const generatedAt = new Date().toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const vistaLabel =
    meta.pestanaPrincipal === 'tablas'
      ? `${TAB_LABELS.tablas} — ${SUBVISTA_LABELS[meta.subVista] || meta.subVista}`
      : TAB_LABELS[meta.pestanaPrincipal] || meta.pestanaPrincipal

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Reporte — Cartera', 12, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80)
  doc.text(`Vista: ${vistaLabel}`, 12, 22)
  doc.text(`Generado: ${generatedAt}`, 12, 27)

  let y = 34
  for (const line of buildFiltrosLines(meta)) {
    doc.text(line, 12, y)
    y += 4.5
  }
  doc.setTextColor(33, 37, 41)
  return y + 4
}

function exportIndicadores(doc, payload, startY) {
  const kpis = payload?.kpis || {}
  let y = addSectionTitle(doc, 'KPIs', startY)
  y = addKpiBlock(doc, y, [
    ['Registros', fmtNum(kpis.registros)],
    ['Saldo total', money(kpis.saldo_total)],
    ['Monto / Abonos', `${money(kpis.monto_total)} / ${money(kpis.abonos_total)}`],
    ['Días promedio', Number(kpis.dias_promedio ?? 0).toFixed(1)],
    ['>365 días', fmtNum(kpis.vencidos_365)],
    ['Rutas (con código)', fmtNum(kpis.rutas_activas)],
    ['Requieren atención', `${fmtNum(kpis.requiere_atencion)} (${pct(kpis.requiere_atencion_pct)})`],
    ['% recuperado', pct(kpis.pct_recuperado)],
    ['Saldo >90 días', `${money(kpis.saldo_mas_90)} (${fmtNum(kpis.notas_mas_90)} notas)`],
    ['Saldo >180 días', `${money(kpis.saldo_mas_180)} (${fmtNum(kpis.notas_mas_180)} notas)`],
  ])

  y = addSectionTitle(doc, 'Antigüedad de cartera', y)
  y = addDataTable(
    doc,
    y,
    ['Tramo', 'Notas', 'Saldo'],
    (payload?.porAntiguedad || []).map((r) => [
      BUCKET_LABELS[r.bucket_id] || r.bucket_id,
      fmtNum(r.notas),
      money(r.saldo_total),
    ]),
    { 1: { halign: 'right' }, 2: { halign: 'right' } },
  )

  y = addSectionTitle(doc, 'Top rutas por saldo pendiente', y)
  y = addDataTable(
    doc,
    y,
    ['Ruta', 'Notas', 'Saldo'],
    (payload?.porRuta || []).slice(0, 15).map((r) => [r.ruta_codigo, fmtNum(r.notas), money(r.saldo_total)]),
    { 1: { halign: 'right' }, 2: { halign: 'right' } },
  )

  y = addSectionTitle(doc, 'Por situación', y)
  y = addDataTable(
    doc,
    y,
    ['Situación', 'Notas', 'Saldo'],
    (payload?.porSituacion || []).map((r) => [
      SITUACION_LABELS[r.situacion_id] || r.situacion_id,
      fmtNum(r.notas),
      money(r.saldo_total),
    ]),
    { 1: { halign: 'right' }, 2: { halign: 'right' } },
  )

  y = addSectionTitle(doc, 'Top clientes por saldo', y)
  addDataTable(
    doc,
    y,
    ['Cliente', 'Notas', 'Saldo'],
    (payload?.porCliente || []).map((r) => [r.cliente, fmtNum(r.notas), money(r.saldo_total)]),
    { 1: { halign: 'right' }, 2: { halign: 'right' } },
  )
}

function exportAtrasoEstructural(doc, payload, startY) {
  const kpis = payload?.kpis || {}
  const atraso = payload?.atrasoEstructural || {}
  const diasCorte = atraso.dias_corte ?? 30
  const porRuta = atraso.porRuta || []
  const clientes = (atraso.items || []).filter((r) => r.atraso_estructural)

  let y = addSectionTitle(doc, 'Resumen atraso estructural', startY)
  y = addKpiBlock(doc, y, [
    [
      'Rutas con atraso',
      `${fmtNum(kpis.atraso_estructural_rutas)} (${pct(kpis.atraso_estructural_rutas_pct)} de ${fmtNum(atraso.rutas_total)})`,
    ],
    [
      'Clientes con atraso',
      `${fmtNum(kpis.atraso_estructural_clientes)} (${pct(kpis.atraso_estructural_clientes_pct)} de ${fmtNum(atraso.clientes_total)})`,
    ],
    ['Saldo en atraso (clientes)', money(kpis.atraso_estructural_saldo)],
    ['Cartera pendiente total', money(atraso.saldo_cartera_total)],
  ])

  y = addSectionTitle(doc, 'Atraso estructural por ruta', y)
  y = addDataTable(
    doc,
    y,
    [
      'Ruta',
      'Notas',
      `Saldo 0–${diasCorte} d`,
      `Saldo >${diasCorte} d`,
      `% >${diasCorte} d`,
      'Saldo total',
      'Estado',
    ],
    porRuta.map((r) => [
      r.ruta_codigo,
      fmtNum(r.notas),
      money(r.saldo_0_30),
      money(r.saldo_mas_30),
      pct(r.pct_mas_30),
      money(r.saldo_total),
      r.atraso_estructural ? 'Atraso estructural' : 'OK',
    ]),
    {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
  )

  y = addSectionTitle(doc, 'Clientes con atraso estructural', y)
  addDataTable(
    doc,
    y,
    [
      'Cliente',
      'Notas',
      `Saldo 0–${diasCorte} d`,
      `Saldo >${diasCorte} d`,
      `% >${diasCorte} d`,
      'Saldo total',
      'Estado',
    ],
    clientes.map((r) => [
      r.cliente,
      fmtNum(r.notas),
      money(r.saldo_0_30),
      money(r.saldo_mas_30),
      pct(r.pct_mas_30),
      money(r.saldo_total),
      'Atraso estructural',
    ]),
    {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
  )
}

function exportDetalle(doc, payload, startY) {
  const items = payload?.items || []
  let y = startY
  if (payload?.truncated) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120, 80, 0)
    doc.text(
      `Hay más de ${payload.maxRows} notas; el PDF incluye las primeras ${items.length} según el orden elegido.`,
      12,
      y,
      { maxWidth: doc.internal.pageSize.getWidth() - 24 },
    )
    doc.setTextColor(33, 37, 41)
    y += 8
  }

  y = addSectionTitle(doc, 'Detalle de notas', y)
  addDataTable(
    doc,
    y,
    ['Folio', 'Cliente', 'Ruta', 'Vendedor', 'Días', 'Monto', 'Abono', 'Saldo', 'Estado', 'Fecha'],
    items.map((row) => [
      row.serie_folio || '—',
      row.cliente || '—',
      row.ruta_codigo || '—',
      row.usuario_vendedor_pv || row.vendedor_username || '—',
      fmtNum(row.dias),
      money(row.monto),
      money(row.abono),
      money(row.saldo),
      row.estado || '—',
      fmtDate(row.fecha_nota),
    ]),
    {
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
    },
  )
}

function exportPorRuta(doc, payload, startY) {
  const rows = payload?.porRuta || []
  let y = addSectionTitle(doc, 'Por ruta', startY)
  const sumas = rows.reduce(
    (acc, r) => ({
      notas: acc.notas + (Number(r.notas) || 0),
      saldo: acc.saldo + (Number(r.saldo_total) || 0),
      monto: acc.monto + (Number(r.monto_total) || 0),
      abono: acc.abono + (Number(r.abono_total) || 0),
    }),
    { notas: 0, saldo: 0, monto: 0, abono: 0 },
  )
  addDataTable(
    doc,
    y,
    ['Ruta', 'Notas', 'Saldo', 'Monto', 'Abonos'],
    rows.map((r) => [
      r.ruta_codigo,
      fmtNum(r.notas),
      money(r.saldo_total),
      money(r.monto_total),
      money(r.abono_total),
    ]),
    {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
    rows.length
      ? {
          foot: [
            'Suma total',
            fmtNum(sumas.notas),
            money(sumas.saldo),
            money(sumas.monto),
            money(sumas.abono),
          ],
        }
      : {},
  )
}

function exportPorAntiguedad(doc, payload, startY) {
  const rows = (payload?.porAntiguedad || []).filter((r) => r.bucket_id !== 'negativo')
  let y = addSectionTitle(doc, 'Por antigüedad', startY)
  const sumas = rows.reduce(
    (acc, r) => ({
      notas: acc.notas + (Number(r.notas) || 0),
      saldo: acc.saldo + (Number(r.saldo_total) || 0),
    }),
    { notas: 0, saldo: 0 },
  )
  addDataTable(
    doc,
    y,
    ['Tramo de antigüedad', 'Notas', 'Saldo'],
    rows.map((r) => [
      BUCKET_LABELS[r.bucket_id] || r.bucket_id,
      fmtNum(r.notas),
      money(r.saldo_total),
    ]),
    { 1: { halign: 'right' }, 2: { halign: 'right' } },
    rows.length
      ? {
          foot: ['Suma total', fmtNum(sumas.notas), money(sumas.saldo)],
        }
      : {},
  )
}

function buildResumenMatrix(payload, resumenSortKey = 'total', resumenSortDir = 'desc') {
  const resumenPivot = payload?.resumenPivot || []
  const rutasColumns = [...new Set(resumenPivot.map((x) => x.ruta_codigo || '(sin ruta)'))].sort((a, b) =>
    String(a).localeCompare(String(b)),
  )
  const resumenMatrix = BUCKET_ORDER.map((bucketId) => {
    const row = { bucketId, totalSaldo: 0, byRuta: {} }
    for (const ruta of rutasColumns) row.byRuta[ruta] = { saldo: 0, notas: 0 }
    return row
  })
  const resumenIdx = Object.fromEntries(resumenMatrix.map((r, i) => [r.bucketId, i]))

  for (const it of resumenPivot) {
    const bucketId = String(it.bucket_id || 'negativo')
    const idx = resumenIdx[bucketId]
    if (idx == null) continue
    const ruta = it.ruta_codigo || '(sin ruta)'
    const saldo = Number(it.saldo_total || 0)
    const notas = Number(it.notas || 0)
    resumenMatrix[idx].byRuta[ruta].saldo += Number.isFinite(saldo) ? saldo : 0
    resumenMatrix[idx].byRuta[ruta].notas += Number.isFinite(notas) ? notas : 0
    resumenMatrix[idx].totalSaldo += Number.isFinite(saldo) ? saldo : 0
  }

  const totalByRuta = Object.fromEntries(rutasColumns.map((ruta) => [ruta, 0]))
  let granTotalSaldo = 0
  for (const bucketId of BUCKET_ORDER_PDF) {
    const row = resumenMatrix[resumenIdx[bucketId]]
    if (!row) continue
    granTotalSaldo += row.totalSaldo
    for (const ruta of rutasColumns) totalByRuta[ruta] += row.byRuta[ruta].saldo
  }

  const sortKey = BUCKET_ORDER_PDF.includes(resumenSortKey) ? resumenSortKey : 'total'
  const sortedRutasColumns = [...rutasColumns].sort((a, b) => {
    const aVal =
      sortKey === 'total'
        ? totalByRuta[a] || 0
        : resumenMatrix[resumenIdx[sortKey]]?.byRuta?.[a]?.saldo || 0
    const bVal =
      sortKey === 'total'
        ? totalByRuta[b] || 0
        : resumenMatrix[resumenIdx[sortKey]]?.byRuta?.[b]?.saldo || 0
    if (aVal === bVal) return String(a).localeCompare(String(b))
    return resumenSortDir === 'asc' ? aVal - bVal : bVal - aVal
  })

  return { resumenMatrix, resumenIdx, sortedRutasColumns, granTotalSaldo, totalByRuta }
}

function exportResumen(doc, payload, startY, meta) {
  const { resumenMatrix, resumenIdx, sortedRutasColumns, granTotalSaldo } = buildResumenMatrix(
    payload,
    meta.resumenSortKey,
    meta.resumenSortDir,
  )

  let y = addSectionTitle(doc, 'Resumen ruta × antigüedad', startY)
  const head = ['Ruta', ...BUCKET_ORDER_PDF.map((id) => BUCKET_LABELS[id] || id), 'Total ruta']
  const body = sortedRutasColumns.map((ruta) => {
    const totalRuta = BUCKET_ORDER_PDF.reduce(
      (acc, bucketId) => acc + (resumenMatrix[resumenIdx[bucketId]]?.byRuta?.[ruta]?.saldo || 0),
      0,
    )
    return [
      ruta,
      ...BUCKET_ORDER_PDF.map((bucketId) => {
        const cell = resumenMatrix[resumenIdx[bucketId]]?.byRuta?.[ruta]
        return cell?.notas > 0 ? money(cell.saldo) : '—'
      }),
      money(totalRuta),
    ]
  })

  const foot = sortedRutasColumns.length
    ? [
        {
          content: 'Suma total',
          styles: { fontStyle: 'bold', halign: 'left' },
        },
        ...BUCKET_ORDER_PDF.map((bucketId) => ({
          content: money(resumenMatrix[resumenIdx[bucketId]]?.totalSaldo || 0),
          styles: { fontStyle: 'bold', halign: 'right' },
        })),
        {
          content: money(granTotalSaldo),
          styles: { fontStyle: 'bold', halign: 'right', textColor: [47, 125, 50] },
        },
      ]
    : null

  const columnStyles = {}
  for (let i = 1; i < head.length; i += 1) columnStyles[i] = { halign: 'right', fontSize: 6 }
  columnStyles[0] = { fontSize: 7 }

  autoTable(doc, {
    ...tableTheme(),
    startY: y,
    head: [head],
    body: body.length ? body : [['Sin datos']],
    foot: foot ? [foot] : undefined,
    showFoot: foot ? 'lastPage' : undefined,
    footStyles: {
      fillColor: [248, 249, 250],
      textColor: [33, 37, 41],
      fontStyle: 'bold',
      fontSize: 6.5,
      lineWidth: 0.1,
      lineColor: [222, 226, 230],
    },
    columnStyles,
  })
}

function orientationFor(meta) {
  if (meta.pestanaPrincipal === 'tablas' && meta.subVista === 'resumen') return 'landscape'
  if (meta.pestanaPrincipal === 'panel_general') return 'landscape'
  if (meta.pestanaPrincipal === 'atraso_estructural') return 'landscape'
  return 'portrait'
}

function addPageNumbers(doc) {
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(
      `Página ${i} de ${total}`,
      doc.internal.pageSize.getWidth() - 12,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'right' },
    )
  }
  doc.setTextColor(33, 37, 41)
}

/**
 * Genera y descarga un PDF de la vista activa del reporte de cartera.
 * @param {{ payload: object, meta: object }} args
 */
export function exportarReportePdf({ payload, meta }) {
  if (!payload) throw new Error('No hay datos del reporte para exportar')

  const orientation = orientationFor(meta)
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  let y = writeHeader(doc, meta)

  switch (meta.pestanaPrincipal) {
    case 'indicadores':
      exportIndicadores(doc, payload, y)
      break
    case 'atraso_estructural':
      exportAtrasoEstructural(doc, payload, y)
      break
    case 'panel_general':
      exportDetalle(doc, payload, y)
      break
    case 'tablas':
      if (meta.subVista === 'pivot') exportPorAntiguedad(doc, payload, y)
      else if (meta.subVista === 'resumen') exportResumen(doc, payload, y, meta)
      else exportPorRuta(doc, payload, y)
      break
    default:
      exportIndicadores(doc, payload, y)
  }

  addPageNumbers(doc)

  const vistaSlug =
    meta.pestanaPrincipal === 'tablas'
      ? `panel_${meta.subVista || 'rutas'}`
      : meta.pestanaPrincipal || 'reporte'
  const fecha = new Date().toISOString().slice(0, 10)
  const filename = `reporte_cartera_${slugify(meta.empresaActiva)}_${slugify(vistaSlug)}_${fecha}.pdf`
  doc.save(filename)
  return filename
}
