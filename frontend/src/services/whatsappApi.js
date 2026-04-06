import { isSupabaseConfigured } from '../lib/supabaseClient.js'
import { http } from './http.js'

function assertWhatsappNodeApi() {
  if (isSupabaseConfigured) {
    throw new Error(
      'WhatsApp (Baileys) solo funciona con el API Node desplegado. En modo solo Supabase no está disponible.',
    )
  }
}

/**
 * @param {'DISTRIBUIDORA' | 'RODRIGO'} empresa
 * @param {number} diasMin
 * @param {number | null | undefined} diasMax
 */
export function fetchMensajesPendientes30d(empresa, diasMin = 30, diasMax) {
  assertWhatsappNodeApi()
  const q = new URLSearchParams({ empresa, dias_min: String(diasMin) })
  if (diasMax != null && diasMax !== '') {
    q.set('dias_max', String(diasMax))
  }
  return http(`/api/whatsapp/mensajes-pendientes-30d?${q.toString()}`)
}

export function postWhatsappConnect() {
  assertWhatsappNodeApi()
  return http('/api/whatsapp/connect', { method: 'POST' })
}

export function postWhatsappDisconnect(payload = {}) {
  assertWhatsappNodeApi()
  return http('/api/whatsapp/disconnect', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchWhatsappStatus() {
  assertWhatsappNodeApi()
  return http('/api/whatsapp/status')
}

export function fetchWhatsappQr() {
  assertWhatsappNodeApi()
  return http('/api/whatsapp/qr')
}

export function postWhatsappSendTest(payload = {}) {
  assertWhatsappNodeApi()
  return http('/api/whatsapp/send-test', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function postWhatsappSendBatch(payload = {}) {
  assertWhatsappNodeApi()
  return http('/api/whatsapp/send-batch', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
