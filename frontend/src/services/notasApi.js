import { apiUrl } from '../utils/apiUrl.js'

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

export async function fetchNotasCredito(params = {}) {
  const query = toQuery(params)
  const url = query ? `/api/notas-credito?${query}` : '/api/notas-credito'

  const res = await fetch(apiUrl(url), { credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `Error HTTP ${res.status} al cargar notas`)
  }
  return data
}
