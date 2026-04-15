import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import { useDomainSyncStore } from '../../stores/domainSyncStore.js'
import { fetchNotasCredito } from '../../services/notasApi.js'
import { useListCacheStore } from '../../stores/listCacheStore.js'
import { useListFiltersStore } from '../../stores/listFiltersStore.js'
import { estadoBadgeClass, notaMuestraAtencion } from '../../utils/estadoBadge.js'
import { formatDiasNotaCorriente } from '../../utils/diasCorriente.js'

const PAGE_SIZE = 20

const SORT_OPTIONS = [
  { value: 'fecha_nota_desc', label: 'Fecha nota (más reciente)' },
  { value: 'fecha_nota_asc', label: 'Fecha nota (más antigua)' },
  { value: 'saldo_desc', label: 'Saldo (mayor a menor)' },
  { value: 'saldo_asc', label: 'Saldo (menor a mayor)' },
  { value: 'estado_asc', label: 'Estado (A–Z)' },
  { value: 'atencion_desc', label: 'Requieren atención primero' },
]

function money(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(n)
}

function formatFechaNota(value) {
  const s = String(value ?? '').trim()
  if (!s) return '—'
  const iso = s.slice(0, 10)
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
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

function NotaCreditoCardMovil({ n }) {
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
          <dt className="col-5 text-body-secondary">Cliente</dt>
          <dd className="col-7 mb-1 text-break">{n.cliente || '—'}</dd>
          <dt className="col-5 text-body-secondary">Empresa</dt>
          <dd className="col-7 mb-1">{n.empresa || '—'}</dd>
          <dt className="col-5 text-body-secondary">Ruta</dt>
          <dd className="col-7 mb-1">{n.ruta_codigo || '—'}</dd>
          <dt className="col-5 text-body-secondary">Fecha nota</dt>
          <dd className="col-7 mb-1">{formatFechaNota(n.fecha_nota)}</dd>
          <dt className="col-5 text-body-secondary">Días</dt>
          <dd className="col-7 mb-1" title="Entre fecha nota y fecha corriente (o hoy)">
            {formatDiasNotaCorriente(n.fecha_nota, n.fecha_corriente)}
          </dd>
          <dt className="col-5 text-body-secondary">Monto</dt>
          <dd className="col-7 mb-1 text-end">{money(n.monto)}</dd>
          <dt className="col-5 text-body-secondary">Abono</dt>
          <dd className="col-7 mb-1 text-end">{money(n.abono)}</dd>
          <dt className="col-5 text-body-secondary">Saldo</dt>
          <dd className="col-7 mb-1 text-end fw-medium">{money(n.saldo)}</dd>
          <dt className="col-5 text-body-secondary">Estado</dt>
          <dd className="col-7 mb-1">
            <span className={`badge ${estadoBadgeClass(n.estado)}`}>{n.estado || '—'}</span>
            {notaMuestraAtencion(n) ? (
              <span className="badge text-bg-warning ms-1">Atención</span>
            ) : null}
            {n.resuelta_automaticamente ? (
              <span className="badge text-bg-info ms-1" title="Marcada RESUELTA por importación">
                Auto
              </span>
            ) : null}
          </dd>
          <dt className="col-5 text-body-secondary">Vendedor</dt>
          <dd className="col-7 mb-0 small">{n.vendedor_username || n.usuario_vendedor_pv || '—'}</dd>
        </dl>
      </div>
    </div>
  )
}

