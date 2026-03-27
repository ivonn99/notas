import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { useNotificationsStore } from '../../stores/notificationsStore.js'

export default function NotificacionesPage({ initialTab = 'notificaciones' }) {
  const { user } = useAuth()
  const canCredito = user?.isSuperuser || ['ADMIN', 'CREDITO'].includes(user?.rol)
  const items = useNotificationsStore((s) => s.items)
  const alertas = useNotificationsStore((s) => s.alertas)
  const loading = useNotificationsStore((s) => s.loadingItems)
  const loadingAlertas = useNotificationsStore((s) => s.loadingAlertas)
  const storeError = useNotificationsStore((s) => s.lastError)
  const loadItems = useNotificationsStore((s) => s.loadItems)
  const loadAlertas = useNotificationsStore((s) => s.loadAlertas)
  const marcarNotificacionLeida = useNotificationsStore((s) => s.marcarNotificacionLeida)
  const marcarTodasNotificaciones = useNotificationsStore((s) => s.marcarTodasNotificaciones)
  const marcarAlertaLeidaStore = useNotificationsStore((s) => s.marcarAlertaLeida)
  const [tab, setTab] = useState(
    initialTab === 'alertas' && canCredito ? 'alertas' : 'notificaciones',
  )
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    void loadItems()
    void loadAlertas(canCredito)
  }, [canCredito, loadItems, loadAlertas])

  const error = localError || storeError

  async function marcar(item) {
    try {
      setLocalError('')
      await marcarNotificacionLeida(item)
    } catch (e) {
      setLocalError(e?.message || 'No se pudo marcar notificación')
    }
  }

  async function marcarTodas() {
    try {
      setLocalError('')
      await marcarTodasNotificaciones()
    } catch (e) {
      setLocalError(e?.message || 'No se pudo marcar todas')
    }
  }

  async function marcarAlertaLeida(id) {
    try {
      setLocalError('')
      await marcarAlertaLeidaStore(id, canCredito)
    } catch (e) {
      setLocalError(e?.message || 'No se pudo marcar alerta')
    }
  }

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-3">Mensajes y alertas</h1>
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${tab === 'notificaciones' ? ' active' : ''}`}
            onClick={() => setTab('notificaciones')}
          >
            Notificaciones
          </button>
        </li>
        {canCredito ? (
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link${tab === 'alertas' ? ' active' : ''}`}
              onClick={() => setTab('alertas')}
            >
              Alertas
            </button>
          </li>
        ) : null}
      </ul>
      {tab === 'notificaciones' ? (
        <button type="button" className="btn btn-outline-secondary btn-sm mb-3" onClick={marcarTodas}>
          Marcar todas como leídas
        </button>
      ) : null}
      {error ? <div className="alert alert-warning">{error}</div> : null}
      <div className="card">
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            {tab === 'notificaciones' ? (
              <>
                <thead className="table-light">
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Mensaje</th>
                    <th>Nota</th>
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
                    items.map((n) => (
                      <tr key={`${n.tipo}-${n.id}`}>
                        <td>{n.created_at ? new Date(n.created_at).toLocaleString() : '—'}</td>
                        <td>{n.tipo}</td>
                        <td>{n.titulo || '—'}</td>
                        <td>{n.nota_id ? n.serie_folio || `#${n.nota_id}` : '—'}</td>
                        <td className="d-flex gap-2">
                          {n.nota_id ? (
                            <Link className="btn btn-sm btn-outline-primary" to={ROUTES.detalleNota(n.nota_id)}>
                              Ver nota
                            </Link>
                          ) : null}
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => marcar(n)} type="button">
                            Marcar leída
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center py-4">
                        Sin notificaciones
                      </td>
                    </tr>
                  )}
                </tbody>
              </>
            ) : (
              <>
                <thead className="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Nota</th>
                    <th>Estado nota</th>
                    <th>Leída</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAlertas ? (
                    <tr>
                      <td colSpan="7" className="text-center py-4">
                        Cargando...
                      </td>
                    </tr>
                  ) : alertas.length ? (
                    alertas.map((a) => (
                      <tr key={a.id}>
                        <td>{a.id}</td>
                        <td>{a.tipo || '—'}</td>
                        <td>{a.descripcion || '—'}</td>
                        <td>{a.nota_id || '—'}</td>
                        <td>{a.estado || '—'}</td>
                        <td>{a.leida ? 'Sí' : 'No'}</td>
                        <td className="d-flex gap-2">
                          {a.nota_id ? (
                            <Link className="btn btn-sm btn-outline-primary" to={ROUTES.detalleNota(a.nota_id)}>
                              Ver nota
                            </Link>
                          ) : null}
                          {!a.leida ? (
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => marcarAlertaLeida(a.id)}
                              type="button"
                            >
                              Marcar leída
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center py-4">
                        Sin alertas
                      </td>
                    </tr>
                  )}
                </tbody>
              </>
            )}
          </table>
        </div>
      </div>
    </section>
  )
}
