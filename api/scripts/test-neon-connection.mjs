/**
 * Prueba rápida: lee api/.env y verifica conexión + tablas básicas.
 */
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: new URL('../.env', import.meta.url) })

const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
if (!url) {
  console.error('Falta SUPABASE_DB_URL o DATABASE_URL en api/.env')
  process.exit(1)
}

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

let host = '(desconocido)'
try {
  host = new URL(url.replace(/^postgres/, 'http')).hostname
} catch {
  /* ignore */
}

console.log('Host configurado:', host)

const usingSupabase = Boolean(process.env.SUPABASE_DB_URL?.trim())
const pool = new pg.Pool({
  connectionString: stripSslParams(url),
  ssl: usingSupabase ? { rejectUnauthorized: false } : undefined,
})

const info = await pool.query(`
  SELECT current_database() AS db,
         version() AS version_line
`)
console.log('Base actual:', info.rows[0].db)
console.log('PostgreSQL:', info.rows[0].version_line.split(',')[0])

let usuarios = '?'
let notas = '?'
try {
  const c = await pool.query('SELECT COUNT(*)::int AS n FROM usuarios')
  usuarios = c.rows[0].n
} catch (e) {
  usuarios = '(error: ' + e.message + ')'
}
try {
  const c = await pool.query('SELECT COUNT(*)::int AS n FROM notas_credito')
  notas = c.rows[0].n
} catch (e) {
  notas = '(tabla ausente o error)'
}
console.log('Filas — usuarios:', usuarios, '| notas_credito:', notas)

console.log('Resultado: conexión OK (misma cadena que usa el API).')
await pool.end()
