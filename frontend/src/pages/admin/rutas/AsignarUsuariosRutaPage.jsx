import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminApi } from '../../../services/adminApi.js'

export default function AsignarUsuariosRutaPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [ruta, setRuta] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [selected, setSelected] = useState(new Set())

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const r = await adminApi.getRutaUsuarios(id)
        setRuta(r.ruta)
        setUsuarios(r.usuarios || [])
        setSelected(new Set((r.usuarios || []).filter((x) => x.asignado).map((x) => x.id)))
      } catch (e) {
        setError(e?.message || 'No se pudo cargar usuarios de la ruta')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  function toggleUsuario(usuarioId) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(usuarioId)) next.delete(usuarioId)
      else next.add(usuarioId)
      return next
    })
  }

  async function guardar() {
    setError('')
    setOk('')
    try {
      await adminApi.updateRutaUsuarios(id, Array.from(selected))
      setOk('Usuarios enlazados guardados')
    } catch (e) {
      setError(e?.message || 'No se pudo guardar usuarios enlazados')
    }
  }

  return (
    <section className="container-fluid px-0">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h3 mb-0">Enlazar usuarios — ruta #{id}</h1>
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
                Ruta:{' '}
                <strong>
                  {ruta?.codigo || id} — {ruta?.nombre || 'Sin nombre'}
                </strong>
              </p>
              <div className="row g-2">
                {usuarios.map((u) => (
                  <div className="col-12 col-md-6 col-lg-4" key={u.id}>
                    <label className="form-check border rounded p-2 d-flex gap-2 align-items-center">
                      <input
                        className="form-check-input mt-0"
                        type="checkbox"
                        checked={selected.has(u.id)}
                        onChange={() => toggleUsuario(u.id)}
                      />
                      <span>
                        <strong>{u.nombre_completo || u.username}</strong> — {u.username} ({u.rol})
                      </span>
                    </label>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <button type="button" className="btn btn-primary" onClick={guardar}>
                  Guardar usuarios enlazados
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
