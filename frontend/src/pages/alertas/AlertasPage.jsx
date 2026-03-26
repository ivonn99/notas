import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import { alertasApi } from '../../services/alertasApi.js'

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
        <div className="table-responsive">
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
      </div>
    </section>
  )
}
