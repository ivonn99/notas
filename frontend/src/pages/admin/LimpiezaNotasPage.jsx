import { useCallback, useState } from 'react'
import {
  previewLimpiezaNotas,
  purgeLimpiezaNotasTodo,
} from '../../services/limpiezaNotasApi.js'

function formatNum(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return x.toLocaleString('es-MX')
}

function formatMoney(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return x.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

export default function LimpiezaNotasPage() {
  const [diasMinimos, setDiasMinimos] = useState(365)
  const [empresa, setEmpresa] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [preview, setPreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [purging, setPurging] = useState(false)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const cargarPreview = useCallback(async () => {
    setLoadingPreview(true)
    setError('')
    setResult(null)
    setProgress(null)
    const t0 = performance.now()
    const debugOn =
      import.meta.env.DEV ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('DEBUG_LIMPIEZA') === '1')
    if (debugOn) {
      console.log('[limpieza-notas] ui:preview-start', { diasMinimos, empresa: empresa || null })
    }
    try {
      const r = await previewLimpiezaNotas({ diasMinimos, empresa })
      if (debugOn) {
        console.log('[limpieza-notas] ui:preview-ok', {
          ms: Math.round(performance.now() - t0),
          candidatos: r.candidatos,
          fecha_corte: r.fecha_corte,
          criterio_fecha: r.criterio_fecha,
          por_estado: r.por_estado,
        })
      }
      setPreview(r)
    } catch (e) {
      console.error('[limpieza-notas] ui:preview-error', {
        ms: Math.round(performance.now() - t0),
        message: e?.message,
        diasMinimos,
        empresa: empresa || null,
      })
      setPreview(null)
      setError(e?.message || 'No se pudo calcular el preview')
    } finally {
      setLoadingPreview(false)
    }
  }, [diasMinimos, empresa])

  const ejecutarPurge = useCallback(async () => {
    if (String(confirmText).trim().toUpperCase() !== 'ELIMINAR') {
      setError('Escribe ELIMINAR para confirmar')
      return
    }
    if (!preview?.candidatos) {
      setError('Primero calcula el preview; no hay candidatos')
      return
    }
    const ok = window.confirm(
      `Se eliminarán de forma permanente hasta ${formatNum(preview.candidatos)} notas RESUELTA/CANCELADA ` +
        `con antigüedad ≥ ${diasMinimos} días.\n\nEsta acción no se puede deshacer. ¿Continuar?`,
    )
    if (!ok) {
      if (import.meta.env.DEV || localStorage.getItem('DEBUG_LIMPIEZA') === '1') {
        console.log('[limpieza-notas] ui:purge-cancelled')
      }
      return
    }

    setPurging(true)
    setError('')
    setResult(null)
    setProgress({ lotes: 0, totalEliminadas: 0, restantes: preview.candidatos })
    const t0 = performance.now()
    console.log('[limpieza-notas] ui:purge-start', {
      diasMinimos,
      empresa: empresa || null,
      candidatosPreview: preview.candidatos,
    })
    try {
      const r = await purgeLimpiezaNotasTodo({
        diasMinimos,
        empresa,
        limit: 500,
        onProgress: (p) => {
          console.log('[limpieza-notas] ui:purge-progress', p)
          setProgress(p)
        },
      })
      console.log('[limpieza-notas] ui:purge-ok', {
        ms: Math.round(performance.now() - t0),
        ...r,
      })
      setResult(r)
      setConfirmText('')
      const refreshed = await previewLimpiezaNotas({ diasMinimos, empresa })
      setPreview(refreshed)
    } catch (e) {
      console.error('[limpieza-notas] ui:purge-error', {
        ms: Math.round(performance.now() - t0),
        message: e?.message,
      })
      setError(e?.message || 'Falló la eliminación')
    } finally {
      setPurging(false)
    }
  }, [confirmText, preview, diasMinimos, empresa])

  const porEstado = preview?.por_estado || {}
  const porEmpresa = preview?.por_empresa || {}

  return (
    <div className="container-fluid py-3">
      <div className="mb-3">
        <h1 className="h3 mb-1">Limpieza de notas</h1>
        <p className="text-body-secondary mb-0">
          Elimina de forma permanente notas <strong>RESUELTA</strong> y <strong>CANCELADA</strong>{' '}
          con antigüedad mínima configurable. Solo ADMIN. Irreversible.
        </p>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="alert alert-success" role="status">
          Eliminadas <strong>{formatNum(result.totalEliminadas)}</strong> notas en{' '}
          {formatNum(result.lotes)} lote(s). Restantes con el mismo criterio:{' '}
          <strong>{formatNum(result.restantes)}</strong>.
          {result.storageRemoved > 0
            ? ` Archivos de storage quitados: ${formatNum(result.storageRemoved)}.`
            : null}
        </div>
      ) : null}

      <div className="card border shadow-sm mb-3">
        <div className="card-body">
          <h2 className="h6 text-uppercase text-body-secondary mb-3">Criterios</h2>
          <div className="row g-3 align-items-end">
            <div className="col-md-4">
              <label className="form-label" htmlFor="limpieza-dias">
                Antigüedad mínima (días)
              </label>
              <input
                id="limpieza-dias"
                type="number"
                className="form-control"
                min={1}
                max={3650}
                value={diasMinimos}
                disabled={purging}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10)
                  setDiasMinimos(Number.isFinite(n) ? n : e.target.value)
                }}
              />
              <div className="form-text">
                Antigüedad por <code>fecha_nota</code> (la misma columna del listado Todas las
                notas). Estados: RESUELTA y CANCELADA.
              </div>
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="limpieza-empresa">
                Empresa (opcional)
              </label>
              <select
                id="limpieza-empresa"
                className="form-select"
                value={empresa}
                disabled={purging}
                onChange={(e) => setEmpresa(e.target.value)}
              >
                <option value="">Todas</option>
                <option value="DISTRIBUIDORA">DISTRIBUIDORA</option>
                <option value="RODRIGO">RODRIGO</option>
              </select>
            </div>
            <div className="col-md-4">
              <button
                type="button"
                className="btn btn-outline-primary w-100"
                disabled={loadingPreview || purging}
                onClick={() => void cargarPreview()}
              >
                {loadingPreview ? 'Calculando…' : 'Calcular preview'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {preview ? (
        <div className="card border shadow-sm mb-3">
          <div className="card-body">
            <h2 className="h6 text-uppercase text-body-secondary mb-3">Preview</h2>
            <div className="row g-3 mb-3">
              <div className="col-6 col-md-3">
                <div className="text-body-secondary small">Candidatos</div>
                <div className="fs-4 fw-semibold">{formatNum(preview.candidatos)}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="text-body-secondary small">Documentos</div>
                <div className="fs-4 fw-semibold">{formatNum(preview.documentos)}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="text-body-secondary small">Monto total</div>
                <div className="fs-5 fw-semibold">{formatMoney(preview.monto_total)}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="text-body-secondary small">Saldo total</div>
                <div className="fs-5 fw-semibold">{formatMoney(preview.saldo_total)}</div>
              </div>
            </div>
            <div className="row g-3 small">
              <div className="col-md-6">
                <div className="text-body-secondary mb-1">Por estado</div>
                <ul className="mb-0">
                  <li>RESUELTA: {formatNum(porEstado.RESUELTA || 0)}</li>
                  <li>CANCELADA: {formatNum(porEstado.CANCELADA || 0)}</li>
                </ul>
              </div>
              <div className="col-md-6">
                <div className="text-body-secondary mb-1">Por empresa</div>
                <ul className="mb-0">
                  {Object.keys(porEmpresa).length === 0 ? (
                    <li>—</li>
                  ) : (
                    Object.entries(porEmpresa).map(([k, v]) => (
                      <li key={k}>
                        {k}: {formatNum(v)}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
            {preview.fecha_corte ? (
              <p className="small text-body-secondary mt-3 mb-0">
                Fecha de corte: {new Date(preview.fecha_corte).toLocaleString()}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="card border border-danger-subtle shadow-sm">
        <div className="card-body">
          <h2 className="h6 text-danger text-uppercase mb-3">Eliminar (hard delete)</h2>
          <p className="small text-body-secondary">
            Borra notas, aclaraciones, historial, alertas y documentos en BD (por lotes de 500).
            También intenta quitar archivos del bucket de storage.
          </p>
          <div className="row g-3 align-items-end">
            <div className="col-md-6">
              <label className="form-label" htmlFor="limpieza-confirm">
                Escribe <strong>ELIMINAR</strong> para habilitar
              </label>
              <input
                id="limpieza-confirm"
                type="text"
                className="form-control"
                value={confirmText}
                disabled={purging || !preview?.candidatos}
                autoComplete="off"
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="ELIMINAR"
              />
            </div>
            <div className="col-md-6">
              <button
                type="button"
                className="btn btn-danger w-100"
                disabled={
                  purging ||
                  !preview?.candidatos ||
                  String(confirmText).trim().toUpperCase() !== 'ELIMINAR'
                }
                onClick={() => void ejecutarPurge()}
              >
                {purging ? 'Eliminando…' : 'Eliminar notas candidatas'}
              </button>
            </div>
          </div>
          {purging || progress ? (
            <div className="mt-3 small text-body-secondary">
              {purging ? 'En curso: ' : 'Último progreso: '}
              lote {formatNum(progress?.lotes || 0)}, eliminadas acumuladas{' '}
              {formatNum(progress?.totalEliminadas || 0)}, restantes{' '}
              {formatNum(progress?.restantes ?? '—')}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
