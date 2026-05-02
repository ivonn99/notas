import fs from 'node:fs'
import path from 'node:path'

import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'
import { buildCandidateJids, maskPhone, normalizePhoneMx } from './whatsappUtils.js'

const DEFAULT_SESSION_DIR = path.resolve(process.cwd(), '.baileys_auth')
let activeInstanceId = 'init'

function nowIso() {
  return new Date().toISOString()
}

function safeString(value) {
  try {
    return String(value ?? '')
  } catch {
    return ''
  }
}

function maskPhoneForLog(phoneRaw) {
  return maskPhone(safeString(phoneRaw))
}

function logInfo(event, detail = {}) {
  console.log(`[whatsapp][${activeInstanceId}][${nowIso()}][info] ${event}`, detail)
}

function logWarn(event, detail = {}) {
  console.warn(`[whatsapp][${activeInstanceId}][${nowIso()}][warn] ${event}`, detail)
}

function logError(event, detail = {}) {
  console.error(`[whatsapp][${activeInstanceId}][${nowIso()}][error] ${event}`, detail)
}

class WhatsappBaileysService {
  constructor() {
    this.instanceId = Math.random().toString(36).substring(7)
    activeInstanceId = this.instanceId
    logInfo('service.instantiated', { instanceId: this.instanceId })
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
    logWarn('reconnect.scheduled', { inMs: ms })
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      try {
        logInfo('reconnect.attempt')
        await this.connect()
        logInfo('reconnect.success')
      } catch {
        logWarn('reconnect.failed.retrying')
        this._scheduleReconnect(4000)
      }
    }, ms)
  }

  async connect() {
    logInfo('connect.requested', {
      hasSocket: Boolean(this.sock),
      isConnected: Boolean(this.state.isConnected),
      isConnecting: Boolean(this.connectingPromise),
    })
    if (this.connectingPromise) return this.connectingPromise
    if (this.sock && this.state.isConnected) return this.getStatus()

    this.connectingPromise = (async () => {
      try {
        const sessionDir = process.env.WHATSAPP_SESSION_DIR?.trim() || DEFAULT_SESSION_DIR
        fs.mkdirSync(sessionDir, { recursive: true })
        logInfo('connect.session_dir.ready', { sessionDir })

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
        this.saveCreds = saveCreds

        const { version } = await fetchLatestBaileysVersion()
        logInfo('connect.baileys_version', { version })
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
            logWarn('creds.update.save_failed')
          }
        })

        sock.ev.on('connection.update', (update) => {
          const { connection, lastDisconnect, qr } = update
          logInfo('connection.update', {
            connection: safeString(connection || ''),
            hasQr: Boolean(qr),
            hasLastDisconnect: Boolean(lastDisconnect),
          })
          if (qr) {
            logInfo('connection.qr.received')
            this._updateState({
              qr,
              status: 'qr',
              isConnected: false,
            })
          }

          if (connection === 'open') {
            logInfo('connection.open', { me: sock?.user?.id || null })
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
            logWarn('connection.close', {
              statusCode: statusCode ?? null,
              loggedOut,
              reason: safeString(lastDisconnect?.error?.message || 'Conexión cerrada'),
            })
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

        logInfo('connect.ready')
        return this.getStatus()
      } catch (e) {
        logError('connect.failed', { message: safeString(e?.message || e) })
        throw e
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
    logInfo('disconnect.requested', { clearSession })
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
      logInfo('disconnect.reconnect_timer_cleared')
    }
    if (this.sock) {
      try {
        await this.sock.logout()
        logInfo('disconnect.logout.ok')
      } catch {
        try {
          this.sock.end(new Error('manual disconnect'))
          logWarn('disconnect.logout.failed.socket_end_used')
        } catch {
          logWarn('disconnect.socket_end.failed')
        }
      }
      this.sock = null
    }

    if (clearSession) {
      const sessionDir = process.env.WHATSAPP_SESSION_DIR?.trim() || DEFAULT_SESSION_DIR
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true })
        logInfo('disconnect.session_cleared', { sessionDir })
      } catch {
        logWarn('disconnect.session_clear_failed', { sessionDir })
      }
    }

    this._updateState({
      status: 'disconnected',
      isConnected: false,
      qr: '',
      me: null,
      lastError: '',
    })
    logInfo('disconnect.done')
    return this.getStatus()
  }

  async sendText({ phone, message }) {
    if (!this.sock || !this.state.isConnected) {
      const stateLog = {
        hasSock: Boolean(this.sock),
        status: this.state.status,
        isConnected: this.state.isConnected,
        hasMe: Boolean(this.state.me),
      }
      logWarn('send.blocked.not_connected', stateLog)

      // Si no hay socket o no está conectado, pero tampoco estamos en un estado de error fatal (logged_out),
      // podríamos intentar reconectar si hay sesión, pero por ahora solo reportamos mejor el error.
      throw new Error(
        `WhatsApp no está conectado (Estado: ${this.state.status}, IsConnected: ${this.state.isConnected}, Sock: ${Boolean(this.sock)}). Escanea QR primero.`,
      )
    }
    const normalized = normalizePhoneMx(phone)
    if (!normalized) {
      logWarn('send.blocked.invalid_phone', { to: maskPhoneForLog(phone) })
      throw new Error('Número de teléfono inválido')
    }
    const text = String(message ?? '').trim()
    if (!text) {
      logWarn('send.blocked.empty_message', { to: maskPhoneForLog(phone) })
      throw new Error('Mensaje vacío')
    }
    logInfo('send.requested', {
      to: maskPhoneForLog(phone),
      normalized: maskPhoneForLog(normalized),
      textLength: text.length,
    })
    const candidates = buildCandidateJids(normalized)
    let jid = candidates[0]
    try {
      for (const c of candidates) {
        // eslint-disable-next-line no-await-in-loop
        const check = await this.sock.onWhatsApp(c)
        if (Array.isArray(check) && check[0]?.exists) {
          jid = c
          logInfo('send.jid.resolved', { jid })
          break
        }
      }
    } catch {
      logWarn('send.jid.validation_failed', { fallbackJid: jid })
    }
    const response = await this.sock.sendMessage(jid, { text })
    logInfo('send.done', {
      jid,
      messageId: response?.key?.id || null,
    })
    return {
      jid,
      id: response?.key?.id || null,
      timestamp: response?.messageTimestamp || null,
    }
  }
}

export const whatsappBaileysService = new WhatsappBaileysService()
