import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import { alertasApi } from '../../services/alertasApi.js'

function AlertaCardMovil({ a, onMarcarLeida }) {
  return (
    <div className="card border shadow-sm">
      <div className="card-body py-3">
        <div className="d-flex justify-content-between gap-2 mb-2">
          <span className="small text-body-secondary">ID {a.id}</span>
          <span className="small">{a.leida ? 'Leída' : 'Pendiente'}</span>
        </div>
        <div className="fw-medium mb-1">{a.tipo || '—'}</div>
        <div className="small mb-2">{a.descripcion || '—'}</div>
        <dl className="row small mb-3 gx-2">
          <dt className="col-5 text-body-secondary">Nota</dt>
          <dd className="col-7 mb-1">{a.nota_id || '—'}</dd>
          <dt className="col-5 text-body-secondary">Estado nota</dt>
          <dd className="col-7 mb-0">{a.estado || '—'}</dd>
        </dl>
        <div className="d-flex flex-wrap gap-2">
          {a.nota_id ? (
            <Link className="btn btn-sm btn-outline-primary" to={ROUTES.detalleNota(a.nota_id)}>
              Ver nota
            </Link>
          ) : null}
          {!a.leida ? (
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => onMarcarLeida(a.id)}
              type="button"
            >
              Marcar leída
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function AlertasPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const r = await alertasApi.list()
      setItems(r.items || [])
    } catch (e) {
      setError(e?.message || 'No se pudo cargar alertas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function marcarLeida(id) {
    try {
      await alertasApi.marcarLeida(id)
      await load()
    } catch (e) {
      setError(e?.message || 'No se pudo marcar alerta')
    }
  }

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-3">Alertas</h1>
      {error ? <div className="alert alert-warning">{error}</div> : null}

      <div className="card">
        <div className="d-none d-md-block table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>ID</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Nota</th>
                <th>Estado nota</th>
                <th>Leída</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-4">
                    Cargando...
                  </td>
                </tr>
              ) : items.length ? (
                items.map((a) => (
                  <tr key={a.id}>
                    <td>{a.id}</td>
                    <td>{a.tipo || '—'}</td>
                    <td>{a.descripcion || '—'}</td>
                    <td>{a.nota_id || '—'}</td>
                    <td>{a.estado || '—'}</td>
                    <td>{a.leida ? 'Sí' : 'No'}</td>
                    <td className="d-flex gap-2">
                      {a.nota_id ? (
                        <Link
                          className="btn btn-sm btn-outline-primary"
                          to={ROUTES.detalleNota(a.nota_id)}
                        >
                          Ver nota
                        </Link>
                      ) : null}
                      {!a.leida ? (
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => marcarLeida(a.id)}
                          type="button"
                        >
                          Marcar leída
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-4">
                    Sin alertas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="d-md-none p-2 p-sm-3">
          {loading ? (
            <p className="text-center text-body-secondary py-4 mb-0">Cargando...</p>
          ) : items.length ? (
            <div className="d-flex flex-column gap-2">
              {items.map((a) => (
                <AlertaCardMovil key={a.id} a={a} onMarcarLeida={marcarLeida} />
              ))}
            </div>
          ) : (
            <p className="text-center text-body-secondary py-4 mb-0">Sin alertas</p>
          )}
        </div>
      </div>
    </section>
  )
}
