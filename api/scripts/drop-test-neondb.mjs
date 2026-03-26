import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: new URL('../.env', import.meta.url) })

const cs = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL
if (!cs) {
  console.error('Falta NEON_DATABASE_URL/DATABASE_URL en api/.env')
  process.exit(1)
}

const client = new pg.Client({ connectionString: cs })
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
