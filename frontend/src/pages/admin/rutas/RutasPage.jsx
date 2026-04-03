import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BsPencilSquare, BsPeople, BsTrash3 } from 'react-icons/bs'
import Swal from 'sweetalert2'
import { ROUTES } from '../../../constants/routes.js'
import { adminApi } from '../../../services/adminApi.js'

function IconBtn({ as: Comp = 'button', children, label, className = '', ...props }) {
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

function RutaCardMovil({ r, eliminarRuta }) {
  return (
    <div className="card border shadow-sm">
      <div className="card-body py-3">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <div>
            <div className="fw-semibold">{r.codigo}</div>
            <div className="small text-body-secondary">ID {r.id}</div>
          </div>
          <span className="badge text-bg-secondary">{r.activa ? 'Activa' : 'Inactiva'}</span>
        </div>
        <div className="small mb-2">{r.nombre || '—'}</div>
        <div className="small text-body-secondary mb-3">Rutas enlazadas: {r.rutas_enlazadas ?? 0}</div>
        <div className="d-flex flex-wrap align-items-center gap-1">
          <IconBtn as={Link} to={ROUTES.editarRuta(r.id)} label="Editar ruta" className="btn-outline-primary">
            <BsPencilSquare className="fs-5" aria-hidden />
          </IconBtn>
          <IconBtn
            as={Link}
            to={ROUTES.asignarUsuariosRuta(r.id)}
            label="Enlazar usuarios"
            className="btn-outline-secondary"
          >
            <BsPeople className="fs-5" aria-hidden />
          </IconBtn>
          <IconBtn label="Eliminar ruta" className="btn-outline-danger" onClick={() => eliminarRuta(r)}>
            <BsTrash3 className="fs-5" aria-hidden />
          </IconBtn>
        </div>
      </div>
    </div>
  )
}

export default function RutasPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [items, setItems] = useState([])
  const [nueva, setNueva] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    activa: true,
  })

  async function load() {
    setLoading(true)
    setError('')
    try {
      const r = await adminApi.listRutas()
      setItems(r.items || [])
    } catch (e) {
      setError(e?.message || 'No se pudo cargar rutas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function crearRuta(e) {
    e.preventDefault()
    setOk('')
    setError('')
    try {
      await adminApi.createRuta({
        codigo: nueva.codigo.trim(),
        nombre: nueva.nombre.trim(),
        descripcion: nueva.descripcion.trim(),
        activa: nueva.activa,
      })
      setOk('Ruta creada.')
      setNueva({ codigo: '', nombre: '', descripcion: '', activa: true })
      await load()
    } catch (e2) {
      setError(e2?.message || 'No se pudo crear la ruta')
    }
  }

  async function eliminarRuta(ruta) {
    const confirm = await Swal.fire({
      title: '¿Eliminar ruta?',
      html: `<p>Se eliminará <strong>${ruta.codigo}</strong> — ${ruta.nombre || ''}</p>
        <p class="small text-body-secondary mb-0">Solo es posible si no hay notas de crédito con esta ruta. Las asignaciones a vendedores se quitarán.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      confirmButtonColor: '#dc3545',
    })
    if (!confirm.isConfirmed) return
    setError('')
    setOk('')
    try {
      await adminApi.deleteRuta(ruta.id)
      setOk(`Ruta ${ruta.codigo} eliminada`)
      await load()
    } catch (e) {
      setError(e?.message || 'No se pudo eliminar la ruta')
    }
  }

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-3">Rutas</h1>
      {error ? <div className="alert alert-warning">{error}</div> : null}
      {ok ? <div className="alert alert-success py-2">{ok}</div> : null}

      <div className="card mb-3">
        <div className="card-header">Nueva ruta</div>
        <div className="card-body">
          <form onSubmit={crearRuta} className="row g-2 align-items-end">
            <div className="col-12 col-md-2">
              <label className="form-label small mb-0">Código</label>
              <input
                className="form-control"
                value={nueva.codigo}
                onChange={(e) => setNueva((p) => ({ ...p, codigo: e.target.value }))}
                placeholder="R99"
                required
              />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label small mb-0">Nombre</label>
              <input
                className="form-control"
                value={nueva.nombre}
                onChange={(e) => setNueva((p) => ({ ...p, nombre: e.target.value }))}
                required
              />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label small mb-0">Descripción</label>
              <input
                className="form-control"
                value={nueva.descripcion}
                onChange={(e) => setNueva((p) => ({ ...p, descripcion: e.target.value }))}
              />
            </div>
            <div className="col-6 col-md-1">
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="ruta-activa"
                  checked={nueva.activa}
                  onChange={(e) => setNueva((p) => ({ ...p, activa: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="ruta-activa">
                  Activa
                </label>
              </div>
            </div>
            <div className="col-6 col-md-2">
              <button type="submit" className="btn btn-primary w-100">
                Crear
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="d-none d-md-block table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>ID</th>
                <th>Código</th>
                <th>Nombre</th>
                <th>Rutas enlazadas</th>
                <th>Activa</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-4">
                    Cargando...
                  </td>
                </tr>
              ) : items.length ? (
                items.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.codigo}</td>
                    <td>{r.nombre || '—'}</td>
                    <td>{r.rutas_enlazadas ?? 0}</td>
                    <td>{r.activa ? 'Sí' : 'No'}</td>
                    <td>
                      <div className="d-flex flex-wrap align-items-center gap-1">
                        <IconBtn
                          as={Link}
                          to={ROUTES.editarRuta(r.id)}
                          label="Editar ruta"
                          className="btn-outline-primary"
                        >
                          <BsPencilSquare className="fs-5" aria-hidden />
                        </IconBtn>
                        <IconBtn
                          as={Link}
                          to={ROUTES.asignarUsuariosRuta(r.id)}
                          label="Enlazar usuarios"
                          className="btn-outline-secondary"
                        >
                          <BsPeople className="fs-5" aria-hidden />
                        </IconBtn>
                        <IconBtn
                          label="Eliminar ruta"
                          className="btn-outline-danger"
                          onClick={() => eliminarRuta(r)}
                        >
                          <BsTrash3 className="fs-5" aria-hidden />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-4">
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
              {items.map((r) => (
                <RutaCardMovil key={r.id} r={r} eliminarRuta={eliminarRuta} />
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
