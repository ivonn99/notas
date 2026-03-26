import dotenv from 'dotenv'
import pg from 'pg'
import { verifyDjangoPassword } from '../src/auth/djangoPassword.js'

dotenv.config({ path: new URL('../.env', import.meta.url) })

const pool = new pg.Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
})
const user = process.argv[2] || 'demo_js'
const pass = process.argv[3] || 'Dm2026-Notas!'

const { rows } = await pool.query(
  'SELECT username, password FROM usuarios WHERE LOWER(username) = LOWER($1)',
  [user],
)
if (!rows[0]) {
  console.log('Usuario no encontrado')
  process.exit(1)
}
const pwd = rows[0].password
console.log('Hash prefix:', pwd.slice(0, 50))
console.log('verify:', verifyDjangoPassword(pass, pwd))
await pool.end()
