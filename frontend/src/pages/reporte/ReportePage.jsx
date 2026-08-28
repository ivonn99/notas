import { fetchCarteraReporte } from '../../services/reportesApi.js'
import { exportarReportePdf } from '../../lib/exportarReportePdf.js'
import { estadoBadgeClass } from '../../utils/estadoBadge.js'
import { ROUTES } from '../../constants/routes.js'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { FaArrowRotateRight, FaFilePdf } from 'react-icons/fa6'
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

const TAB_INDICADORES = 'indicadores'
const TAB_ATRASO_ESTRUCTURAL = 'atraso_estructural'
const TAB_PANEL_GENERAL = 'panel_general'
const TAB_TABLAS = 'tablas'

const TABS_REPORTE = [TAB_INDICADORES, TAB_ATRASO_ESTRUCTURAL, TAB_PANEL_GENERAL, TAB_TABLAS]

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

function ReporteAtrasoEstructuralExplicacion({ umbralPct, diasCorte }) {
  return (
    <div className="card border mb-0">
      <div className="card-body py-3">
        <div className="fw-semibold mb-2 text-body">¿Qué mide el atraso estructural?</div>
        <p className="small mb-2 text-body">
          Compara la <strong>composición de la cartera pendiente</strong> (notas PENDIENTE con saldo) entre
          saldo reciente <strong>0–{diasCorte} días</strong> desde la fecha de nota y saldo antiguo{' '}
          <strong>&gt;{diasCorte} días</strong>. No mira una nota aislada: evalúa si, en conjunto, la deuda
          está más vencida que reciente.
        </p>
        <p className="small mb-2 text-body">
          Hay <strong>atraso estructural</strong> cuando el saldo &gt;{diasCorte} d supera al de 0–{diasCorte} d{' '}
          <em>o</em> cuando más del <strong>{umbralPct}%</strong> de la cartera cae en el tramo antiguo.
        </p>
        <div className="small border rounded bg-body-secondary bg-opacity-10 p-2 p-md-3 mb-2 text-body">
          <div className="fw-medium mb-2">Ejemplo (cliente con 3 notas pendientes)</div>
          <div className="table-responsive">
            <table className="table table-sm table-bordered mb-2 mb-md-2">
              <thead>
                <tr>
                  <th>Nota</th>
                  <th className="text-end">Días</th>
                  <th className="text-end">Saldo</th>
                  <th>Tramo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>NC-101</td>
                  <td className="text-end">12</td>
                  <td className="text-end">$3,000</td>
                  <td>0–{diasCorte} d</td>
                </tr>
                <tr>
                  <td>NC-088</td>
                  <td className="text-end">45</td>
                  <td className="text-end">$5,000</td>
                  <td>&gt;{diasCorte} d</td>
                </tr>
                <tr>
                  <td>NC-072</td>
                  <td className="text-end">95</td>
                  <td className="text-end">$2,000</td>
                  <td>&gt;{diasCorte} d</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="mb-2 ps-3">
            <li>
              Saldo 0–{diasCorte} d = <strong>$3,000</strong> · Saldo &gt;{diasCorte} d = <strong>$7,000</strong>{' '}
              · Total = <strong>$10,000</strong>
            </li>
            <li>
              % &gt;{diasCorte} d = 7,000 ÷ 10,000 = <strong>70%</strong>
            </li>
            <li>
              $7,000 &gt; $3,000 <em>y</em> 70% &gt; {umbralPct}% →{' '}
              <span className="badge text-bg-danger">Atraso estructural</span>
            </li>
          </ul>
          <div className="text-body-secondary">
            Por ruta se hace igual: se suman todas las notas pendientes de esa ruta y se aplica la misma regla.
          </div>
        </div>
        <p className="small mb-0 text-body-secondary">
          Es un indicador <strong>informativo</strong> para crédito y rutas: señala clientes o rutas donde, por
          composición, <strong>no deberían recibir más producto</strong> hasta equilibrar la cartera. La decisión
          final sigue siendo operativa.
        </p>
      </div>
    </div>
  )
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

function ReporteSituacionCardMovil({ r, labels, onClick }) {
  const clickable = Boolean(onClick)
  return (
    <div
      className={`card border shadow-sm${clickable ? ' cursor-pointer' : ''}`}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick()
            }
          : undefined
      }
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="card-body py-2">
        <div className="fw-medium mb-2">{labels[r.situacion_id] || r.situacion_id}</div>
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

function ReporteClienteCardMovil({ r, onClick }) {
  const clickable = Boolean(onClick)
  return (
    <div
      className={`card border shadow-sm${clickable ? ' cursor-pointer' : ''}`}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick()
            }
          : undefined
      }
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="card-body py-2">
        <div className="fw-medium mb-2 text-break">{r.cliente}</div>
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

function ReporteAtrasoEstructuralCardMovil({ r, onClick }) {
  return (
    <div
      className="card border border-danger-subtle shadow-sm cursor-pointer"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick?.()
      }}
      role="button"
      tabIndex={0}
    >
      <div className="card-body py-2">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <div className="fw-medium text-break">{r.cliente}</div>
          <span className="badge text-bg-danger flex-shrink-0">Atraso estructural</span>
        </div>
        <div className="d-flex justify-content-between small">
          <span className="text-body-secondary">Saldo 0–30 d</span>
          <span>{money(r.saldo_0_30)}</span>
        </div>
        <div className="d-flex justify-content-between small">
          <span className="text-body-secondary">Saldo &gt;30 d</span>
          <span className="fw-medium">{money(r.saldo_mas_30)}</span>
        </div>
        <div className="d-flex justify-content-between small">
          <span className="text-body-secondary">% &gt;30 d</span>
          <span className="fw-semibold text-danger">{pct(r.pct_mas_30)}</span>
        </div>
      </div>
    </div>
  )
}

