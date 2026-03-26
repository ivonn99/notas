import { useEffect, useState } from 'react'
import { profileApi } from '../../services/profileApi.js'

export default function PerfilPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [data, setData] = useState(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPass, setSavingPass] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const r = await profileApi.getMe()
      setData(r)
    } catch (e) {
      setError(e?.message || 'No se pudo cargar perfil')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function onChangePassword(e) {
    e.preventDefault()
    setError('')
    setOk('')
    if (newPassword.length < 4) {
      setError('La nueva contraseña debe tener al menos 4 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('La nueva contraseña y la confirmación no coinciden.')
      return
    }
    setSavingPass(true)
    try {
      await profileApi.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setOk('Contraseña actualizada')
    } catch (e2) {
      setError(e2?.message || 'No se pudo cambiar contraseña')
    } finally {
      setSavingPass(false)
    }
  }

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-3">Mi perfil</h1>
      {error ? <div className="alert alert-warning">{error}</div> : null}
      {ok ? <div className="alert alert-success">{ok}</div> : null}

      {loading ? (
        <div className="card">
          <div className="card-body">Cargando...</div>
        </div>
      ) : (
        <>
          <div className="card mb-3">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <small className="text-body-secondary d-block">Usuario</small>
                  <strong>{data?.user?.username || '—'}</strong>
                </div>
                <div className="col-md-4">
                  <small className="text-body-secondary d-block">Nombre</small>
                  <strong>{data?.user?.nombre_completo || '—'}</strong>
                </div>
                <div className="col-md-4">
                  <small className="text-body-secondary d-block">Rol</small>
                  <strong>{data?.user?.rol || '—'}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header">Rutas asignadas</div>
            <div className="card-body">
              {data?.rutas?.length ? (
                <ul className="mb-0">
                  {data.rutas.map((r) => (
                    <li key={r.id}>
                      {r.codigo} — {r.nombre}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-body-secondary">Sin rutas asignadas</span>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">Cambio de contraseña</div>
            <div className="card-body">
              <p className="text-body-secondary small mb-3">
                Debes escribir tu contraseña actual. La nueva debe tener al menos 4 caracteres.
              </p>
              <form onSubmit={onChangePassword} className="row g-3">
                <div className="col-md-12 col-lg-4">
                  <label className="form-label">Contraseña actual</label>
                  <input
                    type="password"
                    className="form-control"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="col-md-6 col-lg-4">
                  <label className="form-label">Nueva contraseña</label>
                  <input
                    type="password"
                    className="form-control"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={4}
                  />
                </div>
                <div className="col-md-6 col-lg-4">
                  <label className="form-label">Confirmar nueva contraseña</label>
                  <input
                    type="password"
                    className="form-control"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={4}
                  />
                </div>
                <div className="col-12">
                  <button className="btn btn-primary" type="submit" disabled={savingPass}>
                    {savingPass ? 'Guardando…' : 'Cambiar contraseña'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
