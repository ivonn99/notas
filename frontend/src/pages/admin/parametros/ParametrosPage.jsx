import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../../constants/routes.js'
import { adminApi } from '../../../services/adminApi.js'

function ParametroCardMovil({ p }) {
  return (
    <div className="card border shadow-sm">
      <div className="card-body py-3">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <div className="min-w-0">
            <div className="fw-semibold text-break">{p.clave}</div>
            <div className="small text-body-secondary">ID {p.id}</div>
          </div>
          <Link className="btn btn-sm btn-outline-primary flex-shrink-0" to={ROUTES.editarParametro(p.id)}>
            Editar
          </Link>
        </div>
        <div className="small mb-2">
          <span className="text-body-secondary">Valor: </span>
          <span className="text-break">{p.valor}</span>
        </div>
        <div className="small text-body-secondary">{p.descripcion || '—'}</div>
      </div>
    </div>
  )
}

export default function ParametrosPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const r = await adminApi.listParametros()
        setItems(r.items || [])
      } catch (e) {
        setError(e?.message || 'No se pudo cargar parámetros')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-3">Parámetros</h1>
      {error ? <div className="alert alert-warning">{error}</div> : null}
      <div className="card">
        <div className="d-none d-md-block table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>ID</th>
                <th>Clave</th>
                <th>Valor</th>
                <th>Descripción</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-4">
                    Cargando...
                  </td>
                </tr>
              ) : items.length ? (
                items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.clave}</td>
                    <td>{p.valor}</td>
                    <td>{p.descripcion || '—'}</td>
                    <td>
                      <Link
                        className="btn btn-sm btn-outline-primary"
                        to={ROUTES.editarParametro(p.id)}
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center py-4">
                    Sin datos
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
              {items.map((p) => (
                <ParametroCardMovil key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <p className="text-center text-body-secondary py-4 mb-0">Sin datos</p>
          )}
        </div>
      </div>
    </section>
  )
}
