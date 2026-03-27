import { Router } from 'express'
import QRCode from 'qrcode'

import { getPool } from '../db.js'
import { requireAuth, requireRoles } from '../middleware/auth.js'
import { whatsappClient } from '../services/whatsappClient.js'

const router = Router()

router.use(requireAuth, requireRoles('ADMIN'))

const EMPRESAS = new Set(['DISTRIBUIDORA', 'RODRIGO'])

const EMPRESA_ETIQUETA = {
  DISTRIBUIDORA: 'Distribuidora',
  RODRIGO: 'Rodrigo',
}

function maskPhone(v) {
  const digits = String(v ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length <= 4) return digits
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`
}

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
    const clearSessionRaw = String(req.body?.clearSession ?? '').trim().toLowerCase()
    const clearSession = ['1', 'true', 'si', 'sí', 'yes'].includes(clearSessionRaw)
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
    const phone = String(req.body?.phone ?? '').trim()
    const message = String(req.body?.message ?? '').trim()
    if (!phone) return res.status(400).json({ ok: false, error: 'phone es requerido' })
    if (!message) return res.status(400).json({ ok: false, error: 'message es requerido' })
    const result = await whatsappClient.sendText({ phone, message })
    res.json({ ok: true, mode: whatsappClient.mode, to: maskPhone(phone), result })
  } catch (e) {
    next(e)
  }
})

router.post('/send-test', async (req, res, next) => {
  try {
    const phone = String(req.body?.phone ?? process.env.WHATSAPP_TEST_PHONE ?? '').trim()
    if (!phone) {
      return res.status(400).json({
        ok: false,
        error: 'Falta phone en body o WHATSAPP_TEST_PHONE en .env',
      })
    }
    const message = String(
      req.body?.message ??
        'Mensaje de prueba DMH: conexión WhatsApp operativa.',
    ).trim()
    const result = await whatsappClient.sendText({ phone, message })
    res.json({ ok: true, mode: whatsappClient.mode, to: maskPhone(phone), result })
  } catch (e) {
    next(e)
  }
})

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

router.post('/send-batch', async (req, res, next) => {
  try {
    const itemsRaw = Array.isArray(req.body?.items) ? req.body.items : []
    if (!itemsRaw.length) {
      return res.status(400).json({ ok: false, error: 'items es requerido y no puede estar vacío' })
    }
    if (itemsRaw.length > 200) {
      return res.status(400).json({ ok: false, error: 'Máximo 200 mensajes por lote' })
    }

    const delayRaw = Number.parseInt(String(req.body?.delay_seconds ?? '5').trim(), 10)
    const delaySeconds = Number.isFinite(delayRaw) ? Math.min(30, Math.max(1, delayRaw)) : 5

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
          const sendR = await whatsappClient.sendText({ phone, message })
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
    res.json({
      ok: true,
      delaySeconds,
      total: results.length,
      enviados,
      fallidos,
      results,
    })
  } catch (e) {
    next(e)
  }
})

function fmtFechaNota(value) {
  if (value == null) return '—'
  if (value instanceof Date) {
    const d = String(value.getUTCDate()).padStart(2, '0')
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const y = value.getUTCFullYear()
    return `${d}/${m}/${y}`
  }
  const s = String(value).trim()
  const iso = s.slice(0, 10)
  let m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) {
    const d = String(parsed.getUTCDate()).padStart(2, '0')
    const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0')
    const y = parsed.getUTCFullYear()
    return `${d}/${mm}/${y}`
  }
  return s
}

function fmtSaldo(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function nombreSaludo(row) {
  const nc = String(row.nombre_completo ?? '').trim()
  if (nc) return nc.split(/\s+/)[0] || nc
  return String(row.username ?? '').trim() || 'colega'
}

function armarMensaje({ empresaKey, nombre, rutasOrdenadas, diasMin, diasMax }) {
  const etiqueta = EMPRESA_ETIQUETA[empresaKey] || empresaKey
  const lines = []
  lines.push(`Hola ${nombre},`)
  lines.push('')
  const rangoTxt =
    Number.isFinite(diasMax) && diasMax > 0
      ? `entre ${diasMin} y ${diasMax} días`
      : `más de ${diasMin} días`
  lines.push(`Te recordamos que puedas acudir a resolver las siguientes notas de crédito de ${etiqueta} con antigüedad ${rangoTxt} (según fecha nota):`)
  lines.push('')
  for (const ruta of rutasOrdenadas) {
    lines.push(`Ruta ${ruta.codigo}:`)
    for (const n of ruta.notas) {
      lines.push(
        `• ${n.serieFolio} — ${n.cliente} — Saldo ${n.saldoFmt} — ${n.dias} días (fecha ${n.fechaFmt})`,
      )
    }
    lines.push('')
  }
  lines.push('Gracias por tu atención.')
  return lines.join('\n').trim()
}

/**
 * GET /api/whatsapp/mensajes-pendientes-30d
 * Notas PENDIENTE con antigüedad > 30 días (fecha_nota), agrupadas por usuario (usuario_rutas) y ruta.
 * Query: empresa = DISTRIBUIDORA | RODRIGO
 */
router.get('/mensajes-pendientes-30d', async (req, res, next) => {
  try {
    const empresa = String(req.query.empresa ?? '').trim().toUpperCase()
    if (!EMPRESAS.has(empresa)) {
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

    const pool = getPool()
    const r = await pool.query(
      `
      SELECT DISTINCT ON (u.id, n.id)
        u.id AS usuario_id,
        u.username,
        u.nombre_completo,
        u.telefono,
        UPPER(TRIM(r.codigo)) AS ruta_codigo,
        n.id AS nota_id,
        n.serie_folio,
        n.cliente,
        n.saldo::float8 AS saldo,
        n.fecha_nota::date AS fecha_nota,
        (CURRENT_DATE - n.fecha_nota::date)::int AS dias
      FROM notas_credito n
      INNER JOIN rutas r ON r.id = n.ruta_id
      INNER JOIN usuario_rutas ur ON ur.ruta_id = n.ruta_id
      INNER JOIN usuarios u ON u.id = ur.usuario_id
      WHERE n.empresa = $1
        AND n.estado = 'PENDIENTE'
        AND n.fecha_nota IS NOT NULL
        AND (CURRENT_DATE - n.fecha_nota::date) >= $2
        AND ($3::int IS NULL OR (CURRENT_DATE - n.fecha_nota::date) <= $3::int)
        AND COALESCE(u.is_active, true) = true
        AND COALESCE(u.activo, true) = true
        AND COALESCE(r.activa, true) = true
      ORDER BY u.id ASC, n.id ASC, ruta_codigo ASC, dias DESC, saldo DESC
    `,
      [empresa, diasMin, diasMax],
    )

    /** @type {Map<number, { usuarioId: number, username: string, nombreCompleto: string | null, telefono: string | null, rutas: Map<string, Array<{notaId: number, serieFolio: string, cliente: string, saldo: number, dias: number, fechaFmt: string, saldoFmt: string}>> }>} */
    const byUser = new Map()

    for (const row of r.rows) {
      const uid = row.usuario_id
      if (!byUser.has(uid)) {
        byUser.set(uid, {
          usuarioId: uid,
          username: row.username,
          nombreCompleto: row.nombre_completo,
          telefono: row.telefono,
          rutas: new Map(),
        })
      }
      const entry = byUser.get(uid)
      const codigo = row.ruta_codigo || '(sin código)'
      if (!entry.rutas.has(codigo)) {
        entry.rutas.set(codigo, [])
      }
      const nota = {
        notaId: row.nota_id,
        serieFolio: String(row.serie_folio ?? '').trim() || `ID ${row.nota_id}`,
        cliente: String(row.cliente ?? '').trim() || '—',
        saldo: row.saldo,
        dias: row.dias,
        fechaFmt: fmtFechaNota(row.fecha_nota),
        saldoFmt: fmtSaldo(row.saldo),
      }
      entry.rutas.get(codigo).push(nota)
    }

    const usuarios = []
    for (const u of byUser.values()) {
      const rutasOrdenadas = [...u.rutas.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
        .map(([codigo, notas]) => ({ codigo, notas }))

      const saludo = nombreSaludo({
        nombre_completo: u.nombreCompleto,
        username: u.username,
      })
      const mensaje = armarMensaje({
        empresaKey: empresa,
        nombre: saludo,
        rutasOrdenadas,
        diasMin,
        diasMax,
      })

      usuarios.push({
        usuarioId: u.usuarioId,
        username: u.username,
        nombreCompleto: u.nombreCompleto,
        nombreSaludo: saludo,
        telefono: u.telefono,
        rutas: rutasOrdenadas.map((rr) => ({
          codigo: rr.codigo,
          notas: rr.notas.map((n) => ({
            notaId: n.notaId,
            serieFolio: n.serieFolio,
            cliente: n.cliente,
            saldo: n.saldo,
            dias: n.dias,
            fechaNota: n.fechaFmt,
            saldoFmt: n.saldoFmt,
          })),
        })),
        mensaje,
      })
    }

    res.json({
      ok: true,
      empresa,
      diasMin,
      diasMax,
      totalUsuarios: usuarios.length,
      totalNotas: r.rows.length,
      usuarios,
    })
  } catch (e) {
    next(e)
  }
})

export default router
