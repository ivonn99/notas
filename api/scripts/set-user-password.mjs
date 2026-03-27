/**
 * Uso: node scripts/set-user-password.mjs <username> <nueva_contraseña>
 * Actualiza password con hash pbkdf2_sha256 (Django).
 */
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

import { encodeDjangoPassword } from '../src/auth/djangoPassword.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const username = process.argv[2]
const plain = process.argv[3]

if (!username || !plain) {
  console.error('Uso: node scripts/set-user-password.mjs <username> <contraseña>')
  process.exit(1)
}

const encoded = encodeDjangoPassword(plain)
const conn = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
const usingSupabase = Boolean(process.env.SUPABASE_DB_URL?.trim())
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
const pool = new pg.Pool({
  connectionString: stripSslParams(conn),
  ssl: usingSupabase ? { rejectUnauthorized: false } : undefined,
})

const r = await pool.query(
  'UPDATE usuarios SET password = $1 WHERE LOWER(username) = LOWER($2) RETURNING id, username',
  [encoded, username],
)

if (r.rowCount === 0) {
  console.error('No existe usuario:', username)
  process.exit(1)
}

console.log('Actualizado:', r.rows[0])
await pool.end()
