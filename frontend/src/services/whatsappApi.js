import { http } from './http.js'

/**
 * @param {'DISTRIBUIDORA' | 'RODRIGO'} empresa
 * @param {number} diasMin
 * @param {number | null | undefined} diasMax
 */
export function fetchMensajesPendientes30d(empresa, diasMin = 30, diasMax) {
  const q = new URLSearchParams({ empresa, dias_min: String(diasMin) })
  if (diasMax != null && diasMax !== '') {
    q.set('dias_max', String(diasMax))
  }
  return http(`/api/whatsapp/mensajes-pendientes-30d?${q.toString()}`)
}

export function postWhatsappConnect() {
  return http('/api/whatsapp/connect', { method: 'POST' })
}

export function postWhatsappDisconnect(payload = {}) {
  return http('/api/whatsapp/disconnect', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchWhatsappStatus() {
  return http('/api/whatsapp/status')
}

export function fetchWhatsappQr() {
  return http('/api/whatsapp/qr')
}

export function postWhatsappSendTest(payload = {}) {
  return http('/api/whatsapp/send-test', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function postWhatsappSendBatch(payload = {}) {
  return http('/api/whatsapp/send-batch', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
