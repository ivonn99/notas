import { maskPhone } from './whatsappUtils.js'
import {
  normalizeDelaySeconds,
  validateBatchInput,
} from './whatsappValidationService.js'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function sendWhatsappBatch({ client, items, delaySecondsRaw }) {
  const itemsRaw = validateBatchInput(items)

  const delaySeconds = normalizeDelaySeconds(delaySecondsRaw)
  const results = []

  for (let i = 0; i < itemsRaw.length; i += 1) {
    const item = itemsRaw[i] || {}
    const phone = String(item.phone ?? '').trim()
    const message = String(item.message ?? '').trim()
    const usuarioId = item.usuarioId ?? null
    const username = String(item.username ?? '').trim() || null

    if (!phone || !message) {
      results.push({
        index: i,
        ok: false,
        usuarioId,
        username,
        to: maskPhone(phone),
        error: 'phone/message inválidos',
      })
    } else {
      try {
        // eslint-disable-next-line no-await-in-loop
        const sendR = await client.sendText({ phone, message })
        results.push({
          index: i,
          ok: true,
          usuarioId,
          username,
          to: maskPhone(phone),
          result: sendR,
        })
      } catch (e) {
        results.push({
          index: i,
          ok: false,
          usuarioId,
          username,
          to: maskPhone(phone),
          error: e?.message || 'No se pudo enviar',
        })
      }
    }

    if (i < itemsRaw.length - 1) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(delaySeconds * 1000)
    }
  }

  const enviados = results.filter((r) => r.ok).length
  const fallidos = results.length - enviados
  return {
    ok: true,
    delaySeconds,
    total: results.length,
    enviados,
    fallidos,
    results,
  }
}
