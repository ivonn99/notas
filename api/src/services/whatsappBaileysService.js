import fs from 'node:fs'
import path from 'node:path'

import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'

const DEFAULT_SESSION_DIR = path.resolve(process.cwd(), '.baileys_auth')

function normalizePhone(phoneRaw) {
  const digits = String(phoneRaw ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10) return `52${digits}`
  return digits
}

function buildCandidateJids(normalizedDigits) {
  if (!normalizedDigits) return []
  const out = new Set()
  out.add(`${normalizedDigits}@s.whatsapp.net`)
  // Compatibilidad MX: algunas cuentas históricas resuelven mejor con 521 + 10 dígitos.
  if (normalizedDigits.startsWith('52') && normalizedDigits.length === 12) {
    out.add(`521${normalizedDigits.slice(2)}@s.whatsapp.net`)
  }
  return [...out]
}

class WhatsappBaileysService {
  constructor() {
    this.sock = null
    this.saveCreds = null
    this.connectingPromise = null
    this.reconnectTimer = null
    this.state = {
      status: 'disconnected',
      isConnected: false,
      qr: '',
      me: null,
      lastError: '',
      updatedAt: new Date().toISOString(),
    }
  }

  _updateState(partial) {
    this.state = {
      ...this.state,
      ...partial,
      updatedAt: new Date().toISOString(),
    }
  }

  _scheduleReconnect(ms = 2500) {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      try {
        await this.connect()
      } catch {
        this._scheduleReconnect(4000)
      }
    }, ms)
  }

  async connect() {
    if (this.connectingPromise) return this.connectingPromise
    if (this.sock && this.state.isConnected) return this.getStatus()

    this.connectingPromise = (async () => {
      try {
        const sessionDir = process.env.WHATSAPP_SESSION_DIR?.trim() || DEFAULT_SESSION_DIR
        fs.mkdirSync(sessionDir, { recursive: true })

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
        this.saveCreds = saveCreds

        const { version } = await fetchLatestBaileysVersion()
        const sock = makeWASocket({
          version,
          auth: state,
          printQRInTerminal: false,
          syncFullHistory: false,
          markOnlineOnConnect: false,
          browser: ['DMH Notas', 'Chrome', '1.0.0'],
        })

        this.sock = sock
        this._updateState({
          status: 'connecting',
          isConnected: false,
          lastError: '',
        })

        sock.ev.on('creds.update', async () => {
          try {
            await this.saveCreds?.()
          } catch {
            // no-op
          }
        })

        sock.ev.on('connection.update', (update) => {
          const { connection, lastDisconnect, qr } = update
          if (qr) {
            this._updateState({
              qr,
              status: 'qr',
              isConnected: false,
            })
          }

          if (connection === 'open') {
            this._updateState({
              status: 'connected',
              isConnected: true,
              qr: '',
              me: sock?.user || null,
              lastError: '',
            })
          }

          if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode
            const loggedOut = statusCode === DisconnectReason.loggedOut
            this._updateState({
              status: loggedOut ? 'logged_out' : 'disconnected',
              isConnected: false,
              me: null,
              lastError: lastDisconnect?.error?.message || 'Conexión cerrada',
            })
            this.sock = null
            if (!loggedOut) {
              this._scheduleReconnect()
            }
          }
        })

        return this.getStatus()
      } finally {
        this.connectingPromise = null
      }
    })()

    return this.connectingPromise
  }

  getStatus() {
    return { ...this.state }
  }

  getQrText() {
    return this.state.qr || ''
  }

  async disconnect({ clearSession = false } = {}) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.sock) {
      try {
        await this.sock.logout()
      } catch {
        try {
          this.sock.end(new Error('manual disconnect'))
        } catch {
          // no-op
        }
      }
      this.sock = null
    }

    if (clearSession) {
      const sessionDir = process.env.WHATSAPP_SESSION_DIR?.trim() || DEFAULT_SESSION_DIR
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true })
      } catch {
        // no-op
      }
    }

    this._updateState({
      status: 'disconnected',
      isConnected: false,
      qr: '',
      me: null,
      lastError: '',
    })
    return this.getStatus()
  }

  async sendText({ phone, message }) {
    if (!this.sock || !this.state.isConnected) {
      throw new Error('WhatsApp no está conectado. Escanea QR primero.')
    }
    const normalized = normalizePhone(phone)
    if (!normalized) {
      throw new Error('Número de teléfono inválido')
    }
    const text = String(message ?? '').trim()
    if (!text) {
      throw new Error('Mensaje vacío')
    }
    const candidates = buildCandidateJids(normalized)
    let jid = candidates[0]
    try {
      for (const c of candidates) {
        // eslint-disable-next-line no-await-in-loop
        const check = await this.sock.onWhatsApp(c)
        if (Array.isArray(check) && check[0]?.exists) {
          jid = c
          break
        }
      }
    } catch {
      // Si falla la validación, intentamos de todos modos con el primer candidato.
    }
    const response = await this.sock.sendMessage(jid, { text })
    return {
      jid,
      id: response?.key?.id || null,
      timestamp: response?.messageTimestamp || null,
    }
  }
}

export const whatsappBaileysService = new WhatsappBaileysService()
