const WHATSAPP_MODE = String(process.env.WHATSAPP_MODE ?? 'local')
  .trim()
  .toLowerCase()

const REMOTE_TIMEOUT_MS = Number.parseInt(
  String(process.env.WHATSAPP_REMOTE_TIMEOUT_MS ?? '8000'),
  10,
)

function isEnabled() {
  return WHATSAPP_MODE !== 'disabled'
}

function disabledStatus() {
  return {
    status: 'disabled',
    isConnected: false,
    qr: '',
    me: null,
    lastError: 'WhatsApp deshabilitado por configuración',
    updatedAt: new Date().toISOString(),
  }
}

function assertEnabled() {
  if (!isEnabled()) {
    const err = new Error('Integración de WhatsApp deshabilitada')
    err.status = 503
    throw err
  }
}

async function getLocalService() {
  const mod = await import('./whatsappBaileysService.js')
  return mod.whatsappBaileysService
}

function normalizeBaseUrl(urlRaw) {
  const url = String(urlRaw ?? '').trim()
  if (!url) return ''
  return url.replace(/\/+$/, '')
}

async function remoteRequest(pathname, options = {}) {
  const baseUrl = normalizeBaseUrl(process.env.WHATSAPP_SERVICE_URL)
  if (!baseUrl) {
    const err = new Error('Falta WHATSAPP_SERVICE_URL para modo remoto')
    err.status = 500
    throw err
  }
  const timeoutMs =
    Number.isFinite(REMOTE_TIMEOUT_MS) && REMOTE_TIMEOUT_MS > 0
      ? REMOTE_TIMEOUT_MS
      : 8000

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  const token = String(process.env.WHATSAPP_SERVICE_TOKEN ?? '').trim()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (token) {
    headers['x-whatsapp-service-token'] = token
  }

  try {
    const res = await fetch(`${baseUrl}${pathname}`, {
      ...options,
      headers,
      signal: ac.signal,
    })
    const text = await res.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = {}
    }
    if (!res.ok) {
      const err = new Error(data?.error || `Error HTTP ${res.status}`)
      err.status = res.status
      throw err
    }
    return data
  } catch (e) {
    if (e?.name === 'AbortError') {
      const err = new Error('Timeout conectando al servicio de WhatsApp')
      err.status = 504
      throw err
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

export const whatsappClient = {
  mode: WHATSAPP_MODE,
  isEnabled,

  async connect() {
    assertEnabled()
    if (WHATSAPP_MODE === 'remote') {
      const r = await remoteRequest('/api/whatsapp/connect', { method: 'POST' })
      return r?.status || null
    }
    const local = await getLocalService()
    return local.connect()
  },

  async disconnect({ clearSession = false } = {}) {
    assertEnabled()
    if (WHATSAPP_MODE === 'remote') {
      const r = await remoteRequest('/api/whatsapp/disconnect', {
        method: 'POST',
        body: JSON.stringify({ clearSession }),
      })
      return r?.status || null
    }
    const local = await getLocalService()
    return local.disconnect({ clearSession })
  },

  async getStatus() {
    if (!isEnabled()) return disabledStatus()
    if (WHATSAPP_MODE === 'remote') {
      const r = await remoteRequest('/api/whatsapp/status')
      return r?.status || null
    }
    const local = await getLocalService()
    return local.getStatus()
  },

  async getQrPayload() {
    if (!isEnabled()) return { qr: '', qrDataUrl: '' }
    if (WHATSAPP_MODE === 'remote') {
      const r = await remoteRequest('/api/whatsapp/qr')
      return {
        qr: String(r?.qr ?? '').trim(),
        qrDataUrl: String(r?.qrDataUrl ?? '').trim(),
      }
    }
    const local = await getLocalService()
    return { qr: local.getQrText(), qrDataUrl: '' }
  },

  async sendText({ phone, message }) {
    assertEnabled()
    if (WHATSAPP_MODE === 'remote') {
      const r = await remoteRequest('/api/whatsapp/send-manual', {
        method: 'POST',
        body: JSON.stringify({ phone, message }),
      })
      return r?.result || null
    }
    const local = await getLocalService()
    return local.sendText({ phone, message })
  },
}
