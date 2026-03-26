import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { adminApi } from '../../../services/adminApi.js'

export default function EditarParametroPage() {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [form, setForm] = useState({ clave: '', valor: '', descripcion: '' })

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const r = await adminApi.getParametro(id)
        setForm({
          clave: r.item.clave || '',
          valor: r.item.valor || '',
          descripcion: r.item.descripcion || '',
        })
      } catch (e) {
        setError(e?.message || 'No se pudo cargar parámetro')
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
      await adminApi.updateParametro(id, {
        valor: form.valor,
        descripcion: form.descripcion,
      })
      setOk('Parámetro actualizado')
    } catch (e2) {
      setError(e2?.message || 'No se pudo actualizar')
    }
  }

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-3">Editar parámetro #{id}</h1>
      {error ? <div className="alert alert-warning">{error}</div> : null}
      {ok ? <div className="alert alert-success">{ok}</div> : null}
      <div className="card">
        <div className="card-body">
          {loading ? (
            'Cargando...'
          ) : (
            <form onSubmit={onSubmit} className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Clave</label>
                <input className="form-control" value={form.clave} disabled />
              </div>
              <div className="col-md-8">
                <label className="form-label">Valor</label>
                <input
                  className="form-control"
                  value={form.valor}
                  onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Descripción</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={form.descripcion}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, descripcion: e.target.value }))
                  }
                />
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
