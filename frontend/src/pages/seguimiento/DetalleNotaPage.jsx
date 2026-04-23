import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  deleteSeguimientoComentario,
  fetchSeguimientoDetalle,
  postSeguimientoComentario,
  postSeguimientoDocumento,
  postSeguimientoEstado,
  postSeguimientoRuta,
} from '../../services/seguimientoApi.js'
import { getSupabaseAuthMeta } from '../../lib/supabaseAuth.js'
import { useDomainSyncStore } from '../../stores/domainSyncStore.js'
import { estadoBadgeClass, notaMuestraAtencion } from '../../utils/estadoBadge.js'

function money(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(n)
}

function formatFechaNota(value) {
  const s = String(value ?? '').trim()
  if (!s) return '—'
  const iso = s.slice(0, 10)
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function formatFechaHora(value) {
  const s = String(value ?? '').trim()
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

function formatDiasDesdeHoy(fechaNota) {
  const s = String(fechaNota ?? '').trim()
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startNota = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.floor((startToday.getTime() - startNota.getTime()) / (24 * 60 * 60 * 1000))
  return Number.isFinite(diff) ? String(diff) : '—'
}

/** El API de detalle no envía `tiene_comentarios`; se infiere de aclaraciones. */
function notaDetalleMuestraAtencion(detalle) {
  if (!detalle?.nota) return false
  return notaMuestraAtencion({
    ...detalle.nota,
    tiene_comentarios:
      Array.isArray(detalle.aclaraciones) && detalle.aclaraciones.length > 0,
  })
}

async function copyText(text) {
  const value = String(text ?? '').trim()
  if (!value) return
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
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
  const [copyToast, setCopyToast] = useState('')
  const [currentMeta, setCurrentMeta] = useState(null)
  // deleteConfirm: id del comentario esperando 2do click de confirmación
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const deleteConfirmRef = useRef(null)
  const emitNotaChanged = useDomainSyncStore((s) => s.emitNotaChanged)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [r, meta] = await Promise.all([
        fetchSeguimientoDetalle(id),
        getSupabaseAuthMeta().catch(() => null),
      ])
      setDetalle(r)
      setCurrentMeta(meta)
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

  async function handleCopySerieFolio(value) {
    try {
      await copyText(value)
      setCopyToast(`Serie/Folio copiado: ${value}`)
    } catch {
      setError('No se pudo copiar Serie/Folio')
    }
  }

  function canDeleteComentario(a) {
    if (!currentMeta) return false
    const esAutor = Number(a.usuario_id) === Number(currentMeta.usuarioId)
    const esAdmin = currentMeta.isSuperuser || currentMeta.rol === 'ADMIN'
    return esAutor || esAdmin
  }

  async function onDeleteComentario(comentarioId) {
    if (deleteConfirm !== comentarioId) {
      // Primer click: pedir confirmación
      setDeleteConfirm(comentarioId)
      return
    }
    // Segundo click: confirmar y eliminar
    setDeleteConfirm(null)
    setDeletingId(comentarioId)
    try {
      await deleteSeguimientoComentario(comentarioId)
      emitNotaChanged()
      await load()
    } catch (e2) {
      setError(e2?.message || 'No se pudo eliminar el comentario')
    } finally {
      setDeletingId(null)
    }
  }

  // Cancelar confirmación si el usuario hace click fuera
  useEffect(() => {
    if (deleteConfirm == null) return
    function handleOutsideClick(e) {
      if (deleteConfirmRef.current && !deleteConfirmRef.current.contains(e.target)) {
        setDeleteConfirm(null)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [deleteConfirm])

  useEffect(() => {
    if (!copyToast) return
    const t = setTimeout(() => setCopyToast(''), 1800)
    return () => clearTimeout(t)
  }, [copyToast])

  return (
    <section className="container-fluid px-2 px-sm-3">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
        <h1 className="fs-6 fs-md-5 fw-semibold mb-0 text-truncate me-2">Detalle #{id}</h1>
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
          <div className="card-body p-2">Cargando...</div>
        </div>
      ) : !detalle?.nota ? (
        <div className="alert alert-secondary">Sin información</div>
      ) : (
        <>
          <div className="card mb-2 border-0 shadow-sm overflow-hidden">
            <div className="px-2 py-2 border-bottom bg-body-tertiary">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div className="d-flex flex-wrap align-items-center gap-2 min-w-0 flex-grow-1">
                  <span className="text-body-secondary small text-uppercase fw-semibold text-nowrap">
                    Serie / folio
                  </span>
                  <span className="fw-semibold text-break" style={{ letterSpacing: '0.02em' }}>
                    {detalle.nota.serie_folio || '—'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary flex-shrink-0 py-0 px-2"
                    aria-label="Copiar Serie/Folio"
                    title="Copiar Serie/Folio"
                    disabled={!detalle.nota.serie_folio}
                    onClick={() => {
                      void handleCopySerieFolio(detalle.nota.serie_folio)
                    }}
                  >
                    <span aria-hidden="true">📋</span>
                  </button>
                  <span className="text-body-secondary small text-nowrap" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-body-secondary small text-nowrap">
                    ID <span className="text-body fw-medium">{detalle.nota.id}</span>
                  </span>
                </div>
                <span className={`badge flex-shrink-0 ${estadoBadgeClass(detalle.nota.estado)}`}>
                  {detalle.nota.estado || '—'}
                </span>
              </div>
            </div>
            <div className="card-body p-2">
              <div className="row g-2 g-lg-3">
                <div className="col-lg-6">
                  <div className="small text-uppercase text-body-secondary fw-semibold mb-1">
                    Cliente y asignación
                  </div>
                  <div className="vstack gap-0">
                    <div className="d-flex justify-content-between align-items-baseline gap-2 py-1 border-bottom">
                      <span className="text-body-secondary small flex-shrink-0">Cliente</span>
                      <span className="fw-medium text-break text-end">{detalle.nota.cliente || '—'}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-baseline gap-2 py-1 border-bottom">
                      <span className="text-body-secondary small flex-shrink-0">Empresa</span>
                      <span className="fw-medium text-break text-end">{detalle.nota.empresa || '—'}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-baseline gap-2 py-1 border-bottom">
                      <span className="text-body-secondary small flex-shrink-0">Ruta</span>
                      <span className="fw-medium font-monospace text-end">{detalle.nota.ruta_codigo || '—'}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-baseline gap-2 py-1">
                      <span className="text-body-secondary small flex-shrink-0">Vendedor</span>
                      <span className="fw-medium text-break text-end">
                        {detalle.nota.vendedor_username ||
                          detalle.nota.usuario_vendedor_pv ||
                          '—'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="small text-uppercase text-body-secondary fw-semibold mb-1">
                    Importes y fechas
                  </div>
                  <div className="row g-1 mb-2">
                    <div className="col-4">
                      <div className="rounded-2 border bg-body-tertiary px-1 py-1 text-center h-100">
                        <div className="small text-body-secondary lh-sm">Monto</div>
                        <div className="fw-semibold small text-nowrap lh-sm">{money(detalle.nota.monto)}</div>
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="rounded-2 border bg-body-tertiary px-1 py-1 text-center h-100">
                        <div className="small text-body-secondary lh-sm">Abono</div>
                        <div className="fw-semibold small text-nowrap lh-sm">{money(detalle.nota.abono)}</div>
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="rounded-2 border border-2 border-secondary bg-body-secondary px-1 py-1 text-center h-100">
                        <div className="small text-body-secondary lh-sm">Saldo</div>
                        <div className="fw-bold small text-body-emphasis text-nowrap lh-sm">{money(detalle.nota.saldo)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="vstack gap-0">
                    <div className="d-flex justify-content-between align-items-baseline gap-2 py-1 border-bottom">
                      <span className="text-body-secondary small flex-shrink-0">Fecha nota</span>
                      <span className="fw-medium text-end">{formatFechaNota(detalle.nota.fecha_nota)}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-baseline gap-2 py-1 border-bottom">
                      <span className="text-body-secondary small flex-shrink-0">Días desde nota</span>
                      <span className="fw-medium text-end">
                        {formatDiasDesdeHoy(detalle.nota.fecha_nota)}
                        <span className="text-body-secondary fw-normal small"> · hoy</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-top">
                <div className="small text-uppercase text-body-secondary fw-semibold mb-1">Seguimiento</div>
                <div className="d-flex flex-wrap gap-1 align-items-center">
                  <span
                    className={`badge rounded-pill ${
                      notaDetalleMuestraAtencion(detalle) ? 'text-bg-warning' : 'text-bg-secondary'
                    }`}
                  >
                    Atención: {notaDetalleMuestraAtencion(detalle) ? 'Sí' : 'No'}
                  </span>
                  {detalle.nota.resuelta_automaticamente ? (
                    <span className="badge rounded-pill text-bg-info">Por importación</span>
                  ) : (
                    <span className="badge rounded-pill text-bg-light text-dark border">Manual</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="row g-2">
            <div className="col-12 col-lg-7">
              <div className="card mb-2">
                <div className="card-header py-2 px-2 small fw-semibold">Comentarios / aclaraciones</div>
                <div className="card-body p-2">
                  <form onSubmit={onSubmitComentario} className="mb-2">
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

                  <div className="list-group" ref={deleteConfirmRef}>
                    {detalle.aclaraciones?.length ? (
                      detalle.aclaraciones.map((a) => (
                        <div key={a.id} className="list-group-item py-2 px-2">
                          <div className="d-flex justify-content-between align-items-start gap-2">
                            <div className="min-w-0 flex-grow-1">
                              <div className="d-flex justify-content-between align-items-center gap-1 mb-1">
                                <strong className="small">{a.tipo}</strong>
                                <small className="text-body-secondary text-nowrap">
                                  {a.usuario_nombre || a.usuario_username || 'Usuario'}
                                </small>
                              </div>
                              <div className="small text-body-secondary mb-1">
                                {formatFechaHora(a.created_at)}
                              </div>
                              <div className="small">{a.comentario}</div>
                            </div>
                            {canDeleteComentario(a) && (
                              <button
                                type="button"
                                className={`btn btn-sm flex-shrink-0 ${
                                  deleteConfirm === a.id
                                    ? 'btn-danger'
                                    : 'btn-outline-secondary'
                                }`}
                                style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                disabled={deletingId === a.id}
                                title={
                                  deleteConfirm === a.id
                                    ? 'Haz click de nuevo para confirmar'
                                    : 'Eliminar comentario'
                                }
                                onClick={() => onDeleteComentario(a.id)}
                              >
                                {deletingId === a.id
                                  ? '...'
                                  : deleteConfirm === a.id
                                    ? '¿Confirmar?'
                                    : '🗑'}
                              </button>
                            )}
                          </div>
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
              <div className="card mb-2">
                <div className="card-header py-2 px-2 small fw-semibold">Cambio de ruta</div>
                <div className="card-body p-2">
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

              <div className="card mb-2">
                <div className="card-header py-2 px-2 small fw-semibold">Cambio de estado</div>
                <div className="card-body p-2">
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
                          rows="2"
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

              <div className="card mb-2">
                <div className="card-header py-2 px-2 small fw-semibold">Historial</div>
                <div className="card-body p-2">
                  <div className="list-group">
                    {detalle.historial?.length ? (
                      detalle.historial.map((h) => (
                        <div key={h.id} className="list-group-item py-2 px-2">
                          <div className="small text-body-secondary mb-1">
                            {h.usuario_nombre || h.usuario_username || 'Usuario'}
                          </div>
                          <div className="small text-body-secondary mb-1">
                            {formatFechaHora(h.created_at)}
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

              <div className="card">
                <div className="card-header py-2 px-2 small fw-semibold">Documentos adjuntos</div>
                <div className="card-body p-2">
                  <form onSubmit={onSubmitDocumento} className="mb-2">
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
                          className="list-group-item list-group-item-action d-flex justify-content-between py-2 px-2"
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
      {copyToast ? (
        <div className="toast-container position-fixed top-0 end-0 p-2" style={{ zIndex: 1080 }}>
          <div className="toast show align-items-center text-bg-success border-0" role="status" aria-live="polite" aria-atomic="true">
            <div className="d-flex">
              <div className="toast-body">{copyToast}</div>
              <button
                type="button"
                className="btn-close btn-close-white me-2 m-auto"
                aria-label="Cerrar"
                onClick={() => setCopyToast('')}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
