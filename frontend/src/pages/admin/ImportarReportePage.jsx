import { useState } from 'react'
import { importacionesApi } from '../../services/importacionesApi.js'

function toDdMmYyyy(isoDate) {
  const s = String(isoDate || '').trim()
  if (!s) return '—'
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return s
  return `${m[3]}/${m[2]}/${m[1]}`
}

export default function ImportarReportePage() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [progress, setProgress] = useState(null)
  const [preview, setPreview] = useState(null)
  const [mapping, setMapping] = useState(null)
  const FIELDS = [
    'serie_folio',
    'cliente',
    'empresa',
    'ruta',
    'monto',
    'abono',
    'fecha_nota',
    'estado',
    'usuario_vendedor_pv',
    'requiere_atencion',
  ]

  async function descargarMuestra() {
    setError('')
    try {
      const csv = await importacionesApi.downloadMuestra()
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'muestra_importacion_notas.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e?.message || 'No se pudo descargar muestra')
    }
  }

  async function pollProgress(importacionId) {
    let done = false
    while (!done) {
      // eslint-disable-next-line no-await-in-loop
      const p = await importacionesApi.progreso(importacionId)
      if (p.inMemory) {
        setProgress({
          status: p.status,
          total: p.total,
          processed: p.processed,
          errorCount: p.errorCount,
          pct: p.pct ?? 0,
        })
        done = Boolean(p.done)
      } else {
        const pr = p.progress
        const i = p.importacion
        setProgress({
          status: pr?.status || i.estado,
          total: pr?.total ?? i.total_registros ?? 0,
          processed:
            pr?.processed ??
            (i.registros_nuevos || 0) + (i.registros_actualizados || 0),
          errorCount: pr?.errorCount ?? 0,
          pct: pr?.pct ?? 0,
        })
        done = Boolean(pr?.done) || ['COMPLETADA', 'PARCIAL', 'FALLIDA'].includes(i.estado)
      }
      if (!done) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 1200))
      }
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!file) {
      setError('Selecciona un archivo CSV')
      return
    }
    setLoading(true)
    setError('')
    setOk('')
    setProgress(null)
    setPreview(null)
    try {
      const r = await importacionesApi.uploadCsv(file, mapping)
      await pollProgress(r.importacionId)
      setOk(`Importación #${r.importacionId} finalizada. Revisa historial para detalle.`)
      setFile(null)
    } catch (e2) {
      setError(e2?.message || 'No se pudo importar')
    } finally {
      setLoading(false)
    }
  }

  async function onPreview() {
    if (!file) {
      setError('Selecciona un archivo para previsualizar')
      return
    }
    setLoading(true)
    setError('')
    setOk('')
    setPreview(null)
    try {
      const p = await importacionesApi.preview(file, mapping)
      setPreview(p)
      setMapping(p.mapping || p.autoMapping || null)
    } catch (e) {
      setError(e?.message || 'No se pudo generar preview')
    } finally {
      setLoading(false)
    }
  }

  async function refreshPreviewWithMapping(nextMapping) {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const p = await importacionesApi.preview(file, nextMapping)
      setPreview(p)
      setMapping(p.mapping || nextMapping)
    } catch (e) {
      setError(e?.message || 'No se pudo aplicar mapeo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-3">Importar reporte</h1>
      <div className="card">
        <div className="card-body">
          <p className="text-body-secondary">
            Formatos soportados: CSV, TSV y Excel (.xlsx/.xls) con encabezados como{' '}
            <code>serie_folio,cliente,empresa,ruta,monto,abono,estado</code>.
          </p>
          <div className="alert alert-secondary py-2">
            <div className="fw-semibold mb-1">Notas para el usuario</div>
            <ul className="mb-0 small ps-3">
              <li>Campos clave: Serie/Folio, Empresa, Monto, Abono y Estado.</li>
              <li>
                Fecha nota: debe venir del archivo (recomendado <code>dd/mm/aaaa</code>).
              </li>
              <li>Empresa válida: DISTRIBUIDORA o RODRIGO.</li>
              <li>
                Si la ruta no existe en catálogo, se crea automáticamente (si viene vacía se usa
                SIN_RUTA).
              </li>
              <li>
                Si una nota ya existe (Empresa + Serie/Folio), se actualiza; si no existe, se crea.
              </li>
              <li>
                Regla de descarte: cuando la importación termina sin errores, notas que ya no vienen
                en el nuevo reporte se marcan como RESUELTA automáticamente.
              </li>
              <li>Usa Previsualizar antes de importar para validar mapeo y errores por fila.</li>
            </ul>
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm mb-3" onClick={descargarMuestra}>
            Descargar archivo muestra
          </button>
          {error ? <div className="alert alert-warning">{error}</div> : null}
          {ok ? <div className="alert alert-success">{ok}</div> : null}
          {progress ? (
            <div className="alert alert-info">
              <div className="fw-semibold mb-1">Estado: {progress.status}</div>
              <div className="small">
                Procesados: {progress.processed} / {progress.total || '...'} | errores:{' '}
                {progress.errorCount}
              </div>
              <div className="progress mt-2" role="progressbar">
                <div
                  className="progress-bar"
                  style={{
                    width: `${progress.pct ?? 0}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
          <form onSubmit={onSubmit}>
            <div className="mb-3">
              <input
                className="form-control"
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values,.xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Importando...' : 'Subir e importar'}
            </button>
            <button
              className="btn btn-outline-secondary ms-2"
              type="button"
              disabled={loading}
              onClick={onPreview}
            >
              Previsualizar
            </button>
          </form>
          {preview ? (
            <div className="mt-4">
              <h2 className="h6">Preview</h2>
              <div className="small text-body-secondary mb-2">
                Archivo: {preview.file?.name} | registros: {preview.file?.records}
              </div>
              <div className="small mb-2">
                Revisadas: {preview.preview?.checkedRows} | válidas:{' '}
                {preview.preview?.validCount} | con errores: {preview.preview?.invalidCount}
              </div>
              <div className="card mb-3">
                <div className="card-header py-2">Mapeo de columnas</div>
                <div className="card-body">
                  <div className="row g-2">
                    {FIELDS.map((f) => (
                      <div className="col-12 col-md-6 col-lg-4" key={f}>
                        <label className="form-label mb-1 small">{f}</label>
                        <select
                          className="form-select form-select-sm"
                          value={mapping?.[f] || ''}
                          onChange={(e) => {
                            const next = { ...(mapping || {}), [f]: e.target.value || null }
                            setMapping(next)
                            refreshPreviewWithMapping(next)
                          }}
                        >
                          <option value="">(sin asignar)</option>
                          {(preview.headers || []).map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-sm table-bordered">
                  <thead>
                    <tr>
                      <th>Fila</th>
                      <th>Serie/Folio</th>
                      <th>Cliente</th>
                      <th>Empresa</th>
                      <th>Ruta</th>
                      <th>Fecha nota (archivo)</th>
                      <th>Fecha nota (normalizada)</th>
                      <th>Estado</th>
                      <th>Errores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview?.rows?.map((r) => (
                      <tr key={r.rowNumber}>
                        <td>{r.rowNumber}</td>
                        <td>{r.normalized?.serieFolio || '—'}</td>
                        <td>{r.normalized?.cliente || '—'}</td>
                        <td>{r.normalized?.empresa || '—'}</td>
                        <td>{r.normalized?.rutaCodigo || '—'}</td>
                        <td>{String(r.raw?.[mapping?.fecha_nota] ?? '').trim() || '—'}</td>
                        <td>{toDdMmYyyy(r.normalized?.fechaNota)}</td>
                        <td>{r.normalized?.estado || '—'}</td>
                        <td className="small text-danger">
                          {r.errors?.length ? r.errors.join('; ') : 'OK'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
