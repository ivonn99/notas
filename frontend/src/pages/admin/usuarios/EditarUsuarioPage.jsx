import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { adminApi } from '../../../services/adminApi.js'

export default function EditarUsuarioPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [form, setForm] = useState({
    username: '',
    nombre_completo: '',
    email: '',
    telefono: '',
    rol: 'VENDEDOR',
    activo: true,
    is_active: true,
  })

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const r = await adminApi.getUsuario(id)
        setForm({
          username: r.item.username || '',
          nombre_completo: r.item.nombre_completo || '',
          email: r.item.email || '',
          telefono: r.item.telefono || '',
          rol: r.item.rol || 'VENDEDOR',
          activo: Boolean(r.item.activo),
          is_active: Boolean(r.item.is_active),
        })
      } catch (e) {
        setError(e?.message || 'No se pudo cargar usuario')
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
      const r = await adminApi.updateUsuario(id, form)
      let msg = 'Usuario actualizado'
      if (r.authEmailSync?.message) {
        msg += `. ${r.authEmailSync.message}`
      }
      if (r.authMetadataSync?.error) {
        msg += `. No se pudo actualizar la sesión en Supabase Auth: ${r.authMetadataSync.error}`
      } else if (r.authMetadataSync?.message) {
        msg += `. ${r.authMetadataSync.message}`
      }
      setOk(msg)
    } catch (e2) {
      setError(e2?.message || 'No se pudo actualizar')
    }
  }

  return (
    <section className="container-fluid px-0">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h3 mb-0">Editar usuario #{id}</h1>
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
            <form onSubmit={onSubmit} className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Usuario (login)</label>
                <input
                  className="form-control"
                  autoComplete="username"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                />
                <div className="form-text">
                  Debe ser único. Si cambias el tuyo, puede que tengas que iniciar sesión de nuevo.
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Nombre completo</label>
                <input
                  className="form-control"
                  value={form.nombre_completo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nombre_completo: e.target.value }))
                  }
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Email</label>
                <input
                  className="form-control"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
                <div className="form-text">
                  Si cambias el correo y está configurada la función en Supabase, también se actualiza el
                  email de inicio de sesión (Auth).
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Teléfono</label>
                <input
                  className="form-control"
                  type="tel"
                  autoComplete="tel"
                  placeholder="Opcional"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Rol</label>
                <select
                  className="form-select"
                  value={form.rol}
                  onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}
                >
                  <option value="VENDEDOR">VENDEDOR</option>
                  <option value="CREDITO">CREDITO</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div className="col-md-4 d-flex align-items-end">
                <div className="form-check">
                  <input
                    id="activo"
                    className="form-check-input"
                    type="checkbox"
                    checked={form.activo}
                    onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                  />
                  <label htmlFor="activo" className="form-check-label">
                    activo
                  </label>
                </div>
              </div>
              <div className="col-md-4 d-flex align-items-end">
                <div className="form-check">
                  <input
                    id="isActive"
                    className="form-check-input"
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, is_active: e.target.checked }))
                    }
                  />
                  <label htmlFor="isActive" className="form-check-label">
                    is_active
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
