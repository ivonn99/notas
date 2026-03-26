import { http } from './http.js'

export const importacionesApi = {
  list: () => http('/api/importaciones'),
  logs: () => http('/api/logs-sistema'),
  progreso: (id) => http(`/api/importaciones/${id}/progreso`),
  preview: async (file, mapping = null) => {
    const fd = new FormData()
    fd.append('file', file)
    if (mapping) fd.append('mapping', JSON.stringify(mapping))
    const res = await fetch('/api/importaciones/preview', {
      method: 'POST',
      credentials: 'include',
      body: fd,
    })
    const text = await res.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = {}
    }
    if (!res.ok) throw new Error(data.error || `Error HTTP ${res.status}`)
    return data
  },
  downloadErroresTxt: async (id) => {
    const res = await fetch(`/api/importaciones/${id}/errores-txt`, { credentials: 'include' })
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`)
    return res.text()
  },
  downloadMuestra: async () => {
    const res = await fetch('/api/importaciones/muestra', { credentials: 'include' })
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`)
    return res.text()
  },
  uploadCsv: async (file, mapping = null) => {
    const fd = new FormData()
    fd.append('file', file)
    if (mapping) fd.append('mapping', JSON.stringify(mapping))
    const res = await fetch('/api/importaciones/upload', {
      method: 'POST',
      credentials: 'include',
      body: fd,
    })
    const text = await res.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = {}
    }
    if (!res.ok) throw new Error(data.error || `Error HTTP ${res.status}`)
    return data
  },
}
