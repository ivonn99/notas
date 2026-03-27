import { apiUrl } from '../utils/apiUrl.js'

function parseJson(text) {
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

export async function http(path, options = {}) {
  const res = await fetch(apiUrl(path), {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = parseJson(await res.text())
  if (!res.ok) {
    const base =
      data.error ||
      (res.status === 401
        ? 'Tu sesión expiró. Inicia sesión nuevamente.'
        : res.status === 403
          ? 'No tienes permiso para esta acción.'
          : `Error HTTP ${res.status}`)
    const err = new Error(base)
    err.status = res.status
    err.code = data.code
    err.requestId = data.requestId
    throw err
  }
  return data
}
