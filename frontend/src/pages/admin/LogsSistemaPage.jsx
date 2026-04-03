import { useEffect, useState } from 'react'
import { auditoriaApi } from '../../services/auditoriaApi.js'
import { logsApi } from '../../services/logsApi.js'

function toIsoOrEmpty(datetimeLocal) {
  const s = String(datetimeLocal ?? '').trim()
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}

function buildQueryParams(f) {
  return {
    accion: f.accion.trim(),
    usuario: f.usuario.trim(),
    q: f.q.trim(),
    desde: toIsoOrEmpty(f.desde),
    hasta: toIsoOrEmpty(f.hasta),
  }
}

function AuditoriaCardMovil({ i }) {
  return (
    <div className="card border shadow-sm">
      <div className="card-body py-3">
        <div className="small text-body-secondary mb-2">
          {i.created_at ? new Date(i.created_at).toLocaleString() : '—'}
        </div>
        <dl className="row small mb-0 gx-2">
          <dt className="col-4 text-body-secondary">Usuario</dt>
          <dd className="col-8 mb-2 text-break">{i.username || i.usuario_id || '—'}</dd>
          <dt className="col-4 text-body-secondary">Acción</dt>
          <dd className="col-8 mb-2">
            <code className="small">{i.accion || '—'}</code>
          </dd>
          <dt className="col-4 text-body-secondary">Entidad</dt>
          <dd className="col-8 mb-2 text-break">
            {i.entidad || '—'}
            {i.entidad_id ? ` #${i.entidad_id}` : ''}
          </dd>
          <dt className="col-12 text-body-secondary mb-1">Detalle</dt>
          <dd className="col-12 mb-0 text-break small">{i.detalle ? JSON.stringify(i.detalle) : '—'}</dd>
        </dl>
      </div>
    </div>
  )
}

function LogImportacionCardMovil({ i }) {
  return (
    <div className="card border shadow-sm">
      <div className="card-body py-3">
        <div className="small text-body-secondary mb-2">
          {i.created_at ? new Date(i.created_at).toLocaleString() : '—'}
        </div>
        <dl className="row small mb-0 gx-2">
          <dt className="col-4 text-body-secondary">Usuario</dt>
          <dd className="col-8 mb-2">{i.usuario_username || '—'}</dd>
          <dt className="col-4 text-body-secondary">Estado</dt>
          <dd className="col-8 mb-2">{i.estado || '—'}</dd>
          <dt className="col-4 text-body-secondary">Archivo</dt>
          <dd className="col-8 mb-2 text-break">{i.nombre_archivo || '—'}</dd>
          <dt className="col-12 text-body-secondary mb-1">Observaciones</dt>
          <dd className="col-12 mb-0 text-break">{i.observaciones || '—'}</dd>
        </dl>
      </div>
    </div>
  )
}

