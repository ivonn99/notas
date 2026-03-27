import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: new URL('../.env', import.meta.url) })

const cs = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
const usingSupabase = Boolean(process.env.SUPABASE_DB_URL?.trim())
if (!cs) {
  console.error('Falta SUPABASE_DB_URL/DATABASE_URL en api/.env')
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

const client = new pg.Client({
  connectionString: stripSslParams(cs),
  ssl: usingSupabase ? { rejectUnauthorized: false } : undefined,
})
await client.connect()

const check = await client.query(
  "SELECT datname FROM pg_database WHERE datname = 'test_neondb'",
)

if (check.rowCount === 0) {
  console.log('test_neondb no existe (o no es visible con este rol)')
  await client.end()
  process.exit(0)
}

await client.query(
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'test_neondb' AND pid <> pg_backend_pid()",
)
await client.query('DROP DATABASE test_neondb')
console.log('test_neondb eliminada correctamente')

await client.end()
