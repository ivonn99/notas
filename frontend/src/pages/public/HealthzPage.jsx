import { useEffect, useState } from 'react'
import { fetchDbPing } from '../../services/api.js'

export default function HealthzPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [health, setHealth] = useState(null)
  const [healthz, setHealthz] = useState(null)
  const [dbPing, setDbPing] = useState(null)

  const dbSource = dbPing?.data?.dbSource
  const dbSourceLabel = dbSource === 'SUPABASE' ? 'Supabase' : dbSource || null

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [r1, r2] = await Promise.all([
          fetch('/api/health', { credentials: 'include' }),
          fetch('/api/healthz', { credentials: 'include' }),
        ])
        const j1 = await r1.json().catch(() => ({}))
        const j2 = await r2.json().catch(() => ({}))
        const db = await fetchDbPing().catch((e) => ({
          ok: false,
          status: 0,
          data: {},
          hint: e?.message || 'No se pudo consultar /api/db/ping',
        }))
        if (!cancel) {
          setHealth({ status: r1.status, body: j1 })
          setHealthz({ status: r2.status, body: j2 })
          setDbPing(db)
        }
      } catch (e) {
        if (!cancel) setError(e?.message || 'No se pudo consultar el API')
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-3">Healthcheck</h1>
      <p className="text-body-secondary mb-3">
        Misma idea que <code>GET /healthz/</code> en Django: respuesta mínima para monitoreo. Aquí el
        API expone <code>/api/health</code>, <code>/api/healthz</code> (alias) y{' '}
        <code>/api/db/ping</code>.
      </p>
      {error ? <div className="alert alert-warning">{error}</div> : null}
      {loading ? (
        <div className="spinner-border spinner-border-sm" role="status" />
      ) : (
        <div className="row g-3">
          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <code>GET /api/health</code> — HTTP {health?.status ?? '—'}
              </div>
              <div className="card-body">
                <pre className="small mb-0 text-break">
                  {JSON.stringify(health?.body ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <code>GET /api/healthz</code> — HTTP {healthz?.status ?? '—'}
              </div>
              <div className="card-body">
                <pre className="small mb-0 text-break">
                  {JSON.stringify(healthz?.body ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
          <div className="col-md-12">
            <div className="card">
              <div className="card-header">
                <code>GET /api/db/ping</code> — HTTP {dbPing?.status ?? '—'}
              </div>
              <div className="card-body">
                {dbPing?.ok && dbPing?.data?.ok ? (
                  <div className="alert alert-success py-2 mb-2" role="alert">
                    <strong>{dbSourceLabel ?? 'Base de datos'}:</strong> conexión correcta
                    {dbPing?.data?.latencyMs != null ? (
                      <span className="ms-1">({dbPing.data.latencyMs} ms)</span>
                    ) : null}
                    {dbPing?.data?.notasCreditoCount != null ? (
                      <div className="small mt-1 mb-0">
                        Filas en <code>notas_credito</code>:{' '}
                        <strong>{dbPing.data.notasCreditoCount}</strong>
                      </div>
                    ) : null}
                    {dbPing?.data?.dbHost ? (
                      <div className="small mt-1 mb-0">
                        Host: <code>{dbPing.data.dbHost}</code>
                      </div>
                    ) : null}
                  </div>
                ) : dbPing ? (
                  <div className="alert alert-warning py-2 mb-2" role="alert">
                    {dbPing?.data?.error || dbPing?.hint || 'No se pudo validar conexión.'}
                  </div>
                ) : null}
                <pre className="small mb-0 text-break">
                  {JSON.stringify(dbPing?.data ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
