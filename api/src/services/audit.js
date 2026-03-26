import { getPool } from '../db.js'

export async function ensureAuditTable() {
  const pool = getPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auditoria_eventos (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      usuario_id BIGINT NULL,
      username VARCHAR(150) NULL,
      accion VARCHAR(120) NOT NULL,
      entidad VARCHAR(120) NULL,
      entidad_id VARCHAR(120) NULL,
      detalle JSONB NULL,
      ip VARCHAR(80) NULL,
      user_agent TEXT NULL,
      request_id VARCHAR(100) NULL
    )
  `)
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_created_at ON auditoria_eventos (created_at DESC)',
  )
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_accion ON auditoria_eventos (accion)',
  )
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_usuario_id ON auditoria_eventos (usuario_id)',
  )
}

/**
 * Registra evento de auditoría. Nunca lanza error al caller.
 */
export async function logAudit({
  req,
  accion,
  entidad = null,
  entidadId = null,
  detalle = null,
  usuarioId = null,
  username = null,
}) {
  try {
    const pool = getPool()
    const uid = usuarioId ?? req?.user?.sub ?? null
    const uname = username ?? req?.user?.username ?? null
    const ip =
      req?.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() ||
      req?.socket?.remoteAddress ||
      null
    const userAgent = req?.headers?.['user-agent'] ?? null
    const requestId = req?.requestId ?? null

    await pool.query(
      `
      INSERT INTO auditoria_eventos
        (usuario_id, username, accion, entidad, entidad_id, detalle, ip, user_agent, request_id)
      VALUES
        ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
    `,
      [
        uid,
        uname,
        accion,
        entidad,
        entidadId != null ? String(entidadId) : null,
        detalle ? JSON.stringify(detalle) : null,
        ip,
        userAgent,
        requestId,
      ],
    )
  } catch (e) {
    console.warn('[audit] No se pudo registrar evento:', e.message)
  }
}
