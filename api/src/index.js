import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

import cookieParser from 'cookie-parser'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

import { createCorsOptions, logCorsStartup } from './config/cors.js'
import { closePool, getDbConnectionMeta, getPool } from './db.js'
import adminRouter from './routes/adminRoutes.js'
import alertasRouter from './routes/alertasRoutes.js'
import auditoriaRouter from './routes/auditoriaRoutes.js'
import authRouter from './routes/authRoutes.js'
import importacionesRouter from './routes/importacionesRoutes.js'
import logsRouter from './routes/logsRoutes.js'
import notasCreditoRouter from './routes/notasCreditoRoutes.js'
import notificacionesRouter from './routes/notificacionesRoutes.js'
import profileRouter from './routes/profileRoutes.js'
import reportesRouter from './routes/reportesRoutes.js'
import whatsappCobranzaRouter from './routes/whatsappCobranzaRoutes.js'
import whatsappRouter from './routes/whatsappRoutes.js'
import seguimientoRouter from './routes/seguimientoRoutes.js'
import { ensureAuditTable } from './services/audit.js'
import { ensureNotasOptionalColumns } from './services/notasSchema.js'
import { ensureUsuariosOptionalColumns } from './services/usuariosSchema.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const appLogDir = path.join(__dirname, '..', 'logs')
const appLogFile = path.join(appLogDir, 'app.log')

function appendAppLogLine(message) {
  try {
    fs.mkdirSync(appLogDir, { recursive: true })
    fs.appendFileSync(appLogFile, `[${new Date().toISOString()}] ${message}\n`)
  } catch {
    /* ignore */
  }
}

const app = express()
const PORT = Number(process.env.PORT) || 3001

async function markInterruptedImportaciones() {
  try {
    const pool = getPool()
    const r = await pool.query(
      `
      UPDATE importaciones
      SET estado = 'FALLIDA',
          observaciones = CONCAT(
            COALESCE(observaciones, ''),
            CASE WHEN COALESCE(observaciones, '') = '' THEN '' ELSE E'\\n' END,
            'Interrumpida por reinicio del servidor en ',
            NOW()::text
          )
      WHERE estado = 'EN_PROCESO'
      RETURNING id
    `,
    )
    if (r.rowCount > 0) {
      console.warn(`[importaciones] Marcadas como FALLIDA por reinicio: ${r.rowCount}`)
    }
  } catch (e) {
    console.warn('[importaciones] No se pudo marcar importaciones interrumpidas:', e.message)
  }
}

logCorsStartup()
app.use(cors(createCorsOptions()))
app.use(cookieParser())
/** Default Express es ~100kb; lotes WhatsApp (/send-batch) con textos largos superan ese límite → 413. */
const JSON_BODY_LIMIT = String(process.env.JSON_BODY_LIMIT || '15mb').trim() || '15mb'
app.use(express.json({ limit: JSON_BODY_LIMIT }))
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID()
  res.setHeader('X-Request-Id', req.requestId)
  next()
})

app.use('/api/auth', authRouter)
app.use('/api/notas-credito', notasCreditoRouter)
app.use('/api/seguimiento', seguimientoRouter)
app.use('/api/alertas', alertasRouter)
app.use('/api/admin', adminRouter)
app.use('/api/profile', profileRouter)
app.use('/api/importaciones', importacionesRouter)
app.use('/api/logs-sistema', logsRouter)
app.use('/api/notificaciones', notificacionesRouter)
app.use('/api/auditoria', auditoriaRouter)
app.use('/api/reportes', reportesRouter)
app.use('/api/whatsapp', whatsappRouter)
app.use('/api/whatsapp', whatsappCobranzaRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notas-api' })
})

/** Alias tipo Django / guia.txt para monitoreo */
app.get('/api/healthz', (_req, res) => {
  res.json({ status: 'ok' })
})

/** Comprueba conexión a la base de datos y, si existe la tabla, cuenta notas de crédito. */
app.get('/api/db/ping', async (_req, res) => {
  const t0 = Date.now()
  try {
    const pool = getPool()
    await pool.query('SELECT 1 AS ok')

    const meta = getDbConnectionMeta()
    let notasCreditoCount = null
    try {
      const r = await pool.query(
        'SELECT COUNT(*)::int AS c FROM notas_credito',
      )
      notasCreditoCount = r.rows[0]?.c ?? null
    } catch {
      // Tabla ausente, otro esquema o sin permiso: el ping igual es válido.
    }

    res.json({
      ok: true,
      dbSource: meta?.source,
      latencyMs: Date.now() - t0,
      notasCreditoCount,
      dbHost: meta?.host,
    })
  } catch (err) {
    console.error('DB ping:', err.message)
    res.status(503).json({
      ok: false,
      error: 'No se pudo conectar a la base de datos. Revisa SUPABASE_DB_URL (o DATABASE_URL) en api/.env.',
    })
  }
})

app.use((err, _req, res, _next) => {
  const status = Number(err?.status || 500)
  const requestId = _req.requestId || null
  const msg =
    status >= 500 ? 'Error interno del servidor' : err?.message || 'Error de solicitud'
  console.error('[api:error]', { requestId, status, message: err?.message, stack: err?.stack })
  if (status >= 500) {
    appendAppLogLine(`[${requestId}] ${err?.message || 'error'}`)
  }
  res.status(status).json({
    ok: false,
    error: msg,
    code: status,
    requestId,
  })
})

const server = app.listen(PORT, async () => {
  // Resiliencia de arranque: si falla DB no tumbamos el proceso.
  try {
    await ensureAuditTable()
    await ensureNotasOptionalColumns()
    await ensureUsuariosOptionalColumns()
    await markInterruptedImportaciones()
  } catch (e) {
    const msg = e?.message || 'error desconocido en bootstrap'
    console.error('[bootstrap] Inicialización de DB falló:', msg)
    appendAppLogLine(`[bootstrap] Inicialización de DB falló: ${msg}`)
  }
  appendAppLogLine(`API lista en http://localhost:${PORT}`)
  console.log(`API lista en http://localhost:${PORT}`)
})

server.on('error', (err) => {
  const msg = err?.message || 'error de servidor'
  console.error('[server:error]', msg)
  appendAppLogLine(`[server:error] ${msg}`)
})

async function shutdown() {
  await closePool()
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
process.on('unhandledRejection', (reason) => {
  const msg = reason?.message || String(reason)
  console.error('[process:unhandledRejection]', msg)
  appendAppLogLine(`[process:unhandledRejection] ${msg}`)
})
process.on('uncaughtException', (err) => {
  const msg = err?.message || String(err)
  console.error('[process:uncaughtException]', msg)
  appendAppLogLine(`[process:uncaughtException] ${msg}`)
})
