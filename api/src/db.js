import pg from 'pg'

let pool = null

/**
 * Pool hacia Neon (PostgreSQL). Usa NEON_DATABASE_URL o DATABASE_URL.
 * La cadena de Neon suele incluir sslmode=require; `pg` lo respeta.
 */
export function getPool() {
  if (pool) return pool

  const connectionString =
    process.env.NEON_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim()

  if (!connectionString) {
    throw new Error(
      'Configura NEON_DATABASE_URL (o DATABASE_URL) en api/.env — copia la URI desde el panel de Neon.',
    )
  }

  pool = new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
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
