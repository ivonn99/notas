import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  fetchSeguimientoDetalle,
  postSeguimientoComentario,
  postSeguimientoDocumento,
  postSeguimientoEstado,
  postSeguimientoRuta,
} from '../../services/seguimientoApi.js'
import { useDomainSyncStore } from '../../stores/domainSyncStore.js'
import { estadoBadgeClass } from '../../utils/estadoBadge.js'

function money(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(n)
}

export default function DetalleNotaPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState(null)
  const [comentario, setComentario] = useState('')
  const [tipoComentario, setTipoComentario] = useState('COMENTARIO')
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [obsEstado, setObsEstado] = useState('')
  const [nuevaRutaId, setNuevaRutaId] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [sendingEstado, setSendingEstado] = useState(false)
  const [sendingRuta, setSendingRuta] = useState(false)
  const [docFile, setDocFile] = useState(null)
  const [sendingDoc, setSendingDoc] = useState(false)
  const emitNotaChanged = useDomainSyncStore((s) => s.emitNotaChanged)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const r = await fetchSeguimientoDetalle(id)
      setDetalle(r)
      setNuevoEstado(r?.nota?.estado || '')
      setNuevaRutaId(r?.nota?.ruta_id ? String(r.nota.ruta_id) : '')
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el detalle')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function onSubmitComentario(e) {
    e.preventDefault()
    if (!comentario.trim()) return
    setSendingComment(true)
    try {
      await postSeguimientoComentario(id, {
        comentario: comentario.trim(),
        tipo: tipoComentario,
      })
      emitNotaChanged()
      setComentario('')
      await load()
    } catch (e2) {
      setError(e2?.message || 'No se pudo guardar el comentario')
    } finally {
      setSendingComment(false)
    }
  }

  async function onSubmitEstado(e) {
    e.preventDefault()
    setSendingEstado(true)
    try {
      await postSeguimientoEstado(id, {
        estado: nuevoEstado,
        observacion: obsEstado.trim(),
      })
      emitNotaChanged()
      setObsEstado('')
      await load()
    } catch (e2) {
      setError(e2?.message || 'No se pudo cambiar estado')
    } finally {
      setSendingEstado(false)
    }
  }

  async function onSubmitRuta(e) {
    e.preventDefault()
    if (!nuevaRutaId) return
    setSendingRuta(true)
    try {
      await postSeguimientoRuta(id, nuevaRutaId)
      emitNotaChanged()
      await load()
    } catch (e2) {
      setError(e2?.message || 'No se pudo cambiar ruta')
    } finally {
      setSendingRuta(false)
    }
  }

  async function onSubmitDocumento(e) {
    e.preventDefault()
    if (!docFile) return
    setSendingDoc(true)
    try {
      await postSeguimientoDocumento(id, docFile)
      emitNotaChanged()
      setDocFile(null)
      await load()
    } catch (e2) {
      setError(e2?.message || 'No se pudo adjuntar documento')
    } finally {
      setSendingDoc(false)
    }
  }

  return (
    <section className="container-fluid px-0">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h3 mb-0">Detalle de nota #{id}</h1>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => navigate(-1)}
          aria-label="Volver a la lista"
          title="Volver"
          style={{ whiteSpace: 'nowrap' }}
        >
          Volver
        </button>
      </div>

      {error ? <div className="alert alert-warning">{error}</div> : null}

      {loading ? (
        <div className="card">
          <div className="card-body">Cargando...</div>
        </div>
      ) : !detalle?.nota ? (
        <div className="alert alert-secondary">Sin información</div>
      ) : (
        <>
          <div className="card mb-3">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-3">
                  <small className="text-body-secondary d-block">Serie/Folio</small>
                  <strong>{detalle.nota.serie_folio || '—'}</strong>
                </div>
                <div className="col-md-5">
                  <small className="text-body-secondary d-block">Cliente</small>
                  <strong>{detalle.nota.cliente || '—'}</strong>
                </div>
                <div className="col-md-2">
                  <small className="text-body-secondary d-block">Estado</small>
                  <span className={`badge ${estadoBadgeClass(detalle.nota.estado)}`}>
                    {detalle.nota.estado || '—'}
                  </span>
                </div>
                <div className="col-md-2">
                  <small className="text-body-secondary d-block">Ruta</small>
                  <strong>{detalle.nota.ruta_codigo || '—'}</strong>
                </div>
              </div>
              <div className="row g-3 mt-1">
                <div className="col-md-4">
                  <small className="text-body-secondary d-block">Monto</small>
                  <strong>{money(detalle.nota.monto)}</strong>
                </div>
                <div className="col-md-4">
                  <small className="text-body-secondary d-block">Abono</small>
                  <strong>{money(detalle.nota.abono)}</strong>
                </div>
                <div className="col-md-4">
                  <small className="text-body-secondary d-block">Saldo</small>
                  <strong className="text-primary">{money(detalle.nota.saldo)}</strong>
                </div>
              </div>
              <div className="row g-3 mt-1">
                <div className="col-md-4">
                  <small className="text-body-secondary d-block">Empresa</small>
                  <strong>{detalle.nota.empresa || '—'}</strong>
                </div>
                <div className="col-md-4">
                  <small className="text-body-secondary d-block">Vendedor asignado</small>
                  <strong>
                    {detalle.nota.vendedor_username ||
                      detalle.nota.usuario_vendedor_pv ||
                      '—'}
                  </strong>
                </div>
                <div className="col-md-4">
                  <small className="text-body-secondary d-block">Resolución automática</small>
                  {detalle.nota.resuelta_automaticamente ? (
                    <span className="badge text-bg-info">Sí (importación)</span>
                  ) : (
                    <span className="badge text-bg-secondary">No</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12 col-lg-7">
              <div className="card mb-3">
                <div className="card-header">Comentarios / aclaraciones</div>
                <div className="card-body">
                  <form onSubmit={onSubmitComentario} className="mb-3">
                    <div className="row g-2">
                      <div className="col-md-4">
                        <select
                          className="form-select"
                          value={tipoComentario}
                          onChange={(e) => setTipoComentario(e.target.value)}
                        >
                          <option value="COMENTARIO">COMENTARIO</option>
                          <option value="ACLARACION">ACLARACION</option>
                          <option value="SEGUIMIENTO">SEGUIMIENTO</option>
                        </select>
                      </div>
                      <div className="col-md-8">
                        <input
                          className="form-control"
                          placeholder="Escribe un comentario..."
                          value={comentario}
                          onChange={(e) => setComentario(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <button className="btn btn-primary btn-sm" disabled={sendingComment}>
                        {sendingComment ? 'Guardando...' : 'Agregar comentario'}
                      </button>
                    </div>
                  </form>

                  <div className="list-group">
                    {detalle.aclaraciones?.length ? (
                      detalle.aclaraciones.map((a) => (
                        <div key={a.id} className="list-group-item">
                          <div className="d-flex justify-content-between">
                            <strong>{a.tipo}</strong>
                            <small className="text-body-secondary">
                              {a.usuario_nombre || a.usuario_username || 'Usuario'}
                            </small>
                          </div>
                          <div>{a.comentario}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-body-secondary">Sin comentarios</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-5">
              <div className="card mb-3">
                <div className="card-header">Cambio de ruta</div>
                <div className="card-body">
                  {detalle.canManageRoute ? (
                    <form onSubmit={onSubmitRuta}>
                      <div className="mb-2">
                        <select
                          className="form-select"
                          value={nuevaRutaId}
                          onChange={(e) => setNuevaRutaId(e.target.value)}
                        >
                          <option value="">Selecciona ruta...</option>
                          {(detalle.rutasDisponibles || []).map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.codigo} - {r.nombre || 'Sin nombre'}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        className="btn btn-outline-primary btn-sm"
                        disabled={sendingRuta || !nuevaRutaId}
                      >
                        {sendingRuta ? 'Guardando...' : 'Cambiar ruta'}
                      </button>
                    </form>
                  ) : (
                    <div className="text-body-secondary small">
                      Solo ADMIN puede cambiar la ruta.
                    </div>
                  )}
                </div>
              </div>

              <div className="card mb-3">
                <div className="card-header">Cambio de estado</div>
                <div className="card-body">
                  {detalle.canManageState ? (
                    <form onSubmit={onSubmitEstado}>
                      <div className="mb-2">
                        <select
                          className="form-select"
                          value={nuevoEstado}
                          onChange={(e) => setNuevoEstado(e.target.value)}
                        >
                          <option value="PENDIENTE">PENDIENTE</option>
                          <option value="RESUELTA">RESUELTA</option>
                          <option value="CANCELADA">CANCELADA</option>
                        </select>
                      </div>
                      <div className="mb-2">
                        <textarea
                          className="form-control"
                          rows="3"
                          placeholder="Observación (opcional)"
                          value={obsEstado}
                          onChange={(e) => setObsEstado(e.target.value)}
                        />
                      </div>
                      <button className="btn btn-warning btn-sm" disabled={sendingEstado}>
                        {sendingEstado ? 'Guardando...' : 'Cambiar estado'}
                      </button>
                    </form>
                  ) : (
                    <div className="text-body-secondary small">
                      Solo CREDITO o ADMIN pueden cambiar el estado.
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header">Historial</div>
                <div className="card-body">
                  <div className="list-group">
                    {detalle.historial?.length ? (
                      detalle.historial.map((h) => (
                        <div key={h.id} className="list-group-item">
                          <div className="small text-body-secondary mb-1">
                            {h.usuario_nombre || h.usuario_username || 'Usuario'}
                          </div>
                          <div>
                            <strong>{h.campo_modificado}</strong>: {h.valor_anterior || '—'} →{' '}
                            {h.valor_nuevo || '—'}
                          </div>
                          {h.observacion ? (
                            <div className="small text-body-secondary">{h.observacion}</div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="text-body-secondary">Sin historial</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="card mt-3">
                <div className="card-header">Documentos adjuntos</div>
                <div className="card-body">
                  <form onSubmit={onSubmitDocumento} className="mb-3">
                    <div className="input-group">
                      <input
                        className="form-control"
                        type="file"
                        onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                      />
                      <button className="btn btn-outline-primary" disabled={sendingDoc} type="submit">
                        {sendingDoc ? 'Subiendo...' : 'Adjuntar'}
                      </button>
                    </div>
                  </form>
                  <div className="list-group">
                    {detalle.documentos?.length ? (
                      detalle.documentos.map((d) => (
                        <a
                          key={d.id}
                          href={d.ruta_archivo}
                          target="_blank"
                          rel="noreferrer"
                          className="list-group-item list-group-item-action d-flex justify-content-between"
                        >
                          <span>{d.nombre_archivo}</span>
                          <small className="text-body-secondary">
                            {d.usuario_nombre || d.usuario_username || 'Usuario'}
                          </small>
                        </a>
                      ))
                    ) : (
                      <div className="text-body-secondary">Sin documentos</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
