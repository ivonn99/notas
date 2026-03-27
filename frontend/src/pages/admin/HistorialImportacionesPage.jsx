import { useEffect, useState } from 'react'
import { importacionesApi } from '../../services/importacionesApi.js'
import { useImportJobStore } from '../../stores/importJobStore.js'

function estadoBadgeClass(estado) {
  const s = String(estado ?? '').toUpperCase()
  if (s === 'COMPLETADA') return 'text-bg-success'
  if (s === 'PARCIAL') return 'text-bg-warning'
  if (s === 'FALLIDA') return 'text-bg-danger'
  if (s === 'EN_PROCESO') return 'text-bg-info'
  return 'text-bg-secondary'
}

function progresoPct(i) {
  const total = Number(i?.total_registros ?? 0)
  const done =
    Number(i?.registros_nuevos ?? 0) + Number(i?.registros_actualizados ?? 0)
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)))
}

export default function HistorialImportacionesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [selectedObs, setSelectedObs] = useState(null)
  const importStatus = useImportJobStore((s) => s.status)
  const currentImportacionId = useImportJobStore((s) => s.currentImportacionId)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const r = await importacionesApi.list()
        setItems(r.items || [])
      } catch (e) {
        setError(e?.message || 'No se pudo cargar historial')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!importStatus || ['COMPLETADA', 'PARCIAL', 'FALLIDA'].includes(String(importStatus).toUpperCase())) {
      return
    }
    let cancel = false
    const tick = async () => {
      try {
        const r = await importacionesApi.list()
        if (!cancel) setItems(r.items || [])
      } catch {
        // ignore intermittent refresh errors
      }
    }
    const timer = setInterval(() => {
      void tick()
    }, 3000)
    void tick()
    return () => {
      cancel = true
      clearInterval(timer)
    }
  }, [importStatus])

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-3">Historial de importaciones</h1>
      {importStatus && ['EN_PROCESO'].includes(String(importStatus).toUpperCase()) ? (
        <div className="alert alert-info py-2">
          Importación en proceso
          {currentImportacionId ? ` (#${currentImportacionId})` : ''}. Esta tabla se actualiza automáticamente.
        </div>
      ) : null}
      {error ? <div className="alert alert-warning">{error}</div> : null}
      <div className="card">
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>ID</th>
                <th>Fecha</th>
                <th>Archivo</th>
                <th>Empresa(s)</th>
                <th>Estado</th>
                <th>Progreso</th>
                <th>Total</th>
                <th>Nuevos</th>
                <th>Actualizados</th>
                <th>Resueltos</th>
                <th>Observaciones</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="12" className="text-center py-4">
                    Cargando...
                  </td>
                </tr>
              ) : items.length ? (
                items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.id}</td>
                    <td>{i.created_at ? new Date(i.created_at).toLocaleString() : '—'}</td>
                    <td>{i.nombre_archivo || '—'}</td>
                    <td>
                      {Array.isArray(i.empresas_importadas) && i.empresas_importadas.length > 0 ? (
                        i.empresas_importadas.join(', ')
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className={`badge ${estadoBadgeClass(i.estado)}`}>
                        {i.estado || '—'}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2" style={{ minWidth: '160px' }}>
                        <div className="progress flex-grow-1" style={{ height: '0.5rem' }}>
                          <div
                            className="progress-bar"
                            style={{ width: `${progresoPct(i)}%` }}
                          />
                        </div>
                        <small className="text-body-secondary">{progresoPct(i)}%</small>
                      </div>
                    </td>
                    <td>{i.total_registros ?? 0}</td>
                    <td>{i.registros_nuevos ?? 0}</td>
                    <td>{i.registros_actualizados ?? 0}</td>
                    <td>{i.registros_resueltos ?? 0}</td>
                    <td className="small text-body-secondary">{i.observaciones || '—'}</td>
                    <td>
                      {['PARCIAL', 'FALLIDA'].includes(String(i.estado || '').toUpperCase()) ? (
                        <div className="d-flex gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() =>
                              setSelectedObs({
                                id: i.id,
                                estado: i.estado,
                                observaciones: i.observaciones || '(sin observaciones)',
                              })
                            }
                          >
                            Ver errores
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={async () => {
                              try {
                                const txt = await importacionesApi.downloadErroresTxt(i.id)
                                const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = `errores_importacion_${i.id}.txt`
                                a.click()
                                URL.revokeObjectURL(url)
                              } catch (e) {
                                setError(e?.message || 'No se pudo descargar errores')
                              }
                            }}
                          >
                            Descargar
                          </button>
                        </div>
                      ) : (
                        <span className="text-body-secondary small">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="12" className="text-center py-4">
                    Sin importaciones
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedObs ? (
        <div
          className="modal d-block"
          tabIndex="-1"
          role="dialog"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setSelectedObs(null)}
        >
          <div
            className="modal-dialog modal-lg modal-dialog-scrollable"
            role="document"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Importación #{selectedObs.id} — {selectedObs.estado}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Cerrar"
                  onClick={() => setSelectedObs(null)}
                />
              </div>
              <div className="modal-body">
                <pre
                  className="mb-0 small"
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {selectedObs.observaciones}
                </pre>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedObs(null)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
