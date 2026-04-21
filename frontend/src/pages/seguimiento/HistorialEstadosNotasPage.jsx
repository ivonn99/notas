import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import { fetchHistorialEstadosNotas } from '../../services/seguimientoApi.js'

function formatFechaHora(value) {
  const s = String(value ?? '').trim()
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)
}

export default function HistorialEstadosNotasPage() {
  const [modo, setModo] = useState('pendiente_resuelta')
  const [limit, setLimit] = useState(150)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetchHistorialEstadosNotas({ modo, limit })
      setItems(r.items || [])
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el historial')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [modo, limit])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-2">Historial de estados de notas</h1>
      <p className="text-body-secondary small mb-3">
        Últimos registros cuando una nota pasa de <strong>PENDIENTE</strong> a <strong>RESUELTA</strong>{' '}
        (también puedes ver todos los cambios de estado registrados en el sistema).
      </p>

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-5">
              <label className="form-label mb-1">Qué mostrar</label>
              <select
                className="form-select"
                value={modo}
                onChange={(e) => setModo(e.target.value)}
              >
                <option value="pendiente_resuelta">Solo PENDIENTE → RESUELTA</option>
                <option value="todos">Todos los cambios de estado</option>
              </select>
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label mb-1">Cantidad máxima</label>
              <select
                className="form-select"
                value={String(limit)}
                onChange={(e) => setLimit(Number.parseInt(e.target.value, 10) || 150)}
              >
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="150">150</option>
                <option value="300">300</option>
                <option value="500">500</option>
              </select>
            </div>
            <div className="col-12 col-md-4 d-flex gap-2">
              <button type="button" className="btn btn-outline-secondary" disabled={loading} onClick={() => void cargar()}>
                {loading ? 'Cargando…' : 'Actualizar'}
              </button>
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
                <th>Fecha y hora</th>
                <th>Nota</th>
                <th>Serie/Folio</th>
                <th>Cliente</th>
                <th>Empresa</th>
                <th>De</th>
                <th>A</th>
                <th>Usuario</th>
                <th>Observación</th>
                <th className="text-end">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" className="text-center py-4">
                    Cargando…
                  </td>
                </tr>
              ) : items.length ? (
                items.map((row) => (
                  <tr key={row.id}>
                    <td className="text-nowrap small">{formatFechaHora(row.created_at)}</td>
                    <td>{row.nota_id}</td>
                    <td>{row.serie_folio || '—'}</td>
                    <td className="small">{row.cliente || '—'}</td>
                    <td className="small">{row.empresa || '—'}</td>
                    <td>
                      <span className="badge text-bg-secondary">{row.valor_anterior || '—'}</span>
                    </td>
                    <td>
                      <span className="badge text-bg-success">{row.valor_nuevo || '—'}</span>
                    </td>
                    <td className="small">
                      {row.usuario_nombre || row.usuario_username || '—'}
                    </td>
                    <td className="small text-break">{row.observacion || '—'}</td>
                    <td className="text-end">
                      <Link
                        className="btn btn-sm btn-outline-primary"
                        to={ROUTES.detalleNota(String(row.nota_id))}
                      >
                        Ver nota
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="text-center py-4 text-body-secondary">
                    Sin registros
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card-footer small text-body-secondary">
          Mostrando {items.length} registro{items.length === 1 ? '' : 's'}
          {modo === 'pendiente_resuelta' ? ' (PENDIENTE → RESUELTA)' : ' (todos los estados)'}
        </div>
      </div>
    </section>
  )
}