function ReporteAtrasoRutaCardMovil({ r, onClick }) {
  return (
    <div
      className={`card border shadow-sm${onClick ? ' cursor-pointer' : ''}${r.atraso_estructural ? ' border-danger-subtle' : ''}`}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick()
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="card-body py-2">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <div className="fw-medium">{r.ruta_codigo}</div>
          {r.atraso_estructural ? (
            <span className="badge text-bg-danger flex-shrink-0">Atraso</span>
          ) : (
            <span className="badge text-bg-success flex-shrink-0">OK</span>
          )}
        </div>
        <div className="d-flex justify-content-between small">
          <span className="text-body-secondary">Saldo 0–30 d</span>
          <span>{money(r.saldo_0_30)}</span>
        </div>
        <div className="d-flex justify-content-between small">
          <span className="text-body-secondary">Saldo &gt;30 d</span>
          <span className="fw-medium">{money(r.saldo_mas_30)}</span>
        </div>
        <div className="d-flex justify-content-between small">
          <span className="text-body-secondary">% &gt;30 d</span>
          <span className={r.atraso_estructural ? 'fw-semibold text-danger' : ''}>{pct(r.pct_mas_30)}</span>
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

function ReporteResumenRutaCardMovil({ ruta, bucketOrder, resumenMatrix, resumenIdx, labels, onClickResumen }) {
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
              onClick={() => notas > 0 && onClickResumen?.(ruta, bucketId)}
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
    TABS_REPORTE.includes(storedFilters?.pestanaPrincipal)
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
      rutas: routeCode,
      dias_bucket: rId,
      estado: estado === 'TODOS' ? '' : estado,
      q: '',
      atencion: '',
    })
    navigate(ROUTES.seguimiento, { state: { fromReport: true } })
  }

  function handleClickSituacion(situacionId) {
    if (situacionId !== 'requiere_atencion') return
    setSeguimientoFilters({
      empresaActiva,
      rutas: rutasStr.replace(/\s+/g, ''),
      estado: estado === 'TODOS' ? '' : estado,
      q: '',
      atencion: 'si',
      dias_bucket: '',
    })
    navigate(ROUTES.seguimiento, { state: { fromReport: true } })
  }

  function handleClickClienteAtraso(cliente) {
    const nombre = String(cliente ?? '').trim()
    if (!nombre || nombre === '(sin cliente)') return
    setSeguimientoFilters({
      empresaActiva,
      rutas: rutasStr.replace(/\s+/g, ''),
      estado: 'PENDIENTE',
      q: nombre,
      atencion: '',
      dias_bucket: '',
    })
    navigate(ROUTES.seguimiento, { state: { fromReport: true } })
  }

  function handleClickRutaAtraso(rutaCodigo) {
    const codigo = String(rutaCodigo ?? '').trim()
    if (!codigo || codigo === '(sin ruta)') return
    setSeguimientoFilters({
      empresaActiva,
      rutas: codigo,
      estado: 'PENDIENTE',
      q: '',
      atencion: '',
      dias_bucket: '',
    })
    navigate(ROUTES.seguimiento, { state: { fromReport: true } })
  }

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState(null)
  const [exportingPdf, setExportingPdf] = useState(false)

  function handleExportPdf() {
    const puedeExportar =
      pestanaPrincipal === TAB_ATRASO_ESTRUCTURAL || pestanaPrincipal === TAB_TABLAS
    if (!payload || loading || exportingPdf || !puedeExportar) return
    setExportingPdf(true)
    setError('')
    try {
      exportarReportePdf({
        payload,
        meta: {
          empresaActiva,
          estado,
          diasBucket,
          fechaDesde,
          fechaHasta,
          rutas: rutasStr.replace(/\s+/g, ''),
          q: qDebounced,
          pestanaPrincipal,
          subVista,
          resumenSortKey,
          resumenSortDir,
        },
      })
    } catch (e) {
      setError(e?.message || 'No se pudo generar el PDF')
    } finally {
      setExportingPdf(false)
    }
  }

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
  const porCliente = payload?.porCliente ?? []
  const porSituacion = payload?.porSituacion ?? []
  const atrasoEstructural = payload?.atrasoEstructural
  const clientesAtrasoEstructural = (atrasoEstructural?.items ?? []).filter((r) => r.atraso_estructural)
  const atrasoPorRuta = atrasoEstructural?.porRuta ?? []
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
            className={`nav-link${pestanaPrincipal === TAB_ATRASO_ESTRUCTURAL ? ' active' : ''}`}
            onClick={() => setPestanaPrincipal(TAB_ATRASO_ESTRUCTURAL)}
          >
            Atraso estructural
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
        <>
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
        <div className="col-6 col-md-4 col-lg-2">
          <div className="card h-100 border-0 shadow-sm border-warning-subtle">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">Requieren atención</div>
              <div className="fs-5 fw-semibold text-warning-emphasis">
                {loading ? '…' : (kpis?.requiere_atencion ?? 0).toLocaleString('es-MX')}
              </div>
              <div className="small text-body-secondary">
                {loading ? '…' : pct(kpis?.requiere_atencion_pct)}
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">% recuperado</div>
              <div className="fs-5 fw-semibold text-success">
                {loading ? '…' : pct(kpis?.pct_recuperado)}
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">Saldo &gt;90 días</div>
              <div className="fs-6 fw-semibold text-danger">
                {loading ? '…' : money(kpis?.saldo_mas_90)}
              </div>
              <div className="small text-body-secondary">
                {loading ? '…' : `${(kpis?.notas_mas_90 ?? 0).toLocaleString('es-MX')} notas`}
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">Saldo &gt;180 días</div>
              <div className="fs-6 fw-semibold text-danger">
                {loading ? '…' : money(kpis?.saldo_mas_180)}
              </div>
              <div className="small text-body-secondary">
                {loading ? '…' : `${(kpis?.notas_mas_180 ?? 0).toLocaleString('es-MX')} notas`}
              </div>
            </div>
          </div>
        </div>
        </div>
        </>
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
                className="btn btn-primary d-inline-flex align-items-center justify-content-center gap-2"
                disabled={loading}
                onClick={() => load({ q: q.trim(), rutas: rutasStr.replace(/\s+/g, '') })}
              >
                <FaArrowRotateRight aria-hidden size={14} />
                {loading ? 'Cargando…' : 'Actualizar'}
              </button>
              {pestanaPrincipal === TAB_ATRASO_ESTRUCTURAL ||
              pestanaPrincipal === TAB_TABLAS ? (
                <button
                  type="button"
                  className="btn btn-primary d-inline-flex align-items-center justify-content-center gap-2"
                  disabled={loading || exportingPdf || !payload}
                  onClick={handleExportPdf}
                  title={
                    pestanaPrincipal === TAB_ATRASO_ESTRUCTURAL
                      ? 'Descarga un PDF de atraso estructural con los filtros actuales'
                      : 'Descarga un PDF del panel general (subvista activa) con los filtros actuales'
                  }
                >
                  <FaFilePdf aria-hidden size={14} />
                  {exportingPdf ? 'Generando PDF…' : 'Descargar PDF'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {pestanaPrincipal === TAB_INDICADORES ? (
        <>
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
        <div className="row g-3 mb-3">
          <div className="col-12 col-xl-6">
            <div className="card h-100">
              <div className="card-header">Por situación</div>
              <div className="card-body p-0">
                <div className="d-none d-md-block table-responsive">
                  <table className="table table-sm table-striped mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Situación</th>
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
                      ) : porSituacion.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-4 text-body-secondary">
                            Sin datos.
                          </td>
                        </tr>
                      ) : (
                        porSituacion.map((r) => (
                          <tr
                            key={r.situacion_id}
                            className={r.situacion_id === 'requiere_atencion' ? 'cursor-pointer' : undefined}
                            onClick={
                              r.situacion_id === 'requiere_atencion'
                                ? () => handleClickSituacion(r.situacion_id)
                                : undefined
                            }
                          >
                            <td>{SITUACION_LABELS[r.situacion_id] || r.situacion_id}</td>
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
                  ) : porSituacion.length === 0 ? (
                    <p className="text-center text-body-secondary py-4 mb-0">Sin datos.</p>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {porSituacion.map((r) => (
                        <ReporteSituacionCardMovil
                          key={r.situacion_id}
                          r={r}
                          labels={SITUACION_LABELS}
                          onClick={
                            r.situacion_id === 'requiere_atencion'
                              ? () => handleClickSituacion(r.situacion_id)
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-xl-6">
            <div className="card h-100">
              <div className="card-header">Top clientes por saldo</div>
              <div className="card-body p-0">
                <div className="d-none d-md-block table-responsive">
                  <table className="table table-sm table-striped mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Cliente</th>
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
                      ) : porCliente.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-4 text-body-secondary">
                            Sin datos.
                          </td>
                        </tr>
                      ) : (
                        porCliente.map((r) => (
                          <tr key={r.cliente}>
                            <td className="text-break">{r.cliente}</td>
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
                  ) : porCliente.length === 0 ? (
                    <p className="text-center text-body-secondary py-4 mb-0">Sin datos.</p>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {porCliente.map((r) => (
                        <ReporteClienteCardMovil key={r.cliente} r={r} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        </>
      ) : null}

      {pestanaPrincipal === TAB_ATRASO_ESTRUCTURAL ? (
        <>
          <div className="row g-2 mb-3">
            <div className="col-12">
              <ReporteAtrasoEstructuralExplicacion
                umbralPct={atrasoEstructural?.umbral_pct ?? 50}
                diasCorte={atrasoEstructural?.dias_corte ?? 30}
              />
            </div>
            <div className="col-6 col-md-3">
              <div className="card h-100 border-0 shadow-sm border-danger-subtle">
                <div className="card-body py-2 px-3">
                  <div className="text-body-secondary small">Rutas con atraso</div>
                  <div className="fs-5 fw-semibold text-danger">
                    {loading ? '…' : (kpis?.atraso_estructural_rutas ?? 0).toLocaleString('es-MX')}
                  </div>
                  <div className="small text-body-secondary">
                    {loading
                      ? '…'
                      : `${pct(kpis?.atraso_estructural_rutas_pct)} de ${(atrasoEstructural?.rutas_total ?? 0).toLocaleString('es-MX')} rutas`}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card h-100 border-0 shadow-sm border-danger-subtle">
                <div className="card-body py-2 px-3">
                  <div className="text-body-secondary small">Clientes con atraso</div>
                  <div className="fs-5 fw-semibold text-danger">
                    {loading ? '…' : (kpis?.atraso_estructural_clientes ?? 0).toLocaleString('es-MX')}
                  </div>
                  <div className="small text-body-secondary">
                    {loading
                      ? '…'
                      : `${pct(kpis?.atraso_estructural_clientes_pct)} de ${(atrasoEstructural?.clientes_total ?? 0).toLocaleString('es-MX')} clientes`}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card h-100 border-0 shadow-sm border-danger-subtle">
                <div className="card-body py-2 px-3">
                  <div className="text-body-secondary small">Saldo en atraso (clientes)</div>
                  <div className="fs-6 fw-semibold text-danger">
                    {loading ? '…' : money(kpis?.atraso_estructural_saldo)}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-body py-2 px-3">
                  <div className="text-body-secondary small">Cartera pendiente total</div>
                  <div className="fs-6 fw-semibold">
                    {loading ? '…' : money(atrasoEstructural?.saldo_cartera_total)}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row g-3 mb-3">
            <div className="col-12">
              <div className="card">
                <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <span>Atraso estructural por ruta</span>
                  <span className="small text-body-secondary fw-normal">
                    {loading
                      ? '…'
                      : `${(kpis?.atraso_estructural_rutas ?? 0).toLocaleString('es-MX')} rutas con atraso (${pct(kpis?.atraso_estructural_rutas_pct)})`}
                  </span>
                </div>
                <div className="card-body p-0">
                  <div className="d-none d-md-block table-responsive">
                    <table className="table table-sm table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Ruta</th>
                          <th className="text-end">Notas</th>
                          <th className="text-end">Saldo 0–30 d</th>
                          <th className="text-end">Saldo &gt;30 d</th>
                          <th className="text-end">% &gt;30 d</th>
                          <th className="text-end">Saldo total</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={7} className="text-center py-4">
                              Cargando…
                            </td>
                          </tr>
                        ) : atrasoPorRuta.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-4 text-body-secondary">
                              Sin rutas con cartera pendiente en los filtros actuales.
                            </td>
                          </tr>
                        ) : (
                          atrasoPorRuta.map((r) => (
                            <tr
                              key={r.ruta_codigo}
                              className={r.ruta_codigo !== '(sin ruta)' ? 'cursor-pointer' : undefined}
                              onClick={
                                r.ruta_codigo !== '(sin ruta)'
                                  ? () => handleClickRutaAtraso(r.ruta_codigo)
                                  : undefined
                              }
                            >
                              <td>{r.ruta_codigo}</td>
                              <td className="text-end">{r.notas?.toLocaleString?.('es-MX') ?? r.notas}</td>
                              <td className="text-end">{money(r.saldo_0_30)}</td>
                              <td className="text-end fw-medium">{money(r.saldo_mas_30)}</td>
                              <td
                                className={`text-end${r.atraso_estructural ? ' fw-semibold text-danger' : ''}`}
                              >
                                {pct(r.pct_mas_30)}
                              </td>
                              <td className="text-end">{money(r.saldo_total)}</td>
                              <td>
                                {r.atraso_estructural ? (
                                  <span className="badge text-bg-danger">Atraso estructural</span>
                                ) : (
                                  <span className="badge text-bg-success">OK</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="d-md-none p-2 p-sm-3">
                    {loading ? (
                      <p className="text-center text-body-secondary py-4 mb-0">Cargando…</p>
                    ) : atrasoPorRuta.length === 0 ? (
                      <p className="text-center text-body-secondary py-4 mb-0">
                        Sin rutas con cartera pendiente en los filtros actuales.
                      </p>
                    ) : (
                      <div className="d-flex flex-column gap-2">
                        {atrasoPorRuta.map((r) => (
                          <ReporteAtrasoRutaCardMovil
                            key={r.ruta_codigo}
                            r={r}
                            onClick={
                              r.ruta_codigo !== '(sin ruta)'
                                ? () => handleClickRutaAtraso(r.ruta_codigo)
                                : undefined
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row g-3 mb-3">
            <div className="col-12">
              <div className="card">
                <div className="card-header">Clientes con atraso estructural</div>
                <div className="card-body p-0">
                  <div className="d-none d-md-block table-responsive">
                    <table className="table table-sm table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Cliente</th>
                          <th className="text-end">Notas</th>
                          <th className="text-end">Saldo 0–30 d</th>
                          <th className="text-end">Saldo &gt;30 d</th>
                          <th className="text-end">% &gt;30 d</th>
                          <th className="text-end">Saldo total</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={7} className="text-center py-4">
                              Cargando…
                            </td>
                          </tr>
                        ) : clientesAtrasoEstructural.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-4 text-body-secondary">
                              Ningún cliente con atraso estructural en los filtros actuales.
                            </td>
                          </tr>
                        ) : (
                          clientesAtrasoEstructural.map((r) => (
                            <tr
                              key={r.cliente}
                              className="cursor-pointer"
                              onClick={() => handleClickClienteAtraso(r.cliente)}
                            >
                              <td className="text-break">{r.cliente}</td>
                              <td className="text-end">{r.notas?.toLocaleString?.('es-MX') ?? r.notas}</td>
                              <td className="text-end">{money(r.saldo_0_30)}</td>
                              <td className="text-end fw-medium">{money(r.saldo_mas_30)}</td>
                              <td className="text-end fw-semibold text-danger">{pct(r.pct_mas_30)}</td>
                              <td className="text-end">{money(r.saldo_total)}</td>
                              <td>
                                <span className="badge text-bg-danger">Atraso estructural</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="d-md-none p-2 p-sm-3">
                    {loading ? (
                      <p className="text-center text-body-secondary py-4 mb-0">Cargando…</p>
                    ) : clientesAtrasoEstructural.length === 0 ? (
                      <p className="text-center text-body-secondary py-4 mb-0">
                        Ningún cliente con atraso estructural en los filtros actuales.
                      </p>
                    ) : (
                      <div className="d-flex flex-column gap-2">
                        {clientesAtrasoEstructural.map((r) => (
                          <ReporteAtrasoEstructuralCardMovil
                            key={r.cliente}
                            r={r}
                            onClick={() => handleClickClienteAtraso(r.cliente)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
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
                        onClickResumen={handleClickResumen}
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
