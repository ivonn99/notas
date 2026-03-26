import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../../constants/routes.js'
import { adminApi } from '../../../services/adminApi.js'

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
        <div className="table-responsive">
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
      </div>
    </section>
  )
}
