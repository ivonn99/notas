import { http } from './http.js'

function toQuery(params) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v == null) return
    const s = String(v).trim()
    if (!s) return
    q.set(k, s)
  })
  return q.toString()
}

/**
 * @param {Record<string, string>} params empresa, estado, dias_bucket, q, fecha_desde, fecha_hasta, rutas, sort
 */
export function fetchCarteraReporte(params = {}) {
  const query = toQuery(params)
  return http(query ? `/api/reportes/cartera?${query}` : '/api/reportes/cartera')
}
