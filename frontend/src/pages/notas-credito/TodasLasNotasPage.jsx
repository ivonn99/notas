import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import { fetchNotasCredito } from '../../services/notasApi.js'
import { estadoBadgeClass } from '../../utils/estadoBadge.js'

const PAGE_SIZE = 20

const SORT_OPTIONS = [
  { value: 'fecha_corriente_desc', label: 'Fecha corriente (recientes)' },
  { value: 'fecha_corriente_asc', label: 'Fecha corriente (antiguas)' },
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

export default function TodasLasNotasPage() {
  const [empresaActiva, setEmpresaActiva] = useState('DISTRIBUIDORA')
  const [filtros, setFiltros] = useState({
    estado: '',
    ruta: '',
    q: '',
  })
  const [dias, setDias] = useState('')
  const [sort, setSort] = useState('fecha_corriente_desc')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [refreshNonce, setRefreshNonce] = useState(0)

  const baseParams = useMemo(
    () => ({
      pageSize: PAGE_SIZE,
      empresa: empresaActiva,
      estado: filtros.estado,
      ruta: filtros.ruta,
      q: filtros.q,
      sort,
      ...(dias ? { dias } : {}),
    }),
    [empresaActiva, filtros.estado, filtros.ruta, filtros.q, sort, dias],
  )

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await fetchNotasCredito({ ...baseParams, page })
        if (cancel) return
        setTotal(data.total ?? 0)
        setTotalPages(data.totalPages ?? 1)
        if (page === 1) {
          setItems(data.items || [])
        } else {
          setItems((prev) => {
            const seen = new Set(prev.map((x) => x.id))
            const added = (data.items || []).filter((x) => !seen.has(x.id))
            return [...prev, ...added]
          })
        }
      } catch (e) {
        if (!cancel) setError(e?.message || 'No se pudo cargar notas')
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [baseParams, page, refreshNonce])

  function updateFiltro(name, value) {
    setPage(1)
    setFiltros((prev) => ({ ...prev, [name]: value }))
  }

  function updateDias(value) {
    setPage(1)
    setDias(value)
  }

  function updateSort(value) {
    setPage(1)
    setSort(value)
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
            <div className="col-12 col-md-3 col-lg-2">
              <label className="form-label mb-1">Últimos días</label>
              <select
                className="form-select"
                value={dias}
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
                value={sort}
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
                value={filtros.estado}
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
                value={filtros.ruta}
                onChange={(e) => updateFiltro('ruta', e.target.value)}
                placeholder="Ej: R01"
              />
            </div>
            <div className="col-12 col-md-3 col-lg-2">
              <label className="form-label mb-1">Buscar</label>
              <input
                className="form-control"
                value={filtros.q}
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
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>ID</th>
                <th>Serie/Folio</th>
                <th>Cliente</th>
                <th>Empresa</th>
                <th>Ruta</th>
                <th>Fecha nota</th>
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
                  <td colSpan="12" className="text-center py-4">
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
                    <td className="text-end">{money(n.monto)}</td>
                    <td className="text-end">{money(n.abono)}</td>
                    <td className="text-end">{money(n.saldo)}</td>
                    <td>
                      <span className={`badge ${estadoBadgeClass(n.estado)}`}>{n.estado || '—'}</span>
                      {n.requiere_atencion ? (
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
                  <td colSpan="12" className="text-center py-4">
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
