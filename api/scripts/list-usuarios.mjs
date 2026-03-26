import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: new URL('../.env', import.meta.url) })

const pool = new pg.Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
})

const needle = process.argv[2]?.toLowerCase() || 'zoram'

const r = await pool.query(
  `SELECT id, username, rol, activo, is_active,
          LEFT(password, 45) AS hash_pref
   FROM usuarios
   WHERE LOWER(username) = $1 OR LOWER(username) LIKE $2`,
  [needle, `%${needle}%`],
)
console.log('Coincidencias:', JSON.stringify(r.rows, null, 2))

const all = await pool.query(
  'SELECT id, username, rol, activo, is_active FROM usuarios ORDER BY id',
)
console.log('Todos:', JSON.stringify(all.rows, null, 2))

await pool.end()
