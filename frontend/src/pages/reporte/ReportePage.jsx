import { fetchCarteraReporte } from '../../services/reportesApi.js'
import { estadoBadgeClass } from '../../utils/estadoBadge.js'
import { ROUTES } from '../../constants/routes.js'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useListFiltersStore } from '../../stores/listFiltersStore.js'

const REPORTES_STORAGE_KEY = 'reporte_cartera_filtros_v1'

function useDebounced(value, ms) {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return d
}

const DIAS_BUCKETS = [
  { id: 'all', label: 'Todos' },
  { id: 'r1', label: '0–30 d' },
  { id: 'r2', label: '31–45 d' },
  { id: 'r2b', label: '46–60 d' },
  { id: 'r3', label: '61–90 d' },
  { id: 'r4', label: '91–180 d' },
  { id: 'r5', label: '181–365 d' },
  { id: 'r6', label: '>365 d' },
]

const SORT_OPTIONS = [
  { value: 'saldo_desc', label: 'Saldo (mayor → menor)' },
  { value: 'saldo_asc', label: 'Saldo (menor → mayor)' },
  { value: 'dias_desc', label: 'Antigüedad (mayor)' },
  { value: 'dias_asc', label: 'Antigüedad (menor)' },
  { value: 'fecha_desc', label: 'Fecha (reciente)' },
  { value: 'fecha_asc', label: 'Fecha (antigua)' },
  { value: 'cliente_asc', label: 'Cliente (A–Z)' },
  { value: 'folio_asc', label: 'Folio (A–Z)' },
]

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

const TAB_INDICADORES = 'indicadores'
const TAB_PANEL_GENERAL = 'panel_general'
const TAB_TABLAS = 'tablas'

