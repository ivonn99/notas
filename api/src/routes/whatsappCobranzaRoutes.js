import { Router } from 'express'

import { requireAuth, requireRoles } from '../middleware/auth.js'
import {
  buildMensajesPendientesPayload,
  EMPRESAS_WHATSAPP,
} from '../services/whatsappCobranzaMessageService.js'

const router = Router()

router.use(requireAuth, requireRoles('ADMIN', 'CREDITO'))

/**
 * GET /api/whatsapp/mensajes-pendientes-30d
 * Notas PENDIENTE con antigüedad configurable por fecha_nota.
 */
router.get('/mensajes-pendientes-30d', async (req, res, next) => {
  try {
    const empresa = String(req.query.empresa ?? '').trim().toUpperCase()
    if (!EMPRESAS_WHATSAPP.has(empresa)) {
      return res.status(400).json({
        ok: false,
        error: 'empresa requerida: DISTRIBUIDORA o RODRIGO',
      })
    }

    const diasMinRaw = Number.parseInt(String(req.query.dias_min ?? '30').trim(), 10)
    const diasMin =
      Number.isFinite(diasMinRaw) && diasMinRaw >= 1 && diasMinRaw <= 3650 ? diasMinRaw : 30
    const diasMaxRaw = Number.parseInt(String(req.query.dias_max ?? '').trim(), 10)
    const diasMax =
      Number.isFinite(diasMaxRaw) && diasMaxRaw >= 1 && diasMaxRaw <= 3650 ? diasMaxRaw : null
    if (diasMax != null && diasMax < diasMin) {
      return res.status(400).json({ ok: false, error: 'dias_max no puede ser menor a dias_min' })
    }

    const payload = await buildMensajesPendientesPayload({ empresa, diasMin, diasMax })
    return res.json(payload)
  } catch (e) {
    return next(e)
  }
})

export default router
