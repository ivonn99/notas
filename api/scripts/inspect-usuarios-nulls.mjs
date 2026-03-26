import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: new URL('../.env', import.meta.url) })
const pool = new pg.Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
})
const r = await pool.query(`
  SELECT column_name, is_nullable, column_default, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'usuarios'
  ORDER BY ordinal_position
`)
console.log(JSON.stringify(r.rows, null, 2))
await pool.end()
