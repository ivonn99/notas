import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { adminApi } from '../../../services/adminApi.js'

export default function AsignarRutasPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [user, setUser] = useState(null)
  const [rutas, setRutas] = useState([])
  const [selected, setSelected] = useState(new Set())

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const r = await adminApi.getUsuarioRutas(id)
        setUser(r.user)
        setRutas(r.rutas || [])
        setSelected(new Set((r.rutas || []).filter((x) => x.asignada).map((x) => x.id)))
      } catch (e) {
        setError(e?.message || 'No se pudo cargar rutas del usuario')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  function toggleRuta(rutaId) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(rutaId)) next.delete(rutaId)
      else next.add(rutaId)
      return next
    })
  }

  async function guardar() {
    setError('')
    setOk('')
    try {
      await adminApi.updateUsuarioRutas(id, Array.from(selected))
      setOk('Rutas guardadas')
    } catch (e) {
      setError(e?.message || 'No se pudo guardar rutas')
    }
  }

  return (
    <section className="container-fluid px-0">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h3 mb-0">Asignar rutas — usuario #{id}</h1>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => navigate(-1)}
          aria-label="Volver"
          title="Volver"
          style={{ whiteSpace: 'nowrap' }}
        >
          Volver
        </button>
      </div>
      {error ? <div className="alert alert-warning">{error}</div> : null}
      {ok ? <div className="alert alert-success">{ok}</div> : null}
      <div className="card">
        <div className="card-body">
          {loading ? (
            'Cargando...'
          ) : (
            <>
              <p className="text-body-secondary mb-3">
                Usuario: <strong>{user?.nombre_completo || user?.username || id}</strong>
              </p>
              <div className="row g-2">
                {rutas.map((r) => (
                  <div className="col-12 col-md-6 col-lg-4" key={r.id}>
                    <label className="form-check border rounded p-2 d-flex gap-2 align-items-center">
                      <input
                        className="form-check-input mt-0"
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleRuta(r.id)}
                      />
                      <span>
                        <strong>{r.codigo}</strong> — {r.nombre}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <button type="button" className="btn btn-primary" onClick={guardar}>
                  Guardar asignación
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