function loadStoredReportFilters() {
  try {
    const raw = localStorage.getItem(REPORTES_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
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

function fmtDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
}

function ReporteDetalleCardMovil({ row }) {
  return (
    <div className="card border shadow-sm">
      <div className="card-body py-3">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <div className="min-w-0">
            <div className="fw-semibold text-truncate">{row.serie_folio || '—'}</div>
            <div className="small text-body-secondary">ID {row.id}</div>
          </div>
          <Link
            className="btn btn-sm btn-outline-primary flex-shrink-0"
            to={ROUTES.detalleNota(String(row.id))}
          >
            Ver nota
          </Link>
        </div>
        <dl className="row small mb-0 gx-2">
          <dt className="col-5 text-body-secondary">Cliente</dt>
          <dd className="col-7 mb-1 text-break">{row.cliente || '—'}</dd>
          <dt className="col-5 text-body-secondary">Ruta</dt>
          <dd className="col-7 mb-1">{row.ruta_codigo || '—'}</dd>
          <dt className="col-5 text-body-secondary">Vendedor</dt>
          <dd className="col-7 mb-1">{row.usuario_vendedor_pv || row.vendedor_username || '—'}</dd>
          <dt className="col-5 text-body-secondary">Días</dt>
          <dd className="col-7 mb-1 text-end">{row.dias ?? '—'}</dd>
          <dt className="col-5 text-body-secondary">Monto</dt>
          <dd className="col-7 mb-1 text-end">{money(row.monto)}</dd>
          <dt className="col-5 text-body-secondary">Abono</dt>
          <dd className="col-7 mb-1 text-end">{money(row.abono)}</dd>
          <dt className="col-5 text-body-secondary">Saldo</dt>
          <dd className="col-7 mb-1 text-end fw-medium">{money(row.saldo)}</dd>
          <dt className="col-5 text-body-secondary">Estado</dt>
          <dd className="col-7 mb-1">
            <span className={`badge ${estadoBadgeClass(row.estado)}`}>{row.estado || '—'}</span>
          </dd>
          <dt className="col-5 text-body-secondary">Fecha nota</dt>
          <dd className="col-7 mb-0">{fmtDate(row.fecha_nota)}</dd>
        </dl>
      </div>
    </div>
  )
}

function ReporteAntiguedadFilaCardMovil({ r, labels }) {
  return (
    <div className="card border shadow-sm">
      <div className="card-body py-2">
        <div className="fw-medium">{labels[r.bucket_id] || r.bucket_id}</div>
        <div className="d-flex justify-content-between small mt-2">
          <span className="text-body-secondary">Notas</span>
          <span>{r.notas?.toLocaleString?.('es-MX') ?? r.notas}</span>
        </div>
        <div className="d-flex justify-content-between small">
          <span className="text-body-secondary">Saldo</span>
          <span className="fw-medium">{money(r.saldo_total)}</span>
        </div>
      </div>
    </div>
  )
}

function ReporteRutaIndicadorCardMovil({ r }) {
  return (
    <div className="card border shadow-sm">
      <div className="card-body py-2">
        <div className="fw-medium mb-2">{r.ruta_codigo}</div>
        <div className="d-flex justify-content-between small">
          <span className="text-body-secondary">Notas</span>
          <span>{r.notas?.toLocaleString?.('es-MX') ?? r.notas}</span>
        </div>
        <div className="d-flex justify-content-between small">
          <span className="text-body-secondary">Saldo</span>
          <span className="fw-medium">{money(r.saldo_total)}</span>
        </div>
      </div>
    </div>
  )
}

function ReporteRutaTablasCardMovil({ r }) {
  return (
    <div className="card border shadow-sm">
      <div className="card-body py-2">
        <div className="fw-medium mb-2">{r.ruta_codigo}</div>
        <dl className="row small mb-0 gx-2">
          <dt className="col-6 text-body-secondary">Notas</dt>
          <dd className="col-6 text-end mb-1">{r.notas?.toLocaleString?.('es-MX') ?? r.notas}</dd>
          <dt className="col-6 text-body-secondary">Saldo</dt>
          <dd className="col-6 text-end mb-1 fw-medium">{money(r.saldo_total)}</dd>
          <dt className="col-6 text-body-secondary">Monto</dt>
          <dd className="col-6 text-end mb-1">{money(r.monto_total)}</dd>
          <dt className="col-6 text-body-secondary">Abonos</dt>
          <dd className="col-6 text-end mb-0">{money(r.abono_total)}</dd>
        </dl>
      </div>
    </div>
  )
}

function ReporteResumenRutaCardMovil({ ruta, bucketOrder, resumenMatrix, resumenIdx, labels }) {
  const totalRuta = bucketOrder.reduce(
    (acc, bucketId) => acc + (resumenMatrix[resumenIdx[bucketId]]?.byRuta?.[ruta]?.saldo || 0),
    0,
  )
  return (
    <div className="card border shadow-sm">
      <div className="card-body py-3">
        <div className="fw-semibold mb-2">{ruta}</div>
        {bucketOrder.map((bucketId) => {
          const saldo = resumenMatrix[resumenIdx[bucketId]]?.byRuta?.[ruta]?.saldo || 0
          const notas = resumenMatrix[resumenIdx[bucketId]]?.byRuta?.[ruta]?.notas || 0
          if (notas <= 0) return null
          return (
            <div
              key={bucketId}
              className={`d-flex justify-content-between small mb-1 gap-2${notas > 0 ? ' cursor-pointer' : ''}`}
              onClick={() => notas > 0 && handleClickResumen(ruta, bucketId)}
            >
              <span className="text-body-secondary text-break">{labels[bucketId] || bucketId}</span>
              <span className="text-nowrap">{money(saldo)}</span>
            </div>
          )
        })}
        <div className="d-flex justify-content-between border-top pt-2 mt-2 small fw-semibold">
          <span>Total ruta</span>
          <span>{money(totalRuta)}</span>
        </div>
      </div>
    </div>
  )
}

export default function ReportePage() {
  const storedFilters = loadStoredReportFilters()
  const [empresaActiva, setEmpresaActiva] = useState(
    storedFilters?.empresaActiva === 'RODRIGO' ? 'RODRIGO' : 'DISTRIBUIDORA',
  )
  const [estado, setEstado] = useState(storedFilters?.estado || 'PENDIENTE')
  const [diasBucket, setDiasBucket] = useState(storedFilters?.diasBucket || 'all')
  const [q, setQ] = useState(storedFilters?.q || '')
  const qDebounced = useDebounced(q.trim(), 450)
  const [fechaDesde, setFechaDesde] = useState(storedFilters?.fechaDesde || '')
  const [fechaHasta, setFechaHasta] = useState(storedFilters?.fechaHasta || '')
  const [rutasStr, setRutasStr] = useState(storedFilters?.rutasStr || '')
  const rutasDebounced = useDebounced(rutasStr.replace(/\s+/g, ''), 450)
  const [sort, setSort] = useState(storedFilters?.sort || 'saldo_desc')
  const [pestanaPrincipal, setPestanaPrincipal] = useState(
    [TAB_INDICADORES, TAB_PANEL_GENERAL, TAB_TABLAS].includes(storedFilters?.pestanaPrincipal)
      ? storedFilters.pestanaPrincipal
      : TAB_PANEL_GENERAL,
  )
  const [debugMode, setDebugMode] = useState(Boolean(storedFilters?.debugMode))
  const [subVista, setSubVista] = useState(storedFilters?.subVista || 'tabla')
  const [resumenSortKey, setResumenSortKey] = useState(storedFilters?.resumenSortKey || 'total')
  const [resumenSortDir, setResumenSortDir] = useState(storedFilters?.resumenSortDir || 'desc')
  const navigate = useNavigate()
  const setSeguimientoFilters = useListFiltersStore((s) => s.setSeguimientoFilters)

  const BUCKET_TO_R = {
    d0_30: 'r1',
    d31_45: 'r2',
    d46_60: 'r2b',
    d61_90: 'r3',
    d91_180: 'r4',
    d181_365: 'r5',
    d366_plus: 'r6',
  }

  function handleClickResumen(ruta, bucketId, ignoreRuta = false) {
    const rId = BUCKET_TO_R[bucketId] || ''
    const routeCode = ignoreRuta ? '' : ruta === '(sin ruta)' ? '' : ruta
    
    setSeguimientoFilters({
      empresaActiva,
      ruta: routeCode,
      dias_bucket: rId,
      estado: estado === 'TODOS' ? '' : estado,
    })
    navigate(ROUTES.seguimiento, { state: { fromReport: true } })
  }

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState(null)

  const load = useCallback(
    async (overrides = {}) => {
      const qUse = overrides.q !== undefined ? overrides.q : qDebounced
      const rutasUse =
        overrides.rutas !== undefined ? overrides.rutas : rutasDebounced.replace(/\s+/g, '')
      setLoading(true)
      setError('')
      try {
        const data = await fetchCarteraReporte({
          empresa: empresaActiva,
          estado,
          dias_bucket: diasBucket,
          q: qUse,
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta,
          rutas: rutasUse,
          sort,
          ...(debugMode ? { debug: '1' } : {}),
        })
        setPayload(data)
      } catch (e) {
        setPayload(null)
        setError(e?.message || 'No se pudo cargar el reporte')
      } finally {
        setLoading(false)
      }
    },
    [
      empresaActiva,
      estado,
      diasBucket,
      qDebounced,
      fechaDesde,
      fechaHasta,
      rutasDebounced,
      sort,
      debugMode,
    ],
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!debugMode || loading) return
    if (payload?.debug) {
      console.info('[reporte:debug-ui] debug recibido', payload.debug)
    } else {
      console.warn(
        '[reporte:debug-ui] debug activado pero el backend no devolvio payload.debug. Reinicia API y verifica /api/reportes/cartera?debug=1',
      )
    }
  }, [debugMode, loading, payload])

  useEffect(() => {
    try {
      localStorage.setItem(
        REPORTES_STORAGE_KEY,
        JSON.stringify({
          empresaActiva,
          estado,
          diasBucket,
          q,
          fechaDesde,
          fechaHasta,
          rutasStr,
          sort,
          pestanaPrincipal,
          debugMode,
          subVista,
          resumenSortKey,
          resumenSortDir,
        }),
      )
    } catch {
      // ignore localStorage write errors
    }
  }, [
    empresaActiva,
    estado,
    diasBucket,
    q,
    fechaDesde,
    fechaHasta,
    rutasStr,
    sort,
    pestanaPrincipal,
    debugMode,
    subVista,
    resumenSortKey,
    resumenSortDir,
  ])

  const kpis = payload?.kpis
  const items = payload?.items ?? []
  const porRuta = payload?.porRuta ?? []
  const porAntiguedad = payload?.porAntiguedad ?? []
  const resumenPivot = payload?.resumenPivot ?? []
  const bucketOrder = [
    'negativo',
    'd0_30',
    'd31_45',
    'd46_60',
    'd61_90',
    'd91_180',
    'd181_365',
    'd366_plus',
  ]
  const rutasColumns = [...new Set(resumenPivot.map((x) => x.ruta_codigo || '(sin ruta)'))].sort((a, b) =>
    String(a).localeCompare(String(b)),
  )
  const resumenMatrix = bucketOrder.map((bucketId) => {
    const row = { bucketId, totalSaldo: 0, totalNotas: 0, byRuta: {} }
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
    resumenMatrix[idx].totalNotas += Number.isFinite(notas) ? notas : 0
  }
  const totalByRuta = Object.fromEntries(rutasColumns.map((ruta) => [ruta, 0]))
  let granTotalSaldo = 0
  for (const row of resumenMatrix) {
    granTotalSaldo += row.totalSaldo
    for (const ruta of rutasColumns) {
      totalByRuta[ruta] += row.byRuta[ruta].saldo
    }
  }
  const sortedRutasColumns = [...rutasColumns].sort((a, b) => {
    const aVal =
      resumenSortKey === 'total'
        ? totalByRuta[a] || 0
        : resumenMatrix[resumenIdx[resumenSortKey]]?.byRuta?.[a]?.saldo || 0
    const bVal =
      resumenSortKey === 'total'
        ? totalByRuta[b] || 0
        : resumenMatrix[resumenIdx[resumenSortKey]]?.byRuta?.[b]?.saldo || 0
    if (aVal === bVal) return String(a).localeCompare(String(b))
    return resumenSortDir === 'asc' ? aVal - bVal : bVal - aVal
  })

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-2">Reporte — Cartera</h1>
      <p className="text-body-secondary small mb-3">
        KPIs y detalle desde la base (notas pendientes por defecto). Mismos filtros para totales, resúmenes y
        tabla. La tabla muestra hasta {payload?.maxRows ?? 5000} filas si el resultado es mayor.
      </p>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${empresaActiva === 'DISTRIBUIDORA' ? ' active' : ''}`}
            onClick={() => setEmpresaActiva('DISTRIBUIDORA')}
          >
            Distribuidora
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${empresaActiva === 'RODRIGO' ? ' active' : ''}`}
            onClick={() => setEmpresaActiva('RODRIGO')}
          >
            Rodrigo
          </button>
        </li>
      </ul>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      {payload?.truncated ? (
        <div className="alert alert-warning py-2" role="status">
          Hay más de {payload.maxRows} notas que cumplen el filtro; la tabla muestra las primeras{' '}
          {payload.maxRows} según el orden elegido. Los KPIs y los resúmenes por ruta/antigüedad sí reflejan
          el total filtrado ({payload.total?.toLocaleString?.('es-MX') ?? payload.total}).
        </div>
      ) : null}

      <ul className="nav nav-pills mb-3 gap-1">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${pestanaPrincipal === TAB_PANEL_GENERAL ? ' active' : ''}`}
            onClick={() => setPestanaPrincipal(TAB_PANEL_GENERAL)}
          >
            Detalle
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${pestanaPrincipal === TAB_INDICADORES ? ' active' : ''}`}
            onClick={() => setPestanaPrincipal(TAB_INDICADORES)}
          >
            Indicadores
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${pestanaPrincipal === TAB_TABLAS ? ' active' : ''}`}
            onClick={() => setPestanaPrincipal(TAB_TABLAS)}
          >
            Panel general
          </button>
        </li>
      </ul>

      {pestanaPrincipal === TAB_INDICADORES ? (
        <div className="row g-2 mb-3">
        <div className="col-6 col-md-4 col-lg-2">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">Registros</div>
              <div className="fs-5 fw-semibold">{loading ? '…' : (kpis?.registros ?? 0).toLocaleString('es-MX')}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">Saldo total</div>
              <div className="fs-6 fw-semibold text-primary">{loading ? '…' : money(kpis?.saldo_total)}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">Monto / Abonos</div>
              <div className="small">
                {loading ? '…' : `${money(kpis?.monto_total)} / ${money(kpis?.abonos_total)}`}
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">Días promedio</div>
              <div className="fs-5 fw-semibold">
                {loading ? '…' : Number(kpis?.dias_promedio ?? 0).toFixed(1)}
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">&gt;365 días</div>
              <div className="fs-5 fw-semibold text-danger">
                {loading ? '…' : (kpis?.vencidos_365 ?? 0).toLocaleString('es-MX')}
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">Rutas (con código)</div>
              <div className="fs-5 fw-semibold">{loading ? '…' : (kpis?.rutas_activas ?? 0)}</div>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {/* Filtros */}
      <div className="card mb-3">
        <div className="card-body">
          <div className="form-check form-switch mb-3">
            <input
              id="reportes-debug"
              className="form-check-input"
              type="checkbox"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
            />
            <label className="form-check-label small" htmlFor="reportes-debug">
              Modo debug (muestra criterio y muestra de clasificación)
            </label>
          </div>
          <div className="mb-2 small text-body-secondary">Antigüedad (días desde fecha de nota)</div>
          <div className="d-flex flex-wrap gap-1 mb-3">
            {DIAS_BUCKETS.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`btn btn-sm ${diasBucket === b.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setDiasBucket(b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>

          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4 col-lg-3">
              <label className="form-label mb-1">Buscar</label>
              <input
                type="search"
                className="form-control"
                placeholder="Cliente, folio, ruta, vendedor…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') load({ q: q.trim(), rutas: rutasStr.replace(/\s+/g, '') })
                }}
              />
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label mb-1">Estado</label>
              <select className="form-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="TODOS">Todos</option>
                <option value="RESUELTA">RESUELTA</option>
                <option value="CANCELADA">CANCELADA</option>
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label mb-1">Desde</label>
              <input
                type="date"
                className="form-control"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label mb-1">Hasta</label>
              <input
                type="date"
                className="form-control"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>
            <div className="col-12 col-md-8 col-lg-3">
              <label className="form-label mb-1">Rutas (códigos, separados por coma)</label>
              <input
                type="text"
                className="form-control"
                placeholder="DR201, DR202"
                value={rutasStr}
                onChange={(e) => setRutasStr(e.target.value)}
              />
            </div>
            <div className="col-12 col-md-4 col-lg-2">
              <label className="form-label mb-1">Orden (tabla)</label>
              <select className="form-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-auto d-flex gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading}
                onClick={() => load({ q: q.trim(), rutas: rutasStr.replace(/\s+/g, '') })}
              >
                {loading ? 'Cargando…' : 'Actualizar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {pestanaPrincipal === TAB_INDICADORES ? (
        <div className="row g-3 mb-3">
          <div className="col-12 col-xl-6">
            <div className="card h-100">
              <div className="card-header">Antiguedad de cartera</div>
              <div className="card-body p-0">
                <div className="d-none d-md-block table-responsive">
                  <table className="table table-sm table-bordered mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Tramo</th>
                        <th className="text-end">Notas</th>
                        <th className="text-end">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={3} className="text-center py-4">
                            Cargando…
                          </td>
                        </tr>
                      ) : porAntiguedad.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-4 text-body-secondary">
                            Sin datos.
                          </td>
                        </tr>
                      ) : (
                        porAntiguedad.map((r) => (
                          <tr key={r.bucket_id}>
                            <td>{BUCKET_LABELS[r.bucket_id] || r.bucket_id}</td>
                            <td className="text-end">{r.notas?.toLocaleString?.('es-MX') ?? r.notas}</td>
                            <td className="text-end fw-medium">{money(r.saldo_total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="d-md-none p-2 p-sm-3">
                  {loading ? (
                    <p className="text-center text-body-secondary py-4 mb-0">Cargando…</p>
                  ) : porAntiguedad.length === 0 ? (
                    <p className="text-center text-body-secondary py-4 mb-0">Sin datos.</p>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {porAntiguedad.map((r) => (
                        <ReporteAntiguedadFilaCardMovil key={r.bucket_id} r={r} labels={BUCKET_LABELS} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-xl-6">
            <div className="card h-100">
              <div className="card-header">Top rutas por saldo pendiente</div>
              <div className="card-body p-0">
                <div className="d-none d-md-block table-responsive">
                  <table className="table table-sm table-striped mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Ruta</th>
                        <th className="text-end">Notas</th>
                        <th className="text-end">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={3} className="text-center py-4">
                            Cargando…
                          </td>
                        </tr>
                      ) : porRuta.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-4 text-body-secondary">
                            Sin datos.
                          </td>
                        </tr>
                      ) : (
                        porRuta.slice(0, 15).map((r) => (
                          <tr key={r.ruta_codigo}>
                            <td>{r.ruta_codigo}</td>
                            <td className="text-end">{r.notas?.toLocaleString?.('es-MX') ?? r.notas}</td>
                            <td className="text-end fw-medium">{money(r.saldo_total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="d-md-none p-2 p-sm-3">
                  {loading ? (
                    <p className="text-center text-body-secondary py-4 mb-0">Cargando…</p>
                  ) : porRuta.length === 0 ? (
                    <p className="text-center text-body-secondary py-4 mb-0">Sin datos.</p>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {porRuta.slice(0, 15).map((r) => (
                        <ReporteRutaIndicadorCardMovil key={r.ruta_codigo} r={r} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {debugMode ? (
        <div className="card mb-3 border-warning-subtle">
          <div className="card-header bg-warning-subtle">Debug clasificación</div>
          <div className="card-body">
            {payload?.debug ? (
              <>
                <div className="small mb-2">
                  <strong>Criterio días:</strong> {payload.debug?.criterio?.dias || '—'}
                </div>
                <div className="small mb-2">
                  <strong>Muestra:</strong> {payload.debug?.sample_size ?? 0} filas
                </div>
                <pre className="small bg-light border rounded p-2 mb-0" style={{ maxHeight: '220px', overflow: 'auto' }}>
{JSON.stringify(payload.debug?.sample_by_bucket || {}, null, 2)}
                </pre>
              </>
            ) : (
              <div className="small text-danger">
                Debug está activado, pero esta respuesta no trae `payload.debug`. Probablemente el backend no
                se reinició con los últimos cambios.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {pestanaPrincipal === TAB_PANEL_GENERAL ? (
        <>
        <div className="card">
          <div className="card-body p-0">
            <div className="d-none d-md-block table-responsive" style={{ maxHeight: '70vh' }}>
              <table className="table table-sm table-hover align-middle mb-0">
                <thead className="table-light sticky-top">
                  <tr>
                    <th>Folio</th>
                    <th>Cliente</th>
                    <th>Ruta</th>
                    <th>Vendedor</th>
                    <th className="text-end">Días</th>
                    <th className="text-end">Monto</th>
                    <th className="text-end">Abono</th>
                    <th className="text-end">Saldo</th>
                    <th>Estado</th>
                    <th>Fechas</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="text-center py-4 text-body-secondary">
                        Cargando…
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-4 text-body-secondary">
                        Sin registros con los filtros actuales.
                      </td>
                    </tr>
                  ) : (
                    items.map((row) => (
                      <tr key={row.id}>
                        <td className="text-nowrap small">{row.serie_folio}</td>
                        <td className="small">{row.cliente}</td>
                        <td className="small text-nowrap">{row.ruta_codigo || '—'}</td>
                        <td className="small">
                          {row.usuario_vendedor_pv || row.vendedor_username || '—'}
                        </td>
                        <td className="text-end small">{row.dias}</td>
                        <td className="text-end small">{money(row.monto)}</td>
                        <td className="text-end small">{money(row.abono)}</td>
                        <td className="text-end small fw-medium">{money(row.saldo)}</td>
                        <td>
                          <span className={`badge ${estadoBadgeClass(row.estado)}`}>{row.estado}</span>
                        </td>
                        <td className="small text-nowrap">
                          {fmtDate(row.fecha_nota)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="d-md-none p-2 p-sm-3" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {loading ? (
                <p className="text-center text-body-secondary py-4 mb-0">Cargando…</p>
              ) : items.length === 0 ? (
                <p className="text-center text-body-secondary py-4 mb-0">
                  Sin registros con los filtros actuales.
                </p>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {items.map((row) => (
                    <ReporteDetalleCardMovil key={row.id} row={row} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        </>
      ) : null}

      {pestanaPrincipal === TAB_TABLAS ? (
        <>
      {/* Sub-vistas */}
      <ul className="nav nav-pills mb-2 gap-1">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${subVista === 'rutas' ? ' active' : ''}`}
            onClick={() => setSubVista('rutas')}
          >
            Por ruta
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${subVista === 'pivot' ? ' active' : ''}`}
            onClick={() => setSubVista('pivot')}
          >
            Por antigüedad
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${subVista === 'resumen' ? ' active' : ''}`}
            onClick={() => setSubVista('resumen')}
          >
            Resumen
          </button>
        </li>
      </ul>

      {subVista === 'rutas' ? (
        <div className="card">
          <div className="card-body p-0">
            <div className="d-none d-md-block table-responsive">
              <table className="table table-sm table-striped mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Ruta</th>
                    <th className="text-end">Notas</th>
                    <th className="text-end">Saldo</th>
                    <th className="text-end">Monto</th>
                    <th className="text-end">Abonos</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4">
                        Cargando…
                      </td>
                    </tr>
                  ) : porRuta.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-body-secondary">
                        Sin datos.
                      </td>
                    </tr>
                  ) : (
                    porRuta.map((r) => (
                      <tr
                        key={r.ruta_codigo}
                        className="cursor-pointer"
                        onClick={() => handleClickResumen(r.ruta_codigo, 'all')}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="text-decoration-underline">{r.ruta_codigo}</td>
                        <td className="text-end">{r.notas?.toLocaleString?.('es-MX') ?? r.notas}</td>
                        <td className="text-end fw-medium">{money(r.saldo_total)}</td>
                        <td className="text-end">{money(r.monto_total)}</td>
                        <td className="text-end">{money(r.abono_total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="d-md-none p-2 p-sm-3">
              {loading ? (
                <p className="text-center text-body-secondary py-4 mb-0">Cargando…</p>
              ) : porRuta.length === 0 ? (
                <p className="text-center text-body-secondary py-4 mb-0">Sin datos.</p>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {porRuta.map((r) => (
                    <ReporteRutaTablasCardMovil key={r.ruta_codigo} r={r} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {subVista === 'pivot' ? (
        <div className="card">
          <div className="card-body p-0">
            <div className="d-none d-md-block table-responsive">
              <table className="table table-sm table-bordered mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Tramo de antigüedad</th>
                    <th className="text-end">Notas</th>
                    <th className="text-end">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="text-center py-4">
                        Cargando…
                      </td>
                    </tr>
                  ) : porAntiguedad.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-4 text-body-secondary">
                        Sin datos.
                      </td>
                    </tr>
                  ) : (
                    porAntiguedad.map((r) => (
                      <tr
                        key={r.bucket_id}
                        className="cursor-pointer"
                        onClick={() => handleClickResumen('', r.bucket_id, true)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="text-decoration-underline">{BUCKET_LABELS[r.bucket_id] || r.bucket_id}</td>
                        <td className="text-end">{r.notas?.toLocaleString?.('es-MX') ?? r.notas}</td>
                        <td className="text-end fw-medium">{money(r.saldo_total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="d-md-none p-2 p-sm-3">
              {loading ? (
                <p className="text-center text-body-secondary py-4 mb-0">Cargando…</p>
              ) : porAntiguedad.length === 0 ? (
                <p className="text-center text-body-secondary py-4 mb-0">Sin datos.</p>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {porAntiguedad.map((r) => (
                    <ReporteAntiguedadFilaCardMovil key={r.bucket_id} r={r} labels={BUCKET_LABELS} />
                  ))}
                </div>
              )}
            </div>
            <p className="small text-body-secondary mb-0 px-3 py-2">
              Distribución según los mismos filtros activos (incluido el chip de antigüedad si aplica).
            </p>
          </div>
        </div>
      ) : null}
      {subVista === 'resumen' ? (
        <div className="card">
          <div className="card-header d-flex flex-wrap gap-2 align-items-end">
            <div>
              <label className="form-label form-label-sm mb-1">Ordenar saldo por</label>
              <select
                className="form-select form-select-sm"
                value={resumenSortKey}
                onChange={(e) => setResumenSortKey(e.target.value)}
              >
                <option value="total">Total ruta</option>
                {bucketOrder.map((bucketId) => (
                  <option key={bucketId} value={bucketId}>
                    {BUCKET_LABELS[bucketId] || bucketId}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label form-label-sm mb-1">Dirección</label>
              <select
                className="form-select form-select-sm"
                value={resumenSortDir}
                onChange={(e) => setResumenSortDir(e.target.value)}
              >
                <option value="desc">Mayor a menor</option>
                <option value="asc">Menor a mayor</option>
              </select>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="d-none d-md-block table-responsive">
              <table className="table table-sm table-bordered mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="text-nowrap">Ruta</th>
                    {bucketOrder.map((bucketId) => (
                      <th key={bucketId} className="text-end text-nowrap">
                        {BUCKET_LABELS[bucketId] || bucketId}
                      </th>
                    ))}
                    <th className="text-end text-nowrap">Total ruta</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={2 + bucketOrder.length} className="text-center py-4">
                        Cargando…
                      </td>
                    </tr>
                  ) : resumenMatrix.length === 0 ? (
                    <tr>
                      <td colSpan={2 + bucketOrder.length} className="text-center py-4 text-body-secondary">
                        Sin datos.
                      </td>
                    </tr>
                  ) : (
                    sortedRutasColumns.map((ruta) => {
                      const totalRuta = bucketOrder.reduce(
                        (acc, bucketId) => acc + (resumenMatrix[resumenIdx[bucketId]]?.byRuta?.[ruta]?.saldo || 0),
                        0,
                      )
                      return (
                        <tr key={ruta}>
                          <td
                            className="text-nowrap cursor-pointer text-decoration-underline"
                            onClick={() => handleClickResumen(ruta, 'all')}
                            style={{ cursor: 'pointer' }}
                          >
                            {ruta}
                          </td>
                          {bucketOrder.map((bucketId) => {
                            const saldo = resumenMatrix[resumenIdx[bucketId]]?.byRuta?.[ruta]?.saldo || 0
                            const notas = resumenMatrix[resumenIdx[bucketId]]?.byRuta?.[ruta]?.notas || 0
                            return (
                              <td
                                key={`${ruta}-${bucketId}`}
                                className={`text-end${notas > 0 ? ' cursor-pointer text-decoration-underline' : ''}`}
                                onClick={() => notas > 0 && handleClickResumen(ruta, bucketId)}
                                style={{ cursor: notas > 0 ? 'pointer' : 'default' }}
                              >
                                {notas > 0 ? money(saldo) : '—'}
                              </td>
                            )
                          })}
                          <td
                            className={`text-end fw-medium${totalRuta > 0 ? ' cursor-pointer text-decoration-underline' : ''}`}
                            onClick={() => totalRuta > 0 && handleClickResumen(ruta, 'all')}
                            style={{ cursor: totalRuta > 0 ? 'pointer' : 'default' }}
                          >
                            {money(totalRuta)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                  {!loading && resumenMatrix.length > 0 ? (
                    <tr className="table-light">
                      <td className="text-nowrap fw-semibold">Suma total</td>
                      {bucketOrder.map((bucketId) => (
                        <td
                          key={`total-${bucketId}`}
                          className={`text-end fw-semibold${resumenMatrix[resumenIdx[bucketId]]?.totalSaldo > 0 ? ' cursor-pointer text-decoration-underline' : ''}`}
                          onClick={() =>
                            resumenMatrix[resumenIdx[bucketId]]?.totalSaldo > 0 &&
                            handleClickResumen('(sin ruta)', bucketId, true)
                          }
                          style={{
                            cursor:
                              resumenMatrix[resumenIdx[bucketId]]?.totalSaldo > 0
                                ? 'pointer'
                                : 'default',
                          }}
                        >
                          {money(resumenMatrix[resumenIdx[bucketId]]?.totalSaldo || 0)}
                        </td>
                      ))}
                      <td
                        className={`text-end fw-semibold${granTotalSaldo > 0 ? ' cursor-pointer text-decoration-underline' : ''}`}
                        onClick={() => granTotalSaldo > 0 && handleClickResumen('', 'all', true)}
                        style={{ cursor: granTotalSaldo > 0 ? 'pointer' : 'default' }}
                      >
                        {money(granTotalSaldo)}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="d-md-none p-2 p-sm-3">
              {loading ? (
                <p className="text-center text-body-secondary py-4 mb-0">Cargando…</p>
              ) : resumenMatrix.length === 0 ? (
                <p className="text-center text-body-secondary py-4 mb-0">Sin datos.</p>
              ) : (
                <>
                  <div className="d-flex flex-column gap-2">
                    {sortedRutasColumns.map((ruta) => (
                      <ReporteResumenRutaCardMovil
                        key={ruta}
                        ruta={ruta}
                        bucketOrder={bucketOrder}
                        resumenMatrix={resumenMatrix}
                        resumenIdx={resumenIdx}
                        labels={BUCKET_LABELS}
                      />
                    ))}
                  </div>
                  <div className="card border shadow-sm mt-2 bg-light">
                    <div className="card-body py-3">
                      <div className="fw-semibold mb-2">Suma total (por tramo)</div>
                      {bucketOrder.map((bucketId) => (
                        <div key={bucketId} className="d-flex justify-content-between small mb-1 gap-2">
                          <span className="text-body-secondary text-break">
                            {BUCKET_LABELS[bucketId] || bucketId}
                          </span>
                          <span className="text-nowrap fw-medium">
                            {money(resumenMatrix[resumenIdx[bucketId]]?.totalSaldo || 0)}
                          </span>
                        </div>
                      ))}
                      <div className="d-flex justify-content-between border-top pt-2 mt-2 fw-semibold small">
                        <span>Total general</span>
                        <span>{money(granTotalSaldo)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <p className="small text-body-secondary mb-0 px-3 py-2">
              Matriz transpuesta: rutas en filas y rangos de tiempo en columnas, usando los filtros actuales.
            </p>
          </div>
        </div>
      ) : null}
        </>
      ) : null}
    </section>
  )
}
