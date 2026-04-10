import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import { useDomainSyncStore } from '../../stores/domainSyncStore.js'
import { fetchSeguimientoList } from '../../services/seguimientoApi.js'
import { exportarSeguimientoExcelConFiltros } from '../../utils/exportSeguimientoExcel.js'
import { useListCacheStore } from '../../stores/listCacheStore.js'
import { useListFiltersStore } from '../../stores/listFiltersStore.js'
import { estadoBadgeClass, notaMuestraAtencion } from '../../utils/estadoBadge.js'
import { formatDiasNotaCorriente } from '../../utils/diasCorriente.js'

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

function NotaSeguimientoCardMovil({ n }) {
  return (
    <div className="card border shadow-sm">
      <div className="card-body py-3">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <div className="min-w-0">
            <div className="fw-semibold text-truncate" title={n.serie_folio || ''}>
              {n.serie_folio || '—'}
            </div>
            <div className="small text-body-secondary">ID {n.id}</div>
          </div>
          <Link
            className="btn btn-sm btn-outline-primary flex-shrink-0"
            to={ROUTES.detalleNota(String(n.id))}
          >
            Ver detalle
          </Link>
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
      </div>
    </div>
  )
}

export default function SeguimientoPage() {
  const seguimientoFilters = useListFiltersStore((s) => s.seguimiento)
  const setSeguimientoFilters = useListFiltersStore((s) => s.setSeguimientoFilters)
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [exportandoExcel, setExportandoExcel] = useState(false)
  const requestSeqRef = useRef(0)
  const loadMoreRef = useRef(null)
  const syncMountRef = useRef(false)
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
    }),
    [
      seguimientoFilters.empresaActiva,
      seguimientoFilters.estado,
      seguimientoFilters.atencion,
      seguimientoFilters.ruta,
      seguimientoFilters.q,
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
    }),
    [filtros],
  )
  const cacheKey = useMemo(() => JSON.stringify(filtros), [filtros])

  const hasMore = page < (data.totalPages || 1)

  const cargarPagina = useCallback(async (targetPage, append = false) => {
    const requestSeq = ++requestSeqRef.current
    const cached = getCacheEntry('seguimiento', cacheKey)
    if (cached?.pages?.[targetPage]) {
      if (requestSeq !== requestSeqRef.current) return
      const merged = mergeCachedPages(cached, targetPage)
      setData({
        items: merged,
        total: cached.total ?? 0,
        totalPages: cached.totalPages ?? 1,
      })
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
      const r = await fetchSeguimientoList({ ...filtros, page: targetPage })
      if (requestSeq !== requestSeqRef.current) return
      setCachePage('seguimiento', cacheKey, targetPage, r)
      const nextCached = getCacheEntry('seguimiento', cacheKey)
      const merged = nextCached ? mergeCachedPages(nextCached, targetPage) : r.items || []
      setData({
        ...r,
        items: merged,
      })
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

  // Al volver desde el detalle la pantalla se remonta; el caché global seguía vivo y
  // el efecto de notasVersion se saltaba la limpieza en el primer render (syncMountRef).
  useEffect(() => {
    clearScreenCache('seguimiento')
  }, [clearScreenCache])

  useEffect(() => {
    if (!syncMountRef.current) {
      syncMountRef.current = true
      return
    }
    clearScreenCache('seguimiento')
    setData({ items: [], total: 0, totalPages: 1 })
    setPage(1)
    void cargarPagina(1, false)
  }, [notasVersion, rutasVersion, clearScreenCache, cargarPagina])

  useEffect(() => {
    setPage(1)
    setData({ items: [], total: 0, totalPages: 1 })
    void cargarPagina(1, false)
  }, [cargarPagina])

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
            <div className="col-12 col-md-2">
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
            <div className="col-12 col-md-2">
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
            <div className="col-12 col-md-2">
              <label className="form-label mb-1">Ruta (código exacto)</label>
              <input
                className="form-control"
                placeholder="Ej: DR201"
                title="Debe coincidir exactamente con el código de ruta (sin búsqueda parcial)"
                value={seguimientoFilters.ruta}
                onChange={(e) => {
                  setSeguimientoFilters({ ruta: e.target.value.toUpperCase() })
                  setPage(1)
                }}
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label mb-1">Buscar</label>
              <input
                className="form-control"
                placeholder="serie, cliente o vendedor"
                value={seguimientoFilters.q}
                onChange={(e) => {
                  setSeguimientoFilters({ q: e.target.value })
                  setPage(1)
                }}
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
            <div className="col-12 col-md-6 col-lg-7 d-flex align-items-end justify-content-md-end mt-2 mt-md-0">
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
                <th>Acción</th>
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
                  <tr key={n.id}>
                    <td>{n.id}</td>
                    <td>{n.serie_folio || '—'}</td>
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
                      <Link className="btn btn-sm btn-outline-primary" to={ROUTES.detalleNota(String(n.id))}>
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
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
                <NotaSeguimientoCardMovil key={n.id} n={n} />
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
    </section>
  )
}
