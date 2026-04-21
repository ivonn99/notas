export function parseClearSessionFlag(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  return ['1', 'true', 'si', 'sí', 'yes'].includes(raw)
}

export function validateManualSendPayload(body) {
  const phone = String(body?.phone ?? '').trim()
  const message = String(body?.message ?? '').trim()
  if (!phone) {
    const err = new Error('phone es requerido')
    err.status = 400
    throw err
  }
  if (!message) {
    const err = new Error('message es requerido')
    err.status = 400
    throw err
  }
  return { phone, message }
}

export function resolveTestPayload(body, defaultPhone) {
  const phone = String(body?.phone ?? defaultPhone ?? '').trim()
  if (!phone) {
    const err = new Error('Falta phone en body o WHATSAPP_TEST_PHONE en .env')
    err.status = 400
    throw err
  }
  const message = String(body?.message ?? 'Mensaje de prueba DMH: conexión WhatsApp operativa.').trim()
  return { phone, message }
}

export function validateBatchInput(items) {
  const itemsRaw = Array.isArray(items) ? items : []
  if (!itemsRaw.length) {
    const err = new Error('items es requerido y no puede estar vacío')
    err.status = 400
    throw err
  }
  if (itemsRaw.length > 200) {
    const err = new Error('Máximo 200 mensajes por lote')
    err.status = 400
    throw err
  }
  return itemsRaw
}

export function normalizeDelaySeconds(value) {
  const delayRaw = Number.parseInt(String(value ?? '5').trim(), 10)
  return Number.isFinite(delayRaw) ? Math.min(30, Math.max(1, delayRaw)) : 5
}
