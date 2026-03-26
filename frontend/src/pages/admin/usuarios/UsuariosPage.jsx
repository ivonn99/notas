import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BsKeyFill,
  BsPencilSquare,
  BsPersonPlus,
  BsPersonX,
  BsSignpost2,
  BsTrash3,
} from 'react-icons/bs'
import Swal from 'sweetalert2'
import { ROUTES } from '../../../constants/routes.js'
import { useAuth } from '../../../contexts/AuthContext.jsx'
import { adminApi } from '../../../services/adminApi.js'

function IconButton({ as: Comp = 'button', children, label, className = '', ...props }) {
  return (
    <Comp
      type={Comp === 'button' ? 'button' : undefined}
      className={`btn btn-sm d-inline-flex align-items-center justify-content-center ${className}`}
      title={label}
      aria-label={label}
      {...props}
    >
      {children}
    </Comp>
  )
}

export default function UsuariosPage() {
  const { user: authUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [items, setItems] = useState([])
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    nombre_completo: '',
    email: '',
    telefono: '',
    rol: 'VENDEDOR',
  })

  async function load() {
    setLoading(true)
    setError('')
    try {
      const r = await adminApi.listUsuarios()
      setItems(r.items || [])
    } catch (e) {
      setError(e?.message || 'No se pudo cargar usuarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function crearUsuario(e) {
    e.preventDefault()
    setError('')
    setOk('')
    try {
      await adminApi.createUsuario(newUser)
      setOk('Usuario creado')
      setNewUser({
        username: '',
        password: '',
        nombre_completo: '',
        email: '',
        telefono: '',
        rol: 'VENDEDOR',
      })
      await load()
    } catch (e) {
      setError(e?.message || 'No se pudo crear usuario')
    }
  }

  async function resetPassword(usuarioId) {
    const result = await Swal.fire({
      title: 'Restablecer contraseña',
      text: `Usuario #${usuarioId}`,
      input: 'password',
      inputLabel: 'Nueva contraseña',
      inputPlaceholder: 'Escribe la nueva contraseña',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off',
      },
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      inputValidator: (value) => {
        if (!String(value || '').trim()) return 'La contraseña es obligatoria'
        return undefined
      },
    })
    if (!result.isConfirmed) return
    const pass = String(result.value || '').trim()
    if (!pass) return
    setError('')
    setOk('')
    try {
      await adminApi.resetUsuarioPassword(usuarioId, pass)
      setOk(`Contraseña restablecida para usuario #${usuarioId}`)
    } catch (e) {
      setError(e?.message || 'No se pudo restablecer contraseña')
    }
  }

  async function desactivar(usuarioId, username) {
    const r = await Swal.fire({
      title: '¿Desactivar usuario?',
      html: `El usuario <strong>${username || '#' + usuarioId}</strong> no podrá iniciar sesión. Los datos se conservan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      confirmButtonColor: '#fd7e14',
    })
    if (!r.isConfirmed) return
    setError('')
    setOk('')
    try {
      await adminApi.deleteUsuario(usuarioId)
      setOk(`Usuario #${usuarioId} desactivado`)
      await load()
    } catch (e) {
      setError(e?.message || 'No se pudo desactivar usuario')
    }
  }

  async function eliminarPermanente(usuarioId, username) {
    const r = await Swal.fire({
      title: 'Eliminar usuario permanentemente',
      html: `<p>Se borrará de la base de datos a <strong>${username || '#' + usuarioId}</strong>.</p>
        <p class="small text-body-secondary">Se eliminarán sus comentarios (aclaraciones), adjuntos en seguimiento e ítems de historial donde figure como autor. Las importaciones que inició pasarán a tu usuario.</p>
        <p class="mb-0 small text-danger">Las notas siguen existiendo; solo se quita la referencia al vendedor si la tenían. Esta acción no se puede deshacer.</p>`,
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      confirmButtonColor: '#dc3545',
    })
    if (!r.isConfirmed) return
    setError('')
    setOk('')
    try {
      await adminApi.eliminarUsuarioPermanente(usuarioId)
      setOk(`Usuario ${username || '#' + usuarioId} eliminado`)
      await load()
    } catch (e) {
      setError(e?.message || 'No se pudo eliminar el usuario')
    }
  }

  const myId = authUser?.id

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-3">Usuarios</h1>
      {error ? <div className="alert alert-warning">{error}</div> : null}
      {ok ? <div className="alert alert-success">{ok}</div> : null}
      <div className="card mb-3">
        <div className="card-header">Crear usuario</div>
        <div className="card-body">
          <form onSubmit={crearUsuario} className="row g-2">
            <div className="col-6 col-md-2">
              <input
                className="form-control"
                placeholder="username"
                value={newUser.username}
                onChange={(e) => setNewUser((s) => ({ ...s, username: e.target.value }))}
                required
              />
            </div>
            <div className="col-6 col-md-2">
              <input
                className="form-control"
                placeholder="password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser((s) => ({ ...s, password: e.target.value }))}
                required
              />
            </div>
            <div className="col-12 col-md-2">
              <input
                className="form-control"
                placeholder="nombre completo"
                value={newUser.nombre_completo}
                onChange={(e) =>
                  setNewUser((s) => ({ ...s, nombre_completo: e.target.value }))
                }
              />
            </div>
            <div className="col-12 col-md-2">
              <input
                className="form-control"
                placeholder="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser((s) => ({ ...s, email: e.target.value }))}
              />
            </div>
            <div className="col-12 col-md-2">
              <input
                className="form-control"
                placeholder="teléfono"
                type="tel"
                value={newUser.telefono}
                onChange={(e) => setNewUser((s) => ({ ...s, telefono: e.target.value }))}
              />
            </div>
            <div className="col-6 col-md-1">
              <select
                className="form-select"
                value={newUser.rol}
                onChange={(e) => setNewUser((s) => ({ ...s, rol: e.target.value }))}
              >
                <option value="VENDEDOR">VENDEDOR</option>
                <option value="CREDITO">CREDITO</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <div className="col-6 col-md-1 d-grid">
              <button
                className="btn btn-primary d-inline-flex align-items-center justify-content-center gap-1"
                type="submit"
                title="Crear usuario"
                aria-label="Crear usuario"
              >
                <BsPersonPlus className="fs-5" aria-hidden />
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="card">
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Rutas enlazadas</th>
                <th>Rol</th>
                <th>Activo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-4">
                    Cargando...
                  </td>
                </tr>
              ) : items.length ? (
                items.map((u) => {
                  const esMiUsuario = myId != null && Number(u.id) === Number(myId)
                  const superProtegido = u.is_superuser && !authUser?.isSuperuser
                  return (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.username}</td>
                      <td>{u.nombre_completo || '—'}</td>
                      <td className="text-nowrap">{u.telefono || '—'}</td>
                      <td>{u.rutas_enlazadas ?? 0}</td>
                      <td>{u.rol || '—'}</td>
                      <td>{u.activo && u.is_active ? 'Sí' : 'No'}</td>
                      <td>
                        <div className="d-flex flex-wrap align-items-center gap-1">
                          <IconButton
                            as={Link}
                            to={ROUTES.editarUsuario(u.id)}
                            label="Editar usuario"
                            className="btn-outline-primary"
                          >
                            <BsPencilSquare className="fs-5" aria-hidden />
                          </IconButton>
                          <IconButton
                            as={Link}
                            to={ROUTES.asignarRutas(u.id)}
                            label="Asignar rutas"
                            className="btn-outline-secondary"
                          >
                            <BsSignpost2 className="fs-5" aria-hidden />
                          </IconButton>
                          <IconButton
                            label="Restablecer contraseña"
                            className="btn-outline-warning"
                            onClick={() => resetPassword(u.id)}
                          >
                            <BsKeyFill className="fs-5" aria-hidden />
                          </IconButton>
                          {!esMiUsuario ? (
                            <IconButton
                              label="Desactivar usuario"
                              className="btn-outline-danger"
                              onClick={() => desactivar(u.id, u.username)}
                            >
                              <BsPersonX className="fs-5" aria-hidden />
                            </IconButton>
                          ) : null}
                          {!esMiUsuario && !superProtegido ? (
                            <IconButton
                              label="Eliminar usuario permanentemente"
                              className="btn-outline-danger"
                              onClick={() => eliminarPermanente(u.id, u.username)}
                            >
                              <BsTrash3 className="fs-5" aria-hidden />
                            </IconButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-4">
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
