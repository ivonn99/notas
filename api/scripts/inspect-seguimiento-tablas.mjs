import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: new URL('../.env', import.meta.url) })

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

async function show(table) {
  const r = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table],
  )
  console.log(`${table}: ${r.rows.map((x) => x.column_name).join(', ')}`)
}

await show('notas_credito')
await show('historial_notas')
await show('aclaraciones')
await pool.end()