export default function LogsSistemaPage() {
  const [tab, setTab] = useState('auditoria')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [filtros, setFiltros] = useState({
    accion: '',
    usuario: '',
    q: '',
    desde: '',
    hasta: '',
  })

  const [impLoading, setImpLoading] = useState(false)
  const [impError, setImpError] = useState('')
  const [impItems, setImpItems] = useState([])

  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState('')
  const [fileData, setFileData] = useState(null)

  async function loadAuditoria(params = buildQueryParams(filtros)) {
    setLoading(true)
    setError('')
    try {
      const r = await auditoriaApi.list(params)
      setItems(r.items || [])
    } catch (e) {
      setError(e?.message || 'No se pudo cargar auditoría')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'auditoria') loadAuditoria()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    if (tab !== 'importaciones') return
    let cancel = false
    ;(async () => {
      setImpLoading(true)
      setImpError('')
      try {
        const r = await logsApi.importaciones()
        if (!cancel) setImpItems(r.items || [])
      } catch (e) {
        if (!cancel) setImpError(e?.message || 'No se pudo cargar importaciones')
      } finally {
        if (!cancel) setImpLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [tab])

  useEffect(() => {
    if (tab !== 'archivo') return
    let cancel = false
    ;(async () => {
      setFileLoading(true)
      setFileError('')
      try {
        const r = await logsApi.archivo(300)
        if (!cancel) setFileData(r)
      } catch (e) {
        if (!cancel) setFileError(e?.message || 'No se pudo leer el archivo de log')
      } finally {
        if (!cancel) setFileLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [tab])

  function onBuscar(e) {
    e.preventDefault()
    loadAuditoria(buildQueryParams(filtros))
  }

  function onLimpiar() {
    const empty = { accion: '', usuario: '', q: '', desde: '', hasta: '' }
    setFiltros(empty)
    loadAuditoria(buildQueryParams(empty))
  }

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-3">Logs del sistema</h1>
      <p className="text-body-secondary mb-3">
        Como en la guía Django: <strong>auditoría</strong> en base de datos, <strong>importaciones</strong>{' '}
        como registro operativo y <strong>archivo</strong> <code>api/logs/app.log</code> (equivalente a
        leer <code>django.log</code>).
      </p>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${tab === 'auditoria' ? 'active' : ''}`}
            onClick={() => setTab('auditoria')}
          >
            Auditoría
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${tab === 'importaciones' ? 'active' : ''}`}
            onClick={() => setTab('importaciones')}
          >
            Importaciones
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${tab === 'archivo' ? 'active' : ''}`}
            onClick={() => setTab('archivo')}
          >
            Archivo app.log
          </button>
        </li>
      </ul>

      {tab === 'auditoria' ? (
        <>
          <form className="card card-body mb-3" onSubmit={onBuscar}>
            <div className="row g-2">
              <div className="col-md-3">
                <input
                  className="form-control"
                  placeholder="Acción (ej. auth.login.ok)"
                  value={filtros.accion}
                  onChange={(e) => setFiltros((p) => ({ ...p, accion: e.target.value }))}
                />
              </div>
              <div className="col-md-3">
                <input
                  className="form-control"
                  placeholder="Usuario"
                  value={filtros.usuario}
                  onChange={(e) => setFiltros((p) => ({ ...p, usuario: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <input
                  className="form-control"
                  placeholder="Texto libre (entidad/detalle)"
                  value={filtros.q}
                  onChange={(e) => setFiltros((p) => ({ ...p, q: e.target.value }))}
                />
              </div>
              <div className="col-md-2 d-flex gap-2">
                <button className="btn btn-primary w-100" type="submit">
                  Buscar
                </button>
                <button className="btn btn-outline-secondary" type="button" onClick={onLimpiar}>
                  Limpiar
                </button>
              </div>
            </div>
            <div className="row g-2 mt-1">
              <div className="col-md-4 col-lg-3">
                <label className="form-label small mb-0 text-body-secondary" htmlFor="log-desde">
                  Desde
                </label>
                <input
                  id="log-desde"
                  type="datetime-local"
                  className="form-control"
                  value={filtros.desde}
                  onChange={(e) => setFiltros((p) => ({ ...p, desde: e.target.value }))}
                />
              </div>
              <div className="col-md-4 col-lg-3">
                <label className="form-label small mb-0 text-body-secondary" htmlFor="log-hasta">
                  Hasta
                </label>
                <input
                  id="log-hasta"
                  type="datetime-local"
                  className="form-control"
                  value={filtros.hasta}
                  onChange={(e) => setFiltros((p) => ({ ...p, hasta: e.target.value }))}
                />
              </div>
            </div>
          </form>
          {error ? <div className="alert alert-warning">{error}</div> : null}
          <div className="card">
            <div className="d-none d-md-block table-responsive">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Acción</th>
                    <th>Entidad</th>
                    <th>Detalle</th>
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
                    items.map((i) => (
                      <tr key={i.id}>
                        <td>{i.created_at ? new Date(i.created_at).toLocaleString() : '—'}</td>
                        <td>{i.username || i.usuario_id || '—'}</td>
                        <td>
                          <code>{i.accion || '—'}</code>
                        </td>
                        <td>
                          {i.entidad || '—'}
                          {i.entidad_id ? ` #${i.entidad_id}` : ''}
                        </td>
                        <td className="text-break">{i.detalle ? JSON.stringify(i.detalle) : '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center py-4">
                        Sin registros
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
                  {items.map((i) => (
                    <AuditoriaCardMovil key={i.id} i={i} />
                  ))}
                </div>
              ) : (
                <p className="text-center text-body-secondary py-4 mb-0">Sin registros</p>
              )}
            </div>
          </div>
        </>
      ) : null}

      {tab === 'importaciones' ? (
        <>
          {impError ? <div className="alert alert-warning">{impError}</div> : null}
          <div className="card">
            <div className="d-none d-md-block table-responsive">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Estado</th>
                    <th>Archivo</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {impLoading ? (
                    <tr>
                      <td colSpan="5" className="text-center py-4">
                        Cargando...
                      </td>
                    </tr>
                  ) : impItems.length ? (
                    impItems.map((i) => (
                      <tr key={i.id}>
                        <td>{i.created_at ? new Date(i.created_at).toLocaleString() : '—'}</td>
                        <td>{i.usuario_username || '—'}</td>
                        <td>{i.estado || '—'}</td>
                        <td>{i.nombre_archivo || '—'}</td>
                        <td className="text-break small">{i.observaciones || '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center py-4">
                        Sin registros
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="d-md-none p-2 p-sm-3">
              {impLoading ? (
                <p className="text-center text-body-secondary py-4 mb-0">Cargando...</p>
              ) : impItems.length ? (
                <div className="d-flex flex-column gap-2">
                  {impItems.map((i) => (
                    <LogImportacionCardMovil key={i.id} i={i} />
                  ))}
                </div>
              ) : (
                <p className="text-center text-body-secondary py-4 mb-0">Sin registros</p>
              )}
            </div>
          </div>
        </>
      ) : null}

      {tab === 'archivo' ? (
        <>
          {fileError ? <div className="alert alert-warning">{fileError}</div> : null}
          {fileData?.message ? (
            <div className="alert alert-info small mb-2">{fileData.message}</div>
          ) : null}
          {fileData?.path ? (
            <p className="small text-body-secondary mb-2">
              Ruta: <code>{fileData.path}</code>
              {fileData.lineCount != null ? ` · ${fileData.lineCount} líneas` : null}
            </p>
          ) : null}
          {fileLoading ? (
            <div className="spinner-border spinner-border-sm" role="status" />
          ) : (
            <pre
              className="card card-body small mb-0 text-break"
              style={{ maxHeight: '28rem', overflow: 'auto' }}
            >
              {(fileData?.lines || []).join('\n') || '—'}
            </pre>
          )}
        </>
      ) : null}
    </section>
  )
}
