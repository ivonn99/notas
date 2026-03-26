import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: new URL('../.env', import.meta.url) })
const pool = new pg.Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
})

const r = await pool.query(
  `SELECT column_name
   FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'importaciones'
   ORDER BY ordinal_position`,
)
console.log('importaciones:', r.rows.map((x) => x.column_name).join(', '))

await pool.end()
