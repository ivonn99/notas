import { apiUrl } from '../utils/apiUrl.js'

function jsonOrEmpty(text) {
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

function buildQuery(params = {}) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v == null) return
    const s = String(v).trim()
    if (!s) return
    q.set(k, s)
  })
  return q.toString()
}

async function request(path, options = {}) {
  const isFormData = options?.body instanceof FormData
  const res = await fetch(apiUrl(path), {
    credentials: 'include',
    headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = jsonOrEmpty(await res.text())
  if (!res.ok) throw new Error(data.error || `Error HTTP ${res.status}`)
  return data
}

export function fetchSeguimientoList(params = {}) {
  const query = buildQuery(params)
  return request(query ? `/api/seguimiento?${query}` : '/api/seguimiento')
}

export function fetchSeguimientoDetalle(id) {
  return request(`/api/seguimiento/nota/${id}`)
}

export function postSeguimientoComentario(id, payload) {
  return request(`/api/seguimiento/nota/${id}/comentarios`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function postSeguimientoEstado(id, payload) {
  return request(`/api/seguimiento/nota/${id}/estado`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function postSeguimientoRuta(id, rutaId) {
  return request(`/api/seguimiento/nota/${id}/ruta`, {
    method: 'POST',
    body: JSON.stringify({ rutaId }),
  })
}

export function postSeguimientoDocumento(id, file) {
  const fd = new FormData()
  fd.append('file', file)
  return request(`/api/seguimiento/nota/${id}/documentos`, {
    method: 'POST',
    body: fd,
  })
}
