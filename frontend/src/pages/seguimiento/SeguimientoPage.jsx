import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaComment, FaEye } from 'react-icons/fa6'
import { ROUTES } from '../../constants/routes.js'
import { useDomainSyncStore } from '../../stores/domainSyncStore.js'
import { fetchSeguimientoList } from '../../services/seguimientoApi.js'
import { exportarSeguimientoExcelConFiltros } from '../../utils/exportSeguimientoExcel.js'
import { useListCacheStore } from '../../stores/listCacheStore.js'
import { useListFiltersStore } from '../../stores/listFiltersStore.js'
import { estadoBadgeClass, notaMuestraAtencion } from '../../utils/estadoBadge.js'
import { formatDiasNotaCorriente } from '../../utils/diasCorriente.js'
import ComentarioNotaRapidoModal from '../../components/ComentarioNotaRapidoModal.jsx'

const PAGE_SIZE = 20
const BUCKET_LABELS = {
  negativo: 'Fecha inconsistente',
  d0_30: '0–30 días',
  d31_45: '31–45 días',
  d46_60: '46–60 días',
  d61_90: '61–90 días',
  d91_180: '91–180 días',
  d181_365: '181–365 días',
  d366_plus: '>365 días',
}

function formatFechaNota(value) {
  if (value == null || value === '') return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
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

function mergeCachedPages(entry, upToPage) {
  if (!entry?.pages) return []
  const ids = new Set()
  const merged = []
  for (let p = 1; p <= upToPage; p += 1) {
    const rows = entry.pages[p] || []
    for (const row of rows) {
      if (ids.has(row.id)) continue
      ids.add(row.id)
      merged.push(row)
    }
  }
  return merged
}

async function copyText(text) {
  const value = String(text ?? '').trim()
  if (!value) return
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function NotaSeguimientoCardMovil({ n, onCopySerieFolio, onAbrirComentario, mostrarComentarios }) {
  return (
    <div className="card border shadow-sm">
      <div className="card-body py-3">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <div className="min-w-0">
            <div className="d-flex align-items-center gap-1">
              <div className="fw-semibold text-truncate" title={n.serie_folio || ''}>
                {n.serie_folio || '—'}
              </div>
              <button
                type="button"
                className="btn btn-sm btn-secondary py-0 px-2"
                aria-label="Copiar Serie/Folio"
                title="Copiar Serie/Folio"
                disabled={!n.serie_folio}
                onClick={() => {
                  void onCopySerieFolio(n.serie_folio)
                }}
              >
                <span aria-hidden="true">📋</span>
              </button>
            </div>
            <div className="small text-body-secondary">ID {n.id}</div>
          </div>
          <div className="d-flex flex-row flex-wrap gap-1 flex-shrink-0 align-items-center justify-content-end">
            <Link
              className="btn btn-sm btn-primary d-inline-flex align-items-center justify-content-center px-2"
              to={ROUTES.detalleNota(String(n.id))}
              title="Detalle"
              aria-label="Ver detalle de la nota"
            >
              <FaEye className="fs-6" aria-hidden />
            </Link>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center px-2"
              title="Comentario"
              aria-label="Agregar comentarios o aclaraciones"
              onClick={() =>
                onAbrirComentario({
                  id: n.id,
                  serie_folio: n.serie_folio,
                  cliente: n.cliente,
                })
              }
            >
              <FaComment className="fs-6" aria-hidden />
            </button>
          </div>
        </div>
        <dl className="row small mb-0 gx-2">
          <dt className="col-5 text-body-secondary">Fecha nota</dt>
          <dd className="col-7 mb-1">{formatFechaNota(n.fecha_nota)}</dd>
          <dt className="col-5 text-body-secondary">Días</dt>
          <dd className="col-7 mb-1" title="Entre fecha nota y fecha corriente (o hoy)">
            {formatDiasNotaCorriente(n.fecha_nota, n.fecha_corriente)}
          </dd>
          <dt className="col-5 text-body-secondary">Cliente</dt>
          <dd className="col-7 mb-1 text-break">{n.cliente || '—'}</dd>
          <dt className="col-5 text-body-secondary">Empresa</dt>
          <dd className="col-7 mb-1">{n.empresa || '—'}</dd>
          <dt className="col-5 text-body-secondary">Ruta</dt>
          <dd className="col-7 mb-1">{n.ruta_codigo || '—'}</dd>
          <dt className="col-5 text-body-secondary">Monto</dt>
          <dd className="col-7 mb-1 text-end">{money(n.monto)}</dd>
          <dt className="col-5 text-body-secondary">Abono</dt>
          <dd className="col-7 mb-1 text-end">{money(n.abono)}</dd>
          <dt className="col-5 text-body-secondary">Saldo</dt>
          <dd className="col-7 mb-1 text-end fw-medium">{money(n.saldo)}</dd>
          <dt className="col-5 text-body-secondary">Estado</dt>
          <dd className="col-7 mb-1">
            <span className={`badge ${estadoBadgeClass(n.estado)}`}>{n.estado || '—'}</span>
          </dd>
          <dt className="col-5 text-body-secondary">Atención</dt>
          <dd className="col-7 mb-0">{notaMuestraAtencion(n) ? 'Sí' : 'No'}</dd>
        </dl>
        {mostrarComentarios && n.aclaraciones?.length > 0 && (
          <div className="mt-3 bg-body-secondary bg-opacity-25 p-2 small rounded border shadow-sm">
            <div className="fw-bold mb-1 border-bottom pb-1 d-flex align-items-center gap-2 text-body">
              <span>Comentarios recientes:</span>
              <span className="badge rounded-pill text-bg-secondary opacity-75">{n.aclaraciones.length}</span>
            </div>
            {n.aclaraciones.map((c) => (
              <div key={c.id} className="mb-1 border-bottom border-secondary-subtle last-child-no-border pb-1">
                <span className="badge text-bg-secondary me-1 opacity-75" style={{fontSize: '0.6rem'}}>
                  {c.tipo}
                </span>
                <span className="text-body-secondary me-1 fw-semibold">
                  {c.usuarios?.username || '—'}:
                </span>
                <span className="text-body">{c.comentario}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SeguimientoPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [mostrarComentarios, setMostrarComentarios] = useState(false)
  const seguimientoFilters = useListFiltersStore((s) => s.seguimiento)
  const setSeguimientoFilters = useListFiltersStore((s) => s.setSeguimientoFilters)
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [exportandoExcel, setExportandoExcel] = useState(false)
  const [copyToast, setCopyToast] = useState('')
  const [comentarioNota, setComentarioNota] = useState(null)
  const [rutaInput, setRutaInput] = useState(seguimientoFilters.ruta || '')
  const [qInput, setQInput] = useState(seguimientoFilters.q || '')
  const requestSeqRef = useRef(0)
  const loadMoreRef = useRef(null)
  const getCacheEntry = useListCacheStore((s) => s.getEntry)
  const setCachePage = useListCacheStore((s) => s.setPage)
  const clearScreenCache = useListCacheStore((s) => s.clearScreen)
  const notasVersion = useDomainSyncStore((s) => s.notasVersion)
  const rutasVersion = useDomainSyncStore((s) => s.rutasVersion)

  const filtros = useMemo(
    () => ({
      pageSize: PAGE_SIZE,
      empresa: seguimientoFilters.empresaActiva,
      estado: seguimientoFilters.estado,
      atencion: seguimientoFilters.atencion,
      ruta: seguimientoFilters.ruta,
      q: seguimientoFilters.q,
      sort: seguimientoFilters.orden,
      ...(seguimientoFilters.dias ? { dias: seguimientoFilters.dias } : {}),
    }),
    [
      seguimientoFilters.empresaActiva,
      seguimientoFilters.estado,
      seguimientoFilters.atencion,
      seguimientoFilters.ruta,
      seguimientoFilters.q,
      seguimientoFilters.dias,
      seguimientoFilters.orden,
    ],
  )

  const filtrosExportacion = useMemo(
    () => ({
      empresa: filtros.empresa,
      estado: filtros.estado,
      atencion: filtros.atencion,
      ruta: filtros.ruta,
      q: filtros.q,
      sort: filtros.sort,
      ...(filtros.dias ? { dias: filtros.dias } : {}),
    }),
    [filtros],
  )
  const cacheKey = useMemo(() => JSON.stringify(filtros), [filtros])

  const hasMore = page < (data.totalPages || 1)

  const cargarPagina = useCallback(async (targetPage, append = false) => {
    const includeAggregates = !append && targetPage === 1
    const requestSeq = ++requestSeqRef.current
    const cached = getCacheEntry('seguimiento', cacheKey)
    if (cached?.pages?.[targetPage]) {
      if (requestSeq !== requestSeqRef.current) return
      const merged = mergeCachedPages(cached, targetPage)
      setData((prev) => ({
        ...prev,
        items: merged,
        total: cached.total ?? 0,
        totalPages: cached.totalPages ?? 1,
      }))
      setPage(targetPage)
      setLoading(false)
      setLoadingMore(false)
      setError('')
      return
    }

    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setError('')
    }
    try {
      const r = await fetchSeguimientoList({
        ...filtros,
        page: targetPage,
        includeAggregates: includeAggregates ? 'true' : 'false',
      })
      if (requestSeq !== requestSeqRef.current) return
      setCachePage('seguimiento', cacheKey, targetPage, r)
      const nextCached = getCacheEntry('seguimiento', cacheKey)
      const merged = nextCached ? mergeCachedPages(nextCached, targetPage) : r.items || []
      setData((prev) => ({
        ...r,
        resumen: includeAggregates ? r.resumen : prev.resumen,
        porRuta: includeAggregates ? r.porRuta : prev.porRuta,
        porAntiguedad: includeAggregates ? r.porAntiguedad : prev.porAntiguedad,
        items: merged,
      }))
      setPage(typeof r.page === 'number' ? r.page : targetPage)
    } catch (e) {
      if (requestSeq !== requestSeqRef.current) return
      setError(e?.message || 'No se pudo cargar seguimiento')
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [filtros, getCacheEntry, cacheKey, setCachePage])

  useEffect(() => {
    clearScreenCache('seguimiento')
    setData({ items: [], total: 0, totalPages: 1 })
    setPage(1)
    void cargarPagina(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notasVersion, rutasVersion, refreshKey, clearScreenCache, cargarPagina])

  useEffect(() => {
    setRutaInput(seguimientoFilters.ruta || '')
  }, [seguimientoFilters.ruta])

  useEffect(() => {
    setQInput(seguimientoFilters.q || '')
  }, [seguimientoFilters.q])

  useEffect(() => {
    const next = String(rutaInput || '').trim().toUpperCase()
    if (next === String(seguimientoFilters.ruta || '').trim().toUpperCase()) return
    const t = setTimeout(() => {
      setSeguimientoFilters({ ruta: next })
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [rutaInput, seguimientoFilters.ruta, setSeguimientoFilters])

  useEffect(() => {
    const next = String(qInput || '').trim()
    if (next === String(seguimientoFilters.q || '').trim()) return
    const t = setTimeout(() => {
      setSeguimientoFilters({ q: next })
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [qInput, seguimientoFilters.q, setSeguimientoFilters])

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node) return
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (!first?.isIntersecting) return
        if (loading || loadingMore || !hasMore || error) return
        void cargarPagina(page + 1, true)
      },
      { root: null, rootMargin: '200px 0px', threshold: 0.1 },
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [page, hasMore, loading, loadingMore, error, cargarPagina])

  async function handleCopySerieFolio(value) {
    try {
      await copyText(value)
      setCopyToast(`Serie/Folio copiado: ${value}`)
    } catch {
      window.alert('No se pudo copiar Serie/Folio')
    }
  }

  useEffect(() => {
    if (!copyToast) return
    const t = setTimeout(() => setCopyToast(''), 1800)
    return () => clearTimeout(t)
  }, [copyToast])

  function handleActualizar() {
    clearScreenCache('seguimiento')
    setData({ items: [], total: 0, totalPages: 1 })
    setPage(1)
    setRefreshKey((k) => k + 1)
  }

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-3">Seguimiento</h1>
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${seguimientoFilters.empresaActiva === 'DISTRIBUIDORA' ? ' active' : ''}`}
            onClick={() => {
              setSeguimientoFilters({ empresaActiva: 'DISTRIBUIDORA' })
              setPage(1)
            }}
          >
            Distribuidora
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${seguimientoFilters.empresaActiva === 'RODRIGO' ? ' active' : ''}`}
            onClick={() => {
              setSeguimientoFilters({ empresaActiva: 'RODRIGO' })
              setPage(1)
            }}
          >
            Rodrigo
          </button>
        </li>
      </ul>

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-12 col-md-6 col-lg-2">
              <label className="form-label mb-1">Últimos días</label>
              <select
                className="form-select"
                title="Filtra por fecha de la nota (desde hoy hacia atrás)"
                value={seguimientoFilters.dias}
                onChange={(e) => {
                  setSeguimientoFilters({ dias: e.target.value })
                  setPage(1)
                }}
              >
                <option value="">Sin límite</option>
                <option value="7">7 días</option>
                <option value="30">30 días</option>
                <option value="90">90 días</option>
                <option value="365">365 días</option>
              </select>
            </div>
            <div className="col-12 col-md-6 col-lg-2">
              <label className="form-label mb-1">Estado</label>
              <select
                className="form-select"
                value={seguimientoFilters.estado}
                onChange={(e) => {
                  setSeguimientoFilters({ estado: e.target.value })
                  setPage(1)
                }}
              >
                <option value="">Todos</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="RESUELTA">RESUELTA</option>
                <option value="CANCELADA">CANCELADA</option>
              </select>
            </div>
            <div className="col-12 col-md-6 col-lg-2">
              <label className="form-label mb-1">Atención</label>
              <select
                className="form-select"
                value={seguimientoFilters.atencion}
                onChange={(e) => {
                  setSeguimientoFilters({ atencion: e.target.value })
                  setPage(1)
                }}
              >
                <option value="">Todos</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="col-12 col-md-6 col-lg-2">
              <label className="form-label mb-1">Ruta (código exacto)</label>
              <input
                className="form-control"
                placeholder="Ej: DR201"
                title="Debe coincidir exactamente con el código de ruta (sin búsqueda parcial)"
                value={rutaInput}
                onChange={(e) => setRutaInput(e.target.value)}
              />
            </div>
            <div className="col-12 col-lg-4">
              <label className="form-label mb-1">Buscar</label>
              <input
                className="form-control"
                placeholder="serie, cliente o vendedor"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
              />
            </div>
          </div>
          <div className="row g-2 mt-1">
            <div className="col-12 col-md-6 col-lg-5">
              <label className="form-label mb-1">Ordenar por</label>
              <select
                className="form-select"
                value={seguimientoFilters.orden}
                onChange={(e) => {
                  setSeguimientoFilters({ orden: e.target.value })
                  setPage(1)
                }}
              >
                <option value="default">Atención y última actividad (predeterminado)</option>
                <option value="fecha_ultima_desc">Última actualización — más reciente</option>
                <option value="fecha_ultima_asc">Última actualización — más antigua</option>
                <option value="fecha_nota_desc">Fecha nota — más reciente</option>
                <option value="fecha_nota_asc">Fecha nota — más antigua</option>
                <option value="id_desc">ID — mayor primero</option>
                <option value="id_asc">ID — menor primero</option>
                <option value="serie_folio_asc">Serie/Folio — A a Z</option>
                <option value="serie_folio_desc">Serie/Folio — Z a A</option>
                <option value="cliente_asc">Cliente — A a Z</option>
                <option value="cliente_desc">Cliente — Z a A</option>
                <option value="saldo_desc">Saldo — mayor primero</option>
                <option value="saldo_asc">Saldo — menor primero</option>
              </select>
            </div>
            <div className="col-12 col-md-6 col-lg-7 d-flex align-items-end justify-content-md-end gap-3 mt-2 mt-md-0">
              <div className="form-check form-switch mb-2 me-auto">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="switchComentarios"
                  checked={mostrarComentarios}
                  onChange={(e) => setMostrarComentarios(e.target.checked)}
                />
                <label className="form-check-label small" htmlFor="switchComentarios">
                  Ver comentarios
                </label>
              </div>
              <button
                type="button"
                className="btn btn-success btn-nc-export-excel"
                disabled={loading}
                onClick={handleActualizar}
                title="Recargar datos desde el servidor"
              >
                {loading ? 'Cargando…' : '↻ Actualizar'}
              </button>
              <button
                type="button"
                className="btn btn-success btn-nc-export-excel"
                disabled={exportandoExcel || loading}
                onClick={async () => {
                  setExportandoExcel(true)
                  try {
                    const r = await exportarSeguimientoExcelConFiltros(filtrosExportacion)
                    if (r.truncated) {
                      window.alert(
                        `Se exportaron ${r.rowCount.toLocaleString('es-MX')} filas. El total filtrado es ${r.totalReported.toLocaleString('es-MX')}; el archivo se cortó por límite de seguridad (máx. 30000 filas).`,
                      )
                    }
                  } catch (e) {
                    window.alert(e?.message || 'No se pudo exportar a Excel')
                  } finally {
                    setExportandoExcel(false)
                  }
                }}
              >
                {exportandoExcel ? 'Exportando…' : 'Exportar Excel (filtros actuales)'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-md-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">Total filtrado</div>
              <div className="fs-5 fw-semibold">
                {(data?.resumen?.total_filtrado ?? data?.total ?? 0).toLocaleString('es-MX')}
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">Requieren atención</div>
              <div className="fs-5 fw-semibold text-warning">
                {(data?.resumen?.requiere_atencion ?? 0).toLocaleString('es-MX')}
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">Rutas con notas</div>
              <div className="fs-5 fw-semibold">
                {(data?.porRuta?.length ?? 0).toLocaleString('es-MX')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-header">Registros por ruta</div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-sm table-striped mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Ruta</th>
                      <th className="text-end">Registros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="2" className="text-center py-3">Cargando...</td>
                      </tr>
                    ) : (data?.porRuta?.length || 0) === 0 ? (
                      <tr>
                        <td colSpan="2" className="text-center py-3 text-body-secondary">Sin datos</td>
                      </tr>
                    ) : (
                      (data.porRuta || []).slice(0, 15).map((r) => (
                        <tr key={r.ruta_codigo}>
                          <td>{r.ruta_codigo}</td>
                          <td className="text-end">{(r.registros ?? 0).toLocaleString('es-MX')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-header">Rangos de antigüedad</div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-sm table-bordered mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Rango</th>
                      <th className="text-end">Registros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="2" className="text-center py-3">Cargando...</td>
                      </tr>
                    ) : (data?.porAntiguedad?.length || 0) === 0 ? (
                      <tr>
                        <td colSpan="2" className="text-center py-3 text-body-secondary">Sin datos</td>
                      </tr>
                    ) : (
                      (data.porAntiguedad || []).map((r) => (
                        <tr key={r.bucket_id}>
                          <td>{BUCKET_LABELS[r.bucket_id] || r.bucket_id}</td>
                          <td className="text-end">{(r.registros ?? 0).toLocaleString('es-MX')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-warning">{error}</div> : null}

      <div className="card">
        <div className="d-none d-md-block table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>ID</th>
                <th>Serie/Folio</th>
                <th>Fecha nota</th>
                <th className="text-end" title="Días entre fecha nota y fecha corriente (o hoy)">
                  Días
                </th>
                <th>Cliente</th>
                <th>Empresa</th>
                <th>Ruta</th>
                <th className="text-end">Monto</th>
                <th className="text-end">Abono</th>
                <th className="text-end">Saldo</th>
                <th>Estado</th>
                <th>Atención</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="13" className="text-center py-4">
                    Cargando...
                  </td>
                </tr>
              ) : data.items?.length ? (
                data.items.map((n) => (
                  <Fragment key={n.id}>
                    <tr className={mostrarComentarios && n.aclaraciones?.length > 0 ? 'border-bottom-0' : ''}>
                      <td>{n.id}</td>
                      <td>
                        <div className="d-inline-flex align-items-center gap-1">
                          <span>{n.serie_folio || '—'}</span>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary py-0 px-2"
                            aria-label="Copiar Serie/Folio"
                            title="Copiar Serie/Folio"
                            disabled={!n.serie_folio}
                            onClick={() => {
                              void handleCopySerieFolio(n.serie_folio)
                            }}
                          >
                            <span aria-hidden="true">📋</span>
                          </button>
                        </div>
                      </td>
                      <td className="text-nowrap small">{formatFechaNota(n.fecha_nota)}</td>
                      <td className="text-end text-nowrap small" title="Entre fecha nota y fecha corriente (o hoy)">
                        {formatDiasNotaCorriente(n.fecha_nota, n.fecha_corriente)}
                      </td>
                      <td>{n.cliente || '—'}</td>
                      <td>{n.empresa || '—'}</td>
                      <td>{n.ruta_codigo || '—'}</td>
                      <td className="text-end small">{money(n.monto)}</td>
                      <td className="text-end small">{money(n.abono)}</td>
                      <td className="text-end small fw-medium">{money(n.saldo)}</td>
                      <td>
                        <span className={`badge ${estadoBadgeClass(n.estado)}`}>{n.estado || '—'}</span>
                      </td>
                      <td>{notaMuestraAtencion(n) ? 'Sí' : 'No'}</td>
                      <td>
                        <div className="d-inline-flex flex-row flex-wrap gap-1 align-items-center">
                          <Link
                            className="btn btn-sm btn-primary d-inline-flex align-items-center justify-content-center px-2"
                            to={ROUTES.detalleNota(String(n.id))}
                            title="Detalle"
                            aria-label="Ver detalle de la nota"
                          >
                            <FaEye className="fs-6" aria-hidden />
                          </Link>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center px-2"
                            title="Comentario"
                            aria-label="Agregar comentarios o aclaraciones"
                            onClick={() =>
                              setComentarioNota({
                                id: n.id,
                                serie_folio: n.serie_folio,
                                cliente: n.cliente,
                              })
                            }
                          >
                            <FaComment className="fs-6" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {mostrarComentarios && n.aclaraciones?.length > 0 && (
                      <tr className="bg-transparent">
                        <td colSpan="13" className="p-0 border-top-0">
                          <div className="bg-body-secondary bg-opacity-25 p-2 small ms-4 me-4 mb-2 rounded border shadow-sm">
                            <div className="fw-bold mb-1 border-bottom pb-1 d-flex align-items-center gap-2 text-body">
                              <span>Comentarios recientes:</span>
                              <span className="badge rounded-pill text-bg-secondary opacity-75">{n.aclaraciones.length}</span>
                            </div>
                            {n.aclaraciones.map((c) => (
                              <div key={c.id} className="mb-1 border-bottom border-secondary-subtle pb-1">
                                <span className="badge text-bg-secondary me-1 opacity-75" style={{fontSize: '0.65rem'}}>
                                  {c.tipo}
                                </span>
                                <span className="text-body-secondary me-1 fw-semibold">
                                  {c.usuarios?.username || '—'}:
                                </span>
                                <span className="text-body">{c.comentario}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan="13" className="text-center py-4">
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="d-md-none p-2 p-sm-3">
          {loading ? (
            <p className="text-center text-body-secondary py-4 mb-0">Cargando...</p>
          ) : data.items?.length ? (
            <div className="d-flex flex-column gap-2">
              {data.items.map((n) => (
                <NotaSeguimientoCardMovil
                  key={n.id}
                  n={n}
                  onCopySerieFolio={handleCopySerieFolio}
                  onAbrirComentario={setComentarioNota}
                  mostrarComentarios={mostrarComentarios}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-body-secondary py-4 mb-0">Sin resultados</p>
          )}
        </div>
        <div className="card-footer d-flex justify-content-between align-items-center">
          <span className="small text-body-secondary">Total: {data.total ?? 0}</span>
          <span className="small text-body-secondary">
            Página {page} / {data.totalPages || 1}
          </span>
        </div>
      </div>
      <div ref={loadMoreRef} className="py-3 text-center small text-body-secondary">
        {loadingMore ? 'Cargando más...' : hasMore ? 'Desplázate para cargar más' : 'Fin de resultados'}
      </div>
      {copyToast ? (
        <div className="toast-container position-fixed top-0 end-0 p-3" style={{ zIndex: 1080 }}>
          <div className="toast show align-items-center text-bg-success border-0" role="status" aria-live="polite" aria-atomic="true">
            <div className="d-flex">
              <div className="toast-body">{copyToast}</div>
              <button
                type="button"
                className="btn-close btn-close-white me-2 m-auto"
                aria-label="Cerrar"
                onClick={() => setCopyToast('')}
              />
            </div>
          </div>
        </div>
      ) : null}
      <ComentarioNotaRapidoModal
        show={Boolean(comentarioNota)}
        notaId={comentarioNota?.id}
        serieFolio={comentarioNota?.serie_folio}
        cliente={comentarioNota?.cliente}
        onClose={() => setComentarioNota(null)}
        onGuardado={() => setCopyToast('Comentario guardado')}
      />
    </section>
  )
}
