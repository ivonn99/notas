import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSeguimientoList } from '../../services/seguimientoApi.js'
import { estadoBadgeClass } from '../../utils/estadoBadge.js'

const PAGE_SIZE = 20

function formatFechaNota(value) {
  if (value == null || value === '') return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

export default function SeguimientoPage() {
  const [empresaActiva, setEmpresaActiva] = useState('DISTRIBUIDORA')
  const [page, setPage] = useState(1)
  const [estado, setEstado] = useState('PENDIENTE')
  const [atencion, setAtencion] = useState('')
  const [ruta, setRuta] = useState('')
  const [q, setQ] = useState('')
  const [orden, setOrden] = useState('default')
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const loadMoreRef = useRef(null)

  const filtros = useMemo(
    () => ({
      pageSize: PAGE_SIZE,
      empresa: empresaActiva,
      estado,
      atencion,
      ruta,
      q,
      sort: orden,
    }),
    [empresaActiva, estado, atencion, ruta, q, orden],
  )

  const hasMore = page < (data.totalPages || 1)

  const cargarPagina = useCallback(async (targetPage, append = false) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setError('')
    }
    try {
      const r = await fetchSeguimientoList({ ...filtros, page: targetPage })
      setData((prev) => ({
        ...r,
        items: append ? [...(prev.items || []), ...(r.items || [])] : r.items || [],
      }))
      setPage(targetPage)
    } catch (e) {
      setError(e?.message || 'No se pudo cargar seguimiento')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filtros])

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
            className={`nav-link${empresaActiva === 'DISTRIBUIDORA' ? ' active' : ''}`}
            onClick={() => {
              setEmpresaActiva('DISTRIBUIDORA')
              setPage(1)
            }}
          >
            Distribuidora
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${empresaActiva === 'RODRIGO' ? ' active' : ''}`}
            onClick={() => {
              setEmpresaActiva('RODRIGO')
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
                value={estado}
                onChange={(e) => {
                  setEstado(e.target.value)
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
                value={atencion}
                onChange={(e) => {
                  setAtencion(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">Todos</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="col-12 col-md-2">
              <label className="form-label mb-1">Ruta</label>
              <input
                className="form-control"
                placeholder="Ej: DR201"
                value={ruta}
                onChange={(e) => {
                  setRuta(e.target.value.toUpperCase())
                  setPage(1)
                }}
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label mb-1">Buscar</label>
              <input
                className="form-control"
                placeholder="serie, cliente o vendedor"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
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
                value={orden}
                onChange={(e) => {
                  setOrden(e.target.value)
                  setPage(1)
                }}
              >
                <option value="default">Atención y última actividad (predeterminado)</option>
                <option value="fecha_ultima_desc">Última actualización — más reciente</option>
                <option value="fecha_ultima_asc">Última actualización — más antigua</option>
                <option value="fecha_corriente_desc">Fecha corriente — más reciente</option>
                <option value="fecha_corriente_asc">Fecha corriente — más antigua</option>
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
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-warning">{error}</div> : null}

      <div className="card">
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>ID</th>
                <th>Serie/Folio</th>
                <th>Fecha nota</th>
                <th>Cliente</th>
                <th>Empresa</th>
                <th>Ruta</th>
                <th>Estado</th>
                <th>Atención</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-4">
                    Cargando...
                  </td>
                </tr>
              ) : data.items?.length ? (
                data.items.map((n) => (
                  <tr key={n.id}>
                    <td>{n.id}</td>
                    <td>{n.serie_folio || '—'}</td>
                    <td className="text-nowrap small">{formatFechaNota(n.fecha_nota)}</td>
                    <td>{n.cliente || '—'}</td>
                    <td>{n.empresa || '—'}</td>
                    <td>{n.ruta_codigo || '—'}</td>
                    <td>
                      <span className={`badge ${estadoBadgeClass(n.estado)}`}>{n.estado || '—'}</span>
                    </td>
                    <td>{n.requiere_atencion ? 'Sí' : 'No'}</td>
                    <td>
                      <Link className="btn btn-sm btn-outline-primary" to={`/seguimiento/nota/${n.id}`}>
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="text-center py-4">
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
