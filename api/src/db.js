import pg from 'pg'

let pool = null

function stripSslParams(connectionString) {
  const cs = String(connectionString || '')
  if (!cs.includes('?')) return cs
  const [base, qs] = cs.split('?', 2)
  if (!qs) return cs
  const params = new URLSearchParams(qs)
  params.delete('sslmode')
  params.delete('channel_binding')
  const nextQs = params.toString()
  return nextQs ? `${base}?${nextQs}` : base
}

/**
 * Pool hacia PostgreSQL administrado (Supabase).
 * Usa `SUPABASE_DB_URL` y como fallback `DATABASE_URL`.
 */
export function getDbConnectionMeta() {
  const supabase = process.env.SUPABASE_DB_URL?.trim() || ''
  const generic = process.env.DATABASE_URL?.trim() || ''

  const connectionString = supabase || generic
  if (!connectionString) {
    return { connectionString: null, source: null, host: null }
  }

  const source = supabase ? 'SUPABASE' : generic ? 'DATABASE_URL' : null

  let host = null
  try {
    // Ej: postgresql://usuario:pass@db.host.com:5432/postgres
    const match = connectionString.match(/@([^:/]+)(?::\d+)?\//)
    host = match?.[1] ?? null
  } catch {
    host = null
  }

  return { connectionString, source, host }
}

export function getPool() {
  if (pool) return pool

  const meta = getDbConnectionMeta()
  const connectionString = stripSslParams(meta.connectionString)

  if (!connectionString) {
    throw new Error(
      'Configura `SUPABASE_DB_URL` (o `DATABASE_URL`) en `api/.env` con tu URI de PostgreSQL.',
    )
  }

  pool = new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    // Evita fallos de handshake SSL por cadenas con certificados self-signed en algunos entornos.
    // (Desarrollo: no en producción sin revisar la configuración TLS).
    ssl: meta.source === 'SUPABASE' ? { rejectUnauthorized: false } : undefined,
  })

  pool.on('error', (err) => {
    console.error('Error inesperado en el pool de PostgreSQL', err)
  })

  return pool
}

export async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
  }
}
