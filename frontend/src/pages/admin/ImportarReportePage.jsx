import { useEffect, useState } from 'react'
import { importacionesApi } from '../../services/importacionesApi.js'
import { useImportJobStore } from '../../stores/importJobStore.js'

function toDdMmYyyy(isoDate) {
  const s = String(isoDate || '').trim()
  if (!s) return '—'
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return s
  return `${m[3]}/${m[2]}/${m[1]}`
}

const EMPRESAS_IMPORTACION = [
  { value: 'DISTRIBUIDORA', label: 'DISTRIBUIDORA' },
  { value: 'RODRIGO', label: 'RODRIGO' },
]

export default function ImportarReportePage() {
  const [file, setFile] = useState(null)
  const [empresaImportacion, setEmpresaImportacion] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [mapping, setMapping] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [analisis, setAnalisis] = useState(null)
  const [analisisLoading, setAnalisisLoading] = useState(false)

  useEffect(() => {
    setPreview(null)
    setAnalisis(null)
  }, [empresaImportacion])

  const loading = useImportJobStore((s) => s.loading)
  const ok = useImportJobStore((s) => s.okMessage)
  const progressStatus = useImportJobStore((s) => s.status)
  const progressTotal = useImportJobStore((s) => s.total)
  const progressProcessed = useImportJobStore((s) => s.processed)
  const progressErrorCount = useImportJobStore((s) => s.errorCount)
  const progressPct = useImportJobStore((s) => s.pct)
  const currentImportacionId = useImportJobStore((s) => s.currentImportacionId)
  const startImport = useImportJobStore((s) => s.startImport)
  const storeError = useImportJobStore((s) => s.error)
  const resetMessages = useImportJobStore((s) => s.resetMessages)
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

  async function onSubmit(e) {
    e.preventDefault()
    if (!file) {
      setError('Selecciona un archivo CSV')
      return
    }
    if (!empresaImportacion) {
      setError('Indica de qué empresa es el reporte (DISTRIBUIDORA o RODRIGO)')
      return
    }
    setError('')
    resetMessages()
    setPreview(null)
    setAnalisis(null)
    try {
      await startImport({ file, mapping, empresaImportacion })
      setFile(null)
    } catch (e2) {
      setError(e2?.message || 'No se pudo importar')
    }
  }

  async function onPreview() {
    if (!file) {
      setError('Selecciona un archivo para previsualizar')
      return
    }
    if (!empresaImportacion) {
      setError('Indica de qué empresa es el reporte antes de previsualizar')
      return
    }
    setPreviewLoading(true)
    setError('')
    setPreview(null)
    setAnalisis(null)
    try {
      const p = await importacionesApi.preview(file, mapping, empresaImportacion)
      setPreview(p)
      setMapping(p.mapping || p.autoMapping || null)
    } catch (e) {
      setError(e?.message || 'No se pudo generar preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function onAnalizarImpacto() {
    if (!file) {
      setError('Selecciona un archivo para analizar')
      return
    }
    if (!empresaImportacion) {
      setError('Indica la empresa del reporte antes de analizar')
      return
    }
    setAnalisisLoading(true)
    setError('')
    try {
      const a = await importacionesApi.analizarAntesDeImportar(file, mapping, empresaImportacion)
      setAnalisis(a)
    } catch (e) {
      setError(e?.message || 'No se pudo analizar el archivo')
      setAnalisis(null)
    } finally {
      setAnalisisLoading(false)
    }
  }

  async function refreshPreviewWithMapping(nextMapping) {
    if (!file) return
    setPreviewLoading(true)
    setError('')
    setAnalisis(null)
    try {
      const p = await importacionesApi.preview(file, nextMapping, empresaImportacion)
      setPreview(p)
      setMapping(p.mapping || nextMapping)
    } catch (e) {
      setError(e?.message || 'No se pudo aplicar mapeo')
    } finally {
      setPreviewLoading(false)
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
                Debes elegir la empresa del reporte: el archivo debe traer la misma empresa en todas
                las filas válidas. El descarte (marcar RESUELTA lo que ya no viene en el archivo)
                aplica solo a esa empresa y solo si la importación termina sin errores y hay al
                menos una fila válida.
              </li>
              <li>Usa Previsualizar antes de importar para validar mapeo y errores por fila.</li>
              <li>
                <strong>Analizar impacto</strong> revisa todo el archivo (solo lectura) y estima: notas
                en base para esa empresa, folios válidos en el archivo, altas/actualizaciones y cuántas
                quedarían RESUELTAS por descarte si la importación terminara sin errores.
              </li>
            </ul>
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm mb-3" onClick={descargarMuestra}>
            Descargar archivo muestra
          </button>
          {error ? <div className="alert alert-warning">{error}</div> : null}
          {!error && storeError ? <div className="alert alert-warning">{storeError}</div> : null}
          {ok ? (
            <div className="alert alert-success" style={{ whiteSpace: 'pre-line' }}>
              {ok}
            </div>
          ) : null}
          {progressStatus ? (
            <div className="alert alert-info">
              <div className="fw-semibold mb-1">
                Estado: {progressStatus}
                {currentImportacionId ? ` · Importación #${currentImportacionId}` : ''}
              </div>
              <div className="small">
                Procesados: {progressProcessed} / {progressTotal || '...'} | errores:{' '}
                {progressErrorCount}
              </div>
              <div className="progress mt-2" role="progressbar">
                <div
                  className="progress-bar"
                  style={{
                    width: `${progressPct ?? 0}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
          <form onSubmit={onSubmit}>
            <div className="mb-3">
              <label className="form-label d-flex flex-wrap align-items-center gap-2" htmlFor="empresa-importacion">
                <span>¿De qué empresa es este reporte?</span>
                {empresaImportacion ? (
                  <span className="badge text-bg-info">{empresaImportacion}</span>
                ) : (
                  <span className="badge text-bg-secondary">Sin elegir</span>
                )}
              </label>
              <select
                id="empresa-importacion"
                className="form-select"
                required
                aria-describedby="empresa-importacion-ayuda"
                value={empresaImportacion}
                onChange={(e) => setEmpresaImportacion(e.target.value)}
              >
                <option value="" disabled>
                  — Elige DISTRIBUIDORA o RODRIGO —
                </option>
                {EMPRESAS_IMPORTACION.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <div id="empresa-importacion-ayuda" className="form-text">
                Obligatorio. Todas las filas válidas del archivo deben traer esa misma empresa en la
                columna <code>empresa</code>. El descarte (notas que ya no vienen en el archivo y se
                marcan RESUELTA) solo afecta a la empresa que elijas aquí.
              </div>
              {empresaImportacion ? (
                <div className="small text-body-secondary mt-2">
                  Las notas se importarán y compararán como empresa{' '}
                  <strong className="text-body">{empresaImportacion}</strong>.
                </div>
              ) : null}
            </div>
            <div className="mb-3">
              <input
                className="form-control"
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values,.xlsx,.xls"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null)
                  setAnalisis(null)
                }}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Importando...' : 'Subir e importar'}
            </button>
            <button
              className="btn btn-outline-secondary ms-2"
              type="button"
              disabled={loading || previewLoading}
              onClick={onPreview}
            >
              {previewLoading ? 'Previsualizando...' : 'Previsualizar'}
            </button>
            <button
              className="btn btn-outline-primary ms-2"
              type="button"
              disabled={loading || previewLoading || analisisLoading || !file || !empresaImportacion}
              onClick={onAnalizarImpacto}
            >
              {analisisLoading ? 'Analizando…' : 'Analizar impacto'}
            </button>
          </form>
          {analisis?.ok ? (
            <div className="card border-primary mt-3">
              <div className="card-header py-2">Análisis previo (sin subir datos)</div>
              <div className="card-body small">
                <p className="mb-2 text-body-secondary">
                  Empresa <strong>{analisis.empresa}</strong>. Comparación coherente con la importación
                  real (folios únicos válidos; descarte solo si no hay errores de validación).
                </p>
                <div className="row g-2">
                  <div className="col-md-6">
                    <div className="fw-semibold mb-1">En la base (ahora)</div>
                    <ul className="mb-0 ps-3">
                      <li>Total notas de la empresa: {analisis.base?.total_notas_empresa ?? '—'}</li>
                      <li>
                        Ya RESUELTA (el descarte no las toca):{' '}
                        {analisis.base?.notas_ya_resueltas ?? '—'}
                      </li>
                      <li>
                        Sin RESUELTA (PENDIENTE, CANCELADA, etc.):{' '}
                        {analisis.base?.notas_sin_estado_resuelta ??
                          analisis.base?.notas_no_resueltas ??
                          '—'}
                      </li>
                    </ul>
                  </div>
                  <div className="col-md-6">
                    <div className="fw-semibold mb-1">En el archivo</div>
                    <ul className="mb-0 ps-3">
                      <li>Filas totales: {analisis.archivo?.filas_totales ?? '—'}</li>
                      <li>Filas válidas: {analisis.archivo?.filas_validas ?? '—'}</li>
                      <li>Filas con error: {analisis.archivo?.filas_con_error ?? '—'}</li>
                      <li>Folios únicos válidos: {analisis.archivo?.folios_unicos_validos ?? '—'}</li>
                    </ul>
                  </div>
                </div>
                {analisis.comparacion ? (
                  <>
                    <hr className="my-3" />
                    <div className="fw-semibold mb-1">Mismo folio: base vs este archivo</div>
                    <p className="small text-body-secondary mb-2">
                      El descarte solo puede marcar RESUELTA a notas que <strong>no</strong> estén ya
                      RESUELTA y cuyo folio <strong>no</strong> venga en el archivo. Por eso{' '}
                      <strong>1507 − 629</strong> no son todas “a resolver”: muchas suelen ser historial
                      ya cerrado.
                    </p>
                    <ul className="mb-0 ps-3 small">
                      <li>
                        Notas en base cuyo folio <strong>sí</strong> está en el archivo:{' '}
                        {analisis.comparacion.notas_en_base_cuyo_folio_si_esta_en_archivo ?? '—'}
                      </li>
                      <li>
                        Notas en base cuyo folio <strong>no</strong> está en el archivo:{' '}
                        {analisis.comparacion.notas_en_base_cuyo_folio_no_esta_en_archivo ?? '—'}
                      </li>
                      <li className="ms-3">
                        → De esas, ya RESUELTA (sin cambio al importar):{' '}
                        {analisis.comparacion.de_esas_ya_resueltas_sin_tocar ?? '—'}
                      </li>
                      <li className="ms-3">
                        → De esas, sin RESUELTA hoy (serían las del descarte si aplica):{' '}
                        {analisis.comparacion.de_esas_abiertas_se_marcarian_resueltas_si_aplica_descarte ??
                          '—'}
                      </li>
                    </ul>
                  </>
                ) : null}
                <hr className="my-3" />
                <div className="fw-semibold mb-1">Estimado al importar</div>
                <ul className="mb-2 ps-3">
                  <li>Nuevas (folio no existía): {analisis.estimado_al_importar?.nuevas ?? '—'}</li>
                  <li>Actualizadas (folio ya existía): {analisis.estimado_al_importar?.actualizadas ?? '—'}</li>
                  <li>
                    RESUELTAS por descarte:{' '}
                    {analisis.estimado_al_importar?.descarte_se_aplicaria
                      ? analisis.estimado_al_importar?.resueltas_por_descarte ?? 0
                      : '— (no aplica)'}
                  </li>
                </ul>
                {analisis.estimado_al_importar?.nota_descarte ? (
                  <div className="alert alert-secondary py-2 mb-0 mt-2">
                    {analisis.estimado_al_importar.nota_descarte}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {preview ? (
            <div className="mt-4">
              <h2 className="h6">Preview</h2>
              <div className="small text-body-secondary mb-2">
                Empresa del reporte:{' '}
                <strong className="text-body">{preview.empresa_importacion || empresaImportacion}</strong>
                {' · '}
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