export default function TodasLasNotasPage() {
  const notasFilters = useListFiltersStore((s) => s.notas)
  const setNotasFilters = useListFiltersStore((s) => s.setNotasFilters)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const getCacheEntry = useListCacheStore((s) => s.getEntry)
  const setCachePage = useListCacheStore((s) => s.setPage)
  const clearCacheEntry = useListCacheStore((s) => s.clearEntry)
  const clearScreenCache = useListCacheStore((s) => s.clearScreen)
  const notasVersion = useDomainSyncStore((s) => s.notasVersion)
  const didMountSyncRef = useRef(false)

  const baseParams = useMemo(
    () => ({
      pageSize: PAGE_SIZE,
      empresa: notasFilters.empresaActiva,
      estado: notasFilters.estado,
      ruta: notasFilters.ruta,
      q: notasFilters.q,
      sort: notasFilters.sort,
      ...(notasFilters.dias ? { dias: notasFilters.dias } : {}),
    }),
    [
      notasFilters.empresaActiva,
      notasFilters.estado,
      notasFilters.ruta,
      notasFilters.q,
      notasFilters.sort,
      notasFilters.dias,
    ],
  )
  const cacheKey = useMemo(() => JSON.stringify(baseParams), [baseParams])

  // Misma causa que en Seguimiento: al volver del detalle la lista se remonta y el caché
  // seguía sirviendo filas obsoletas si notasVersion no cambió o el efecto se saltaba.
  useEffect(() => {
    clearScreenCache('notas')
  }, [clearScreenCache])

  useEffect(() => {
    if (!didMountSyncRef.current) {
      didMountSyncRef.current = true
      return
    }
    clearScreenCache('notas')
    setItems([])
    setPage(1)
    setRefreshNonce((n) => n + 1)
  }, [notasVersion, clearScreenCache])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      const cached = getCacheEntry('notas', cacheKey)
      if (cached?.pages?.[page]) {
        if (cancel) return
        setTotal(cached.total ?? 0)
        setTotalPages(cached.totalPages ?? 1)
        setItems(mergeCachedPages(cached, page))
        setLoading(false)
        setError('')
        return
      }

      setLoading(true)
      setError('')
      try {
        const data = await fetchNotasCredito({ ...baseParams, page })
        if (cancel) return
        setCachePage('notas', cacheKey, page, data)
        const nextCached = getCacheEntry('notas', cacheKey)
        const merged = nextCached ? mergeCachedPages(nextCached, page) : data.items || []
        setTotal(data.total ?? 0)
        setTotalPages(data.totalPages ?? 1)
        setItems(merged)
      } catch (e) {
        if (!cancel) setError(e?.message || 'No se pudo cargar notas')
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [baseParams, page, refreshNonce, getCacheEntry, cacheKey, setCachePage])

  function updateFiltro(name, value) {
    setPage(1)
    setNotasFilters({ [name]: value })
  }

  function updateDias(value) {
    setPage(1)
    setNotasFilters({ dias: value })
  }

  function updateSort(value) {
    setPage(1)
    setNotasFilters({ sort: value })
  }

  const canLoadMore = !loading && page < totalPages
  const shown = items.length

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-3">Todas las notas de crédito</h1>
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${notasFilters.empresaActiva === 'DISTRIBUIDORA' ? ' active' : ''}`}
            onClick={() => {
              setNotasFilters({ empresaActiva: 'DISTRIBUIDORA' })
              setPage(1)
            }}
          >
            Distribuidora
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${notasFilters.empresaActiva === 'RODRIGO' ? ' active' : ''}`}
            onClick={() => {
              setNotasFilters({ empresaActiva: 'RODRIGO' })
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
            <div className="col-12 col-md-3 col-lg-2">
              <label className="form-label mb-1">Últimos días</label>
              <select
                className="form-select"
                title="Filtra por fecha de la nota (desde hoy hacia atrás)"
                value={notasFilters.dias}
                onChange={(e) => updateDias(e.target.value)}
              >
                <option value="">Sin límite</option>
                <option value="7">7 días</option>
                <option value="30">30 días</option>
                <option value="90">90 días</option>
                <option value="365">365 días</option>
              </select>
            </div>
            <div className="col-12 col-md-3 col-lg-2">
              <label className="form-label mb-1">Orden</label>
              <select
                className="form-select"
                value={notasFilters.sort}
                onChange={(e) => updateSort(e.target.value)}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-3 col-lg-2">
              <label className="form-label mb-1">Estado</label>
              <select
                className="form-select"
                value={notasFilters.estado}
                onChange={(e) => updateFiltro('estado', e.target.value)}
              >
                <option value="">Todos</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="RESUELTA">RESUELTA</option>
                <option value="CANCELADA">CANCELADA</option>
              </select>
            </div>
            <div className="col-12 col-md-3 col-lg-2">
              <label className="form-label mb-1">Ruta (código)</label>
              <input
                className="form-control"
                value={notasFilters.ruta}
                onChange={(e) => updateFiltro('ruta', e.target.value)}
                placeholder="Ej: R01"
              />
            </div>
            <div className="col-12 col-md-3 col-lg-2">
              <label className="form-label mb-1">Buscar</label>
              <input
                className="form-control"
                value={notasFilters.q}
                onChange={(e) => updateFiltro('q', e.target.value)}
                placeholder="serie, cliente o vendedor"
              />
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="alert alert-warning" role="alert">
          {error}
        </div>
      ) : null}

      <div className="card">
        <div className="d-none d-md-block table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>ID</th>
                <th>Serie/Folio</th>
                <th>Cliente</th>
                <th>Empresa</th>
                <th>Ruta</th>
                <th>Fecha nota</th>
                <th className="text-end" title="Días entre fecha nota y fecha corriente (o hoy)">
                  Días
                </th>
                <th className="text-end">Monto</th>
                <th className="text-end">Abono</th>
                <th className="text-end">Saldo</th>
                <th>Estado</th>
                <th>Vendedor</th>
                <th className="text-end">Seguimiento</th>
              </tr>
            </thead>
            <tbody>
              {loading && shown === 0 ? (
                <tr>
                  <td colSpan="13" className="text-center py-4">
                    Cargando…
                  </td>
                </tr>
              ) : items.length ? (
                items.map((n) => (
                  <tr key={n.id}>
                    <td>{n.id}</td>
                    <td>{n.serie_folio || '—'}</td>
                    <td>{n.cliente || '—'}</td>
                    <td>{n.empresa || '—'}</td>
                    <td>{n.ruta_codigo || '—'}</td>
                    <td className="text-nowrap">{formatFechaNota(n.fecha_nota)}</td>
                    <td className="text-end text-nowrap" title="Entre fecha nota y fecha corriente (o hoy)">
                      {formatDiasNotaCorriente(n.fecha_nota, n.fecha_corriente)}
                    </td>
                    <td className="text-end">{money(n.monto)}</td>
                    <td className="text-end">{money(n.abono)}</td>
                    <td className="text-end">{money(n.saldo)}</td>
                    <td>
                      <span className={`badge ${estadoBadgeClass(n.estado)}`}>{n.estado || '—'}</span>
                      {notaMuestraAtencion(n) ? (
                        <span className="badge text-bg-warning ms-1">Atención</span>
                      ) : null}
                      {n.resuelta_automaticamente ? (
                        <span className="badge text-bg-info ms-1" title="Marcada RESUELTA por importación">
                          Auto
                        </span>
                      ) : null}
                    </td>
                    <td className="small">
                      {n.vendedor_username || n.usuario_vendedor_pv || '—'}
                    </td>
                    <td className="text-end">
                      <Link
                        className="btn btn-sm btn-outline-primary"
                        to={ROUTES.detalleNota(String(n.id))}
                      >
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
          {loading && shown === 0 ? (
            <p className="text-center text-body-secondary py-4 mb-0">Cargando…</p>
          ) : items.length ? (
            <div className="d-flex flex-column gap-2">
              {items.map((n) => (
                <NotaCreditoCardMovil key={n.id} n={n} />
              ))}
            </div>
          ) : (
            <p className="text-center text-body-secondary py-4 mb-0">Sin resultados</p>
          )}
        </div>
        <div className="card-footer d-flex flex-column flex-md-row gap-2 justify-content-between align-items-stretch align-items-md-center">
          <span className="small text-body-secondary">
            Mostrando {shown} de {total} · Página {page} / {totalPages || 1}
            {loading && shown > 0 ? ' · cargando…' : null}
          </span>
          <div className="d-flex flex-wrap gap-2 justify-content-md-end">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={loading}
              onClick={() => {
                setPage(1)
                clearCacheEntry('notas', cacheKey)
                setRefreshNonce((n) => n + 1)
              }}
            >
              Recargar desde el inicio
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!canLoadMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Cargar más
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
