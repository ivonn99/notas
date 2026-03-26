import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { adminApi } from '../../../services/adminApi.js'

export default function EditarRutaPage() {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    activa: true,
  })

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const r = await adminApi.getRuta(id)
        setForm({
          codigo: r.item.codigo || '',
          nombre: r.item.nombre || '',
          descripcion: r.item.descripcion || '',
          activa: Boolean(r.item.activa),
        })
      } catch (e) {
        setError(e?.message || 'No se pudo cargar ruta')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setOk('')
    try {
      await adminApi.updateRuta(id, form)
      setOk('Ruta actualizada')
    } catch (e2) {
      setError(e2?.message || 'No se pudo actualizar')
    }
  }

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-3">Editar ruta #{id}</h1>
      {error ? <div className="alert alert-warning">{error}</div> : null}
      {ok ? <div className="alert alert-success">{ok}</div> : null}
      <div className="card">
        <div className="card-body">
          {loading ? (
            'Cargando...'
          ) : (
            <form onSubmit={onSubmit} className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Código</label>
                <input
                  className="form-control"
                  value={form.codigo}
                  onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                />
              </div>
              <div className="col-md-8">
                <label className="form-label">Nombre</label>
                <input
                  className="form-control"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Descripción</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <div className="form-check">
                  <input
                    id="activaRuta"
                    className="form-check-input"
                    type="checkbox"
                    checked={form.activa}
                    onChange={(e) => setForm((f) => ({ ...f, activa: e.target.checked }))}
                  />
                  <label htmlFor="activaRuta" className="form-check-label">
                    Activa
                  </label>
                </div>
              </div>
              <div className="col-12">
                <button className="btn btn-primary" type="submit">
                  Guardar cambios
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
