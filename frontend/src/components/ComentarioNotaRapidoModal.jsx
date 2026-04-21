import { useEffect, useState } from 'react'
import { postSeguimientoComentario } from '../services/seguimientoApi.js'
import { useDomainSyncStore } from '../stores/domainSyncStore.js'

export default function ComentarioNotaRapidoModal({
  show,
  onClose,
  notaId,
  serieFolio,
  cliente,
  onGuardado,
}) {
  const emitNotaChanged = useDomainSyncStore((s) => s.emitNotaChanged)
  const [tipo, setTipo] = useState('COMENTARIO')
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!show) return
    setTipo('COMENTARIO')
    setTexto('')
    setError('')
    setSending(false)
  }, [show, notaId])

  async function handleSubmit(e) {
    e.preventDefault()
    const comentario = texto.trim()
    if (!comentario || notaId == null) return
    setSending(true)
    setError('')
    try {
      await postSeguimientoComentario(String(notaId), { comentario, tipo })
      emitNotaChanged()
      onGuardado?.()
      onClose()
    } catch (err) {
      setError(err?.message || 'No se pudo guardar el comentario')
    } finally {
      setSending(false)
    }
  }

  function handleBackdropClick() {
    if (!sending) onClose()
  }

  if (!show) return null

  const titulo = serieFolio ? `Nota ${serieFolio}` : `Nota #${notaId}`

  return (
    <>
      <div
        className="modal-backdrop fade show"
        aria-hidden="true"
        onClick={handleBackdropClick}
      />
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="comentarioRapidoTitulo"
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header py-2 px-3">
              <div className="min-w-0">
                <h2 id="comentarioRapidoTitulo" className="modal-title fs-6 mb-0 text-truncate">
                  Comentarios / aclaraciones
                </h2>
                <div className="small text-body-secondary text-truncate" title={cliente || ''}>
                  {titulo}
                  {cliente ? ` · ${cliente}` : ''}
                </div>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Cerrar"
                disabled={sending}
                onClick={onClose}
              />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body py-2 px-3">
                {error ? (
                  <div className="alert alert-warning py-2 px-2 small mb-2" role="alert">
                    {error}
                  </div>
                ) : null}
                <label className="form-label small mb-1" htmlFor="comentarioRapidoTipo">
                  Tipo
                </label>
                <select
                  id="comentarioRapidoTipo"
                  className="form-select form-select-sm mb-2"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  disabled={sending}
                >
                  <option value="COMENTARIO">COMENTARIO</option>
                  <option value="ACLARACION">ACLARACION</option>
                  <option value="SEGUIMIENTO">SEGUIMIENTO</option>
                </select>
                <label className="form-label small mb-1" htmlFor="comentarioRapidoTexto">
                  Texto
                </label>
                <textarea
                  id="comentarioRapidoTexto"
                  className="form-control form-control-sm"
                  rows={4}
                  placeholder="Escribe el comentario o aclaración…"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  disabled={sending}
                  autoFocus
                />
              </div>
              <div className="modal-footer py-2 px-3 gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={sending} onClick={onClose}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !texto.trim()}>
                  {sending ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
