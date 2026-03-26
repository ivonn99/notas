import { http } from './http.js'

function toQuery(params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue
    const s = String(v).trim()
    if (!s) continue
    qs.set(k, s)
  }
  return qs.toString()
}

export const auditoriaApi = {
  list: (params = {}) => {
    const q = toQuery(params)
    return http(q ? `/api/auditoria?${q}` : '/api/auditoria')
  },
}
