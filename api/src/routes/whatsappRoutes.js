import { Router } from 'express'
import QRCode from 'qrcode'

import { requireAuth, requireRoles } from '../middleware/auth.js'
import { sendWhatsappBatch } from '../services/whatsappBatchService.js'
import { whatsappClient } from '../services/whatsappClient.js'
import { maskPhone } from '../services/whatsappUtils.js'
import {
  parseClearSessionFlag,
  resolveTestPayload,
  validateManualSendPayload,
} from '../services/whatsappValidationService.js'

const router = Router()

router.use(requireAuth, requireRoles('ADMIN', 'CREDITO'))

router.post('/connect', async (_req, res, next) => {
  try {
    const status = await whatsappClient.connect()
    res.json({ ok: true, mode: whatsappClient.mode, status })
  } catch (e) {
    next(e)
  }
})

router.post('/disconnect', async (req, res, next) => {
  try {
    const clearSession = parseClearSessionFlag(req.body?.clearSession)
    const status = await whatsappClient.disconnect({ clearSession })
    res.json({ ok: true, mode: whatsappClient.mode, status, clearSession })
  } catch (e) {
    next(e)
  }
})

router.get('/status', async (_req, res, next) => {
  try {
    const status = await whatsappClient.getStatus()
    res.json({ ok: true, mode: whatsappClient.mode, enabled: whatsappClient.isEnabled(), status })
  } catch (e) {
    next(e)
  }
})

router.get('/qr', async (_req, res, next) => {
  try {
    const qrPayload = await whatsappClient.getQrPayload()
    const qrText = String(qrPayload?.qr ?? '').trim()
    if (!qrText) {
      if (qrPayload?.qrDataUrl) {
        return res.json({ ok: true, mode: whatsappClient.mode, qr: '', qrDataUrl: qrPayload.qrDataUrl })
      }
      return res.status(404).json({ ok: false, error: 'QR no disponible por ahora' })
    }
    const qrDataUrl = await QRCode.toDataURL(qrText, { margin: 1, width: 320 })
    res.json({ ok: true, mode: whatsappClient.mode, qr: qrText, qrDataUrl })
  } catch (e) {
    next(e)
  }
})

router.post('/send-manual', async (req, res, next) => {
  try {
    const { phone, message } = validateManualSendPayload(req.body)
    const result = await whatsappClient.sendText({ phone, message })
    res.json({ ok: true, mode: whatsappClient.mode, to: maskPhone(phone), result })
  } catch (e) {
    next(e)
  }
})

router.post('/send-test', async (req, res, next) => {
  try {
    const { phone, message } = resolveTestPayload(req.body, process.env.WHATSAPP_TEST_PHONE)
    const result = await whatsappClient.sendText({ phone, message })
    res.json({ ok: true, mode: whatsappClient.mode, to: maskPhone(phone), result })
  } catch (e) {
    next(e)
  }
})

router.post('/send-batch', async (req, res, next) => {
  try {
    const payload = await sendWhatsappBatch({
      client: whatsappClient,
      items: req.body?.items,
      delaySecondsRaw: req.body?.delay_seconds,
    })
    res.json(payload)
  } catch (e) {
    next(e)
  }
})


export default router
